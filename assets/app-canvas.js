/* ============ MODBAY 自由画板 ============
 * 模块可以随便拖：位置变了，连线跟着重算；布局存本机，刷新不丢。
 * 连线的语义是真实的：
 *   实线 = 信号/供电（模块 → 主控）
 *   虚线 = 驱动关系（驱动板 → 电机）
 *   同总线模块之间用总线色虚线互连
 */
(function () {
  "use strict";

  var M = window.M;
  var esc = M.esc;
  var KEY = "modbay.canvas.v1";

  var NODE_W = 190, NODE_H = 54;
  var stageEl = null, planRef = null, pos = {}, edges = [], drag = null, focusId = null;

  /* 驱动关系：驱动板 → 被驱动的执行器 */
  var DRIVE = {
    l298n: ["tt", "mg996r"], tb6612: ["tt", "mg996r"], drv8833: ["tt", "mg996r"],
    tmc2209: ["stepper28"], stepper28: ["stepper28"],
    relay: ["buzzer"], relay4: ["buzzer"]
  };

  function sig(plan) {
    if (!plan.board) return "empty";
    return plan.board.id + ":" + (plan.items || []).map(function (it) { return it.mod.id + "x" + it.qty; }).join(",");
  }

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function savePos(plan) {
    try {
      var all = loadAll();
      all[sig(plan)] = pos;
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) { /* noop */ }
  }
  function restore(plan) {
    var all = loadAll();
    var saved = all[sig(plan)];
    return saved && typeof saved === "object" ? saved : null;
  }

  /* ---------- 自动布局：主控在左，模块单列排在右侧 ----------
   * 单列的意义：每个模块到脊柱的分支都是干净的水平线，不会穿过别的节点。
   * 模块多时自动压缩行距（最高支持 9 个模块）。 */
  function autoLayout(plan, W, H) {
    var out = {};
    var bw = 168, bh = 78;
    out.__board = { x: Math.round(Math.max(12, W * 0.05)), y: Math.round(H / 2 - bh / 2), w: bw, h: bh };

    var all = (plan.items || []).slice();
    var n = all.length;
    var top = 22, bottom = H - 22;
    var nh = n > 7 ? 42 : 46;
    var gap = n > 1 ? Math.max(6, (bottom - top - n * nh) / (n - 1)) : 0;
    var totalH = n * nh + (n - 1) * gap;
    var y0 = Math.max(top, (H - totalH) / 2);
    var x = Math.round(out.__board.x + bw + 84);

    all.forEach(function (it, i) {
      out[it.mod.id] = {
        x: x, y: Math.round(y0 + i * (nh + gap)),
        w: NODE_W, h: nh
      };
    });
    return out;
  }

  /* ---------- 连线计算 ----------
   * 信号线不再逐条从主控拉到模块（那样必然横穿中间的节点），
   * 改成「一条总线脊柱 + 每个模块一段短分支」：这是真实排线的画法，也最不容易看错。
   * 驱动关系（驱动板 -> 电机）仍画独立的橙色虚线，走节点外侧绕行。 */
  function spineX() {
    var xs = [];
    Object.keys(pos).forEach(function (k) {
      if (k !== "__board") xs.push(pos[k].x);
    });
    if (!xs.length) return 0;
    return Math.max(12, Math.min.apply(null, xs) - 28);
  }

  function computeEdges(plan) {
    var list = [];
    if (!pos.__board) return list;
    var mods = (plan.items || []).filter(function (it) { return it.mod.cat !== "power"; });
    var sx = spineX();

    mods.forEach(function (it) {
      var n = pos[it.mod.id];
      if (!n) return;
      var bus = it.mod.bus;
      var color = bus === "i2c" ? "var(--accent)" : bus === "spi" ? "var(--cat-comm)" :
        bus === "uart" ? "var(--cat-board)" : bus === "none" ? "var(--cat-power)" : "var(--line-strong)";
      var label = bus === "i2c" ? "I2C" : bus === "spi" ? "SPI" : bus === "uart" ? "UART" :
        bus === "adc" ? "ADC" : bus === "pwm" ? "PWM" : bus === "none" ? "PWR" : "GPIO";
      list.push({
        kind: "branch", to: it.mod.id, color: color, label: label,
        dash: bus === "none" ? "3 3" : "",
        spineX: sx, y: n.y + n.h / 2
      });
    });

    /* 驱动关系：驱动板 -> 执行器 */
    mods.forEach(function (drv) {
      (DRIVE[drv.mod.id] || []).forEach(function (tid) {
        if (!pos[tid] || !pos[drv.mod.id] || tid === drv.mod.id) return;
        list.push({ kind: "drive", from: drv.mod.id, to: tid, color: "var(--cat-actuator)", label: "驱动", dash: "6 4" });
      });
    });
    return list;
  }

  /* 分支：脊柱 -> 模块左侧，水平直线 */
  function branchPath(e) {
    var n = pos[e.to];
    if (!n) return "";
    return "M" + e.spineX + " " + e.y + " H" + n.x;
  }
  /* 驱动：源右侧 -> 外侧竖线 -> 目标左侧，绕开中间节点 */
  function drivePath(e) {
    var a = pos[e.from], b = pos[e.to];
    if (!a || !b) return "";
    var ax = a.x + a.w, ay = a.y + a.h / 2;
    var bx = b.x, by = b.y + b.h / 2;
    if (bx < ax) { ax = a.x; bx = b.x + b.w; }
    var mid = (ax + bx) / 2;
    return "M" + ax + " " + ay + " H" + mid + " V" + by + " H" + bx;
  }

  function redraw() {
    if (!stageEl) return;
    var svg = stageEl.querySelector(".cv-edges");
    if (!svg) return;
    var parts = [];
    var board = pos.__board;
    var branches = edges.filter(function (e) { return e.kind === "branch"; });
    var drives = edges.filter(function (e) { return e.kind === "drive"; });

    /* ---- 脊柱 ---- */
    if (board && branches.length) {
      var sx = branches[0].spineX;
      var ys = branches.map(function (b) { return b.y; });
      var by0 = board.y + board.h / 2;
      var top = Math.min.apply(null, ys.concat([by0]));
      var bot = Math.max.apply(null, ys.concat([by0]));
      var on = !focusId;
      parts.push('<path d="M' + sx + " " + top + " V" + bot + '" fill="none" stroke="var(--line-strong)" stroke-width="2.6" stroke-opacity="' + (on ? 0.55 : 0.2) + '" stroke-linecap="round"/>');
      /* 主控 -> 脊柱 */
      parts.push('<path d="M' + (board.x + board.w) + " " + by0 + " H" + sx + '" fill="none" stroke="var(--line-strong)" stroke-width="2.6" stroke-opacity="' + (on ? 0.55 : 0.2) + '"/>');
      parts.push('<circle cx="' + (board.x + board.w) + '" cy="' + by0 + '" r="3" fill="var(--line-strong)" fill-opacity="' + (on ? 0.9 : 0.3) + '"/>');
    }

    /* ---- 分支 ---- */
    branches.forEach(function (e) {
      var hi = !focusId || focusId === e.to;
      var dim = focusId && focusId !== e.to && !edges.some(function (d) {
        return d.kind === "drive" && ((d.from === focusId && d.to === e.to) || (d.to === focusId && d.from === e.to));
      });
      var op = hi ? (dim ? 0.2 : 0.9) : 0.25;
      var n = pos[e.to];
      parts.push('<path d="' + branchPath(e) + '" fill="none" stroke="' + e.color +
        '" stroke-width="' + (hi && !dim ? 2 : 1.2) + '" stroke-opacity="' + op + '"' +
        (e.dash ? ' stroke-dasharray="' + e.dash + '"' : "") + "/>");
      parts.push('<circle cx="' + e.spineX + '" cy="' + e.y + '" r="2.6" fill="' + e.color + '" fill-opacity="' + op + '"/>');
      if (n) {
        parts.push('<circle cx="' + n.x + '" cy="' + e.y + '" r="2.8" fill="var(--bg-raised)" stroke="' + e.color + '" stroke-width="1.2" stroke-opacity="' + op + '"/>');
        if (hi && !dim && e.label) {
          parts.push('<text x="' + (e.spineX + 5) + '" y="' + (e.y - 4) + '" font-size="8.5" fill="' + e.color +
            '" font-family="Geist Mono, monospace">' + e.label + "</text>");
        }
      }
    });

    /* ---- 驱动关系 ---- */
    drives.forEach(function (e) {
      var hi = !focusId || focusId === e.from || focusId === e.to;
      var op = hi ? 0.9 : 0.16;
      var d = drivePath(e);
      if (!d) return;
      parts.push('<path d="' + d + '" fill="none" stroke="' + e.color + '" stroke-width="1.6" stroke-opacity="' + op +
        '" stroke-dasharray="6 4" stroke-linejoin="round"/>');
      if (hi) {
        var a = pos[e.from], b = pos[e.to];
        var ax = a.x + a.w, bx = b.x;
        if (bx < ax) { ax = a.x; bx = b.x + b.w; }
        var mx = (ax + bx) / 2, my = (a.y + a.h / 2 + b.y + b.h / 2) / 2;
        parts.push('<rect x="' + (mx - 13) + '" y="' + (my - 7) + '" width="26" height="13" rx="3" fill="var(--bg-raised)" stroke="' + e.color + '" stroke-width=".9" stroke-opacity=".7"/>');
        parts.push('<text x="' + mx + '" y="' + (my + 3) + '" font-size="8.5" text-anchor="middle" fill="' + e.color + '" font-family="Geist Mono, monospace">驱动</text>');
      }
    });

    svg.innerHTML = parts.join("");
    stageEl.querySelectorAll(".cv-node").forEach(function (el) {
      var id = el.getAttribute("data-node");
      el.classList.toggle("is-focus", focusId === id);
      el.classList.toggle("is-dim", !!focusId && focusId !== id &&
        !edges.some(function (e) {
          return e.kind === "drive" && ((e.from === focusId && e.to === id) || (e.to === focusId && e.from === id));
        }));
    });
  }

  /* 把 pos 写回节点的 left/top/宽高（拖拽与首次挂载共用） */
  function placeNodes() {
    if (!stageEl) return;
    stageEl.querySelectorAll(".cv-node").forEach(function (el) {
      var id = el.getAttribute("data-node");
      var p = pos[id];
      if (!p) return;
      el.style.left = p.x + "px";
      el.style.top = p.y + "px";
      el.style.width = p.w + "px";
      el.style.height = p.h + "px";
    });
  }

  /* ---------- 拖拽 ---------- */
  function onDown(e) {
    var el = e.target.closest ? e.target.closest(".cv-node") : null;
    if (!el) {
      focusId = null;
      redraw();
      return;
    }
    var id = el.getAttribute("data-node");
    var p = pos[id];
    if (!p) return;
    drag = { id: id, dx: e.clientX - p.x, dy: e.clientY - p.y, moved: false };
    el.classList.add("is-drag");
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    e.preventDefault();
  }
  function onMove(e) {
    if (!drag || !stageEl) return;
    var rect = stageEl.getBoundingClientRect();
    var p = pos[drag.id];
    if (!p) return;
    p.x = Math.max(0, Math.min(rect.width - p.w, e.clientX - rect.left - drag.dx));
    p.y = Math.max(0, Math.min(rect.height - p.h, e.clientY - rect.top - drag.dy));
    drag.moved = true;
    placeNodes();
    edges = computeEdges(planRef);
    redraw();
  }
  function onUp() {
    if (!drag) return;
    var el = stageEl && stageEl.querySelector('.cv-node[data-node="' + drag.id + '"]');
    if (el) el.classList.remove("is-drag");
    if (drag.moved) savePos(planRef);
    else {
      focusId = focusId === drag.id ? null : drag.id;
      redraw();
    }
    drag = null;
  }

  /* ---------- 渲染 ---------- */
  function nodeHtml(id, name, sub, color, isBoard) {
    return '<div class="cv-node' + (isBoard ? " cv-board" : "") + '" data-node="' + esc(id) + '" style="left:' +
      (pos[id] ? pos[id].x : 0) + "px;top:" + (pos[id] ? pos[id].y : 0) + "px;width:" +
      (pos[id] ? pos[id].w : NODE_W) + "px;height:" + (pos[id] ? pos[id].h : NODE_H) + 'px">' +
      '<i style="background:' + color + '"></i>' +
      '<div class="cv-txt"><b>' + esc(name) + "</b><span>" + esc(sub) + "</span></div>" +
      '<u class="cv-grip"></u></div>';
  }

  function view(plan) {
    if (!plan.board) {
      return '<section class="panel plan-span"><div class="panel-head"><h3>自由画板</h3></div>' +
        '<div class="panel-body"><p class="wiring-cap">选定基座后，可以在这里任意拖动模块、实时看连线。</p></div></section>';
    }
    var mods = (plan.items || []).filter(function (it) { return it.mod.cat !== "power"; });
    var powers = (plan.items || []).filter(function (it) { return it.mod.cat === "power"; });
    var all = mods.concat(powers);

    return '<section class="panel plan-span"><div class="panel-head"><h3>自由画板 · 拖一下就重排</h3>' +
      '<span class="mono">DRAG TO ARRANGE</span></div>' +
      '<div class="panel-body">' +
      '<div class="cv-toolbar">' +
      '<button class="btn btn-line btn-sm" data-act="cv-auto">自动排布</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="cv-reset">清除自定义位置</button>' +
      '<span class="cv-hint mono">拖动模块 → 连线实时重算 · 单击看关联 · 双击空白取消</span>' +
      "</div>" +
      '<div class="cv-stage" id="cv-stage" data-plan="' + esc(sig(plan)) + '">' +
      '<svg class="cv-edges"></svg>' +
      nodeHtml("__board", plan.board.name, "主控 · " + plan.board.logic, "var(--accent)", true) +
      all.map(function (it) {
        var c = window.MODBAY_UI && window.MODBAY_UI.catCss ? window.MODBAY_UI.catCss(it.mod.cat) : "var(--line-strong)";
        var bus = it.mod.bus === "none" ? "外供" : (it.mod.bus || "gpio").toUpperCase();
        return nodeHtml(it.mod.id, it.mod.name, bus + (it.mod.addr ? " " + it.mod.addr : ""), c, false);
      }).join("") +
      "</div>" +
      '<p class="wiring-cap">连线语义：<b>实线</b>=模块到主控的信号/供电（颜色按总线区分，I2C 蓝 / SPI 紫 / UART 青 / GPIO 灰），' +
      "<b>橙虚线</b>=驱动板到电机的驱动关系，<b>灰点线</b>=同总线设备共享。位置存在本机，换方案各存各的。</p>" +
      "</div></section>";
  }

  /* ---------- 挂载 ---------- */
  function mount(plan) {
    stageEl = document.getElementById("cv-stage");
    if (!stageEl) return;
    planRef = plan;
    var rect = stageEl.getBoundingClientRect();
    var W = rect.width || 1100;
    var H = rect.height || 460;

    var saved = restore(plan);
    pos = saved || autoLayout(plan, W, H);
    /* 方案变化后新增的模块补进布局 */
    var fresh = autoLayout(plan, W, H);
    Object.keys(fresh).forEach(function (k) { if (!pos[k]) pos[k] = fresh[k]; });

    placeNodes();
    edges = computeEdges(plan);
    redraw();

    if (!stageEl.__bound) {
      stageEl.__bound = true;
      stageEl.addEventListener("pointerdown", onDown);
      stageEl.addEventListener("pointermove", onMove);
      stageEl.addEventListener("pointerup", onUp);
      stageEl.addEventListener("pointercancel", onUp);
      stageEl.addEventListener("dblclick", function (e) {
        if (!e.target.closest(".cv-node")) { focusId = null; redraw(); }
      });
    }
  }

  function auto(plan) {
    var rect = stageEl ? stageEl.getBoundingClientRect() : { width: 1100, height: 460 };
    pos = autoLayout(plan, rect.width || 1100, rect.height || 460);
    placeNodes(); edges = computeEdges(plan); redraw(); savePos(plan);
  }
  function reset(plan) {
    try {
      var all = loadAll();
      delete all[sig(plan)];
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) { /* noop */ }
    auto(plan);
  }

  window.MODBAY_CANVAS = {
    view: view, mount: mount, auto: auto, reset: reset,
    edgesOf: computeEdges, positions: function () { return pos; }
  };
})();
