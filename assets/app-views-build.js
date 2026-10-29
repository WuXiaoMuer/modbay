/* ============ MODBAY 视图：选型配置台 ============ */
(function () {
  "use strict";
  var M = window.M, U = window.MODBAY_UI;

  function libMiniList() {
    var list = M.BOARDS.concat(M.MODULES).filter(function (m) {
      if (M.ui.cat !== "all" && m.cat !== M.ui.cat) return false;
      var q = M.ui.q.trim().toLowerCase();
      if (!q) return true;
      return (m.name + " " + (m.brand || "") + " " + (m.tags || []).join(" ") + " " + m.desc).toLowerCase().indexOf(q) > -1;
    });
    if (M.ui.sort === "price-asc") list.sort(function (a, b) { return a.price - b.price; });
    else if (M.ui.sort === "price-desc") list.sort(function (a, b) { return b.price - a.price; });
    else if (M.ui.sort === "ma-asc") list.sort(function (a, b) { return (a.ma || 0) - (b.ma || 0); });
    if (!list.length) {
      return '<div class="bay-empty" style="padding:22px">没有匹配模块' +
        '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px">' +
        (M.ui.cat !== "all" ? '<button class="btn btn-ghost btn-sm" data-act="cat" data-id="all">清除分类</button>' : "") +
        (M.ui.q ? '<button class="btn btn-line btn-sm" data-act="clearsearch">清空搜索</button>' : "") +
        "</div></div>";
    }
    return list.map(function (m) {
      var isBoard = m.cat === "board";
      var cur = M.state.board === m.id;
      var sub = isBoard
        ? m.logic + " · " + m.gpio + "GPIO"
        : U.BUS_LABEL[m.bus] + (m.addr ? " " + m.addr : "") + " · " + U.RAIL_LABEL[m.rail] + " · " + M.fmtMa(m.ma);
      return '<button class="mini" data-act="' + (isBoard ? "setboard" : "add") + '" data-id="' + m.id + '"' +
        ' title="' + (isBoard ? (cur ? "当前基座" : "设为基座") : "加入配置台") + '">' +
        '<span class="mini-art">' + U.modArt(m.id, m.cat) + "</span>" +
        '<span class="mini-info"><span class="mini-name">' + M.esc(m.name) + '</span><span class="mini-meta">' + M.esc(sub) + "</span></span>" +
        '<span class="mini-price">' + M.fmtMoney(m.price) + '</span>' +
        '<span class="mini-plus"' + (isBoard ? ' style="border-color:' + U.catCss("board") + '"' : "") + ">" + (isBoard ? (cur ? "✓" : "基") : "+") + "</span></button>";
    }).join("");
  }

  function bayPanel() {
    var b = M.state.board ? M.ALL[M.state.board] : null;
    var boardOpts = M.BOARDS.map(function (x) {
      return '<option value="' + x.id + '"' + (M.state.board === x.id ? " selected" : "") + ">" + M.esc(x.name) + " · " + M.fmtMoney(x.price) + "</option>";
    }).join("");
    var inner = "";
    if (!b) {
      inner = '<div class="bay-empty"><b>还没有选基座</b>主控决定 IO 电平、GPIO 数量与电源预算。从下拉框选一块，或去模块库挑。</div>';
    } else {
      var items = M.planItems();
      var firstPin = {};
      var plan = M.check();
      (plan.alloc ? plan.alloc.rows : []).forEach(function (r) {
        if (!firstPin[r.mod.id]) firstPin[r.mod.id] = r.signals.map(function (s) { return s.name + " " + s.pin; }).join(" / ");
      });
      var slots = items.map(function (it) {
        var m = it.mod;
        var pinTxt;
        if (m.provides) {
          pinTxt = Object.keys(m.provides).map(function (k) { return (m.outV || (k === "ext" ? 12 : 5)) + "V / " + M.fmtMa(m.provides[k]); }).join("，") + " 外供";
        } else if (m.solves === "level") {
          pinTxt = "3.3↔5V 桥接";
        } else {
          pinTxt = firstPin[m.id] || U.BUS_LABEL[m.bus];
        }
        return '<div class="slot"><span class="slot-bar" style="background:' + U.catCss(m.cat) + '"></span>' +
          '<span class="slot-name" title="' + M.esc(m.name) + '">' + M.esc(m.name) + "</span>" +
          '<span class="slot-pins">' + M.esc(pinTxt) + "</span>" +
          '<span class="qty"><button data-act="qty" data-id="' + m.id + '" data-d="-1" aria-label="减少">−</button><span>' + it.qty + '</span><button data-act="qty" data-id="' + m.id + '" data-d="1" aria-label="增加">+</button></span>' +
          '<button class="slot-del" data-act="del" data-id="' + m.id + '" aria-label="移除">✕</button></div>';
      }).join("");
      inner = '<div class="bay-board"><div class="bay-board-top">' +
        '<span class="bay-board-art">' + U.modArt(b.id, b.cat) + "</span>" +
        '<div style="flex:1;min-width:0"><div class="bay-board-name">' + M.esc(b.name) + '</div>' +
        '<div class="bay-board-sub">' + b.logic + " IO · " + b.gpio + " GPIO · 3.3V " + M.fmtMa(b.supply3v3) + " · 5V " + (b.supply5v ? M.fmtMa(b.supply5v) : "—") + "</div></div></div>" +
        '<div style="margin-top:10px"><select class="select" id="board-select" style="width:100%" aria-label="选择基座">' +
        '<option value="">— 更换 / 移除基座 —</option>' + boardOpts + "</select></div>" +
        '<div class="slot-list">' + (slots || '<div class="bay-empty" style="margin-top:12px">还没有功能模块，从左边挑几个。</div>') + "</div></div>";
    }
    if (!M.state.board) {
      inner = '<div style="margin-bottom:10px"><select class="select" id="board-select" style="width:100%" aria-label="选择基座">' +
        '<option value="">— 选择基座 —</option>' + boardOpts + "</select></div>" + inner;
    }
    return '<section class="panel panel-bay"><div class="panel-head"><h3>基座与选型</h3>' +
      '<span class="mono">' + M.totalCount() + " 件</span></div>" +
      '<div class="panel-body">' + inner + "</div></section>";
  }

  function checkPanel() {
    var plan = M.check();
    var badge = plan.errs.length
      ? '<span class="plan-badge" style="color:var(--danger);border-color:var(--danger)">' + plan.errs.length + " 项错误</span>"
      : plan.warns.length
        ? '<span class="plan-badge" style="color:var(--warn);border-color:var(--warn)">' + plan.warns.length + " 项警告</span>"
        : '<span class="plan-badge" style="color:var(--ok);border-color:var(--ok)">校验通过</span>';
    var list = plan.errs.concat(plan.warns, plan.oks.filter(function (x) { return x.hint; }).slice(0, 4));
    var items = list.map(function (c) {
      var ic = c.sev === "error" ? "✕" : c.sev === "warn" ? "!" : "✓";
      return '<div class="check check-' + c.sev + '"><span class="check-ic">' + ic + '</span><div><div class="check-title">' + M.esc(c.title) + "</div>" +
        (c.hint ? '<div class="check-hint">' + M.esc(c.hint) + "</div>" : "") + "</div></div>";
    }).join("");
    var rails = "";
    if (plan.rails) {
      Object.keys(plan.rails).forEach(function (k) {
        var r = plan.rails[k];
        if (r.used === 0 && r.max === 0) return;
        var pct = r.max ? Math.min(100, Math.round(r.used / r.max * 100)) : (r.used ? 100 : 0);
        var over = r.used > r.max;
        rails += '<div class="rail ' + (over ? "over" : r.used ? "ok" : "") + '"><div class="rail-head"><b>' + r.label + "</b>" +
          "<span>" + M.fmtMa(r.used) + " / " + (r.max ? M.fmtMa(r.max) : "无电源") + (r.extra ? "（含外供 " + M.fmtMa(r.extra) + "）" : "") + "</span></div>" +
          '<div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
      });
    }
    return '<section class="panel panel-checks"><div class="panel-head"><h3>实时校验</h3>' + badge + "</div>" +
      '<div class="panel-body"><div class="check-list">' + (items || '<div class="check check-ok"><span class="check-ic">✓</span><div><div class="check-title">等待选型</div></div></div>') + "</div>" +
      (rails ? '<div style="margin-top:16px"><h4 class="mono" style="font-size:11px;letter-spacing:.1em;color:var(--muted);margin-bottom:10px">电源预算 POWER BUDGET</h4>' + rails + "</div>" : "") +
      '<div class="bom-total"><div><b>' + M.fmtMoney(M.totalPrice()) + '</b><br><span>BOM 合计 · ' + M.totalCount() + " 件组件</span></div>" +
      '<button class="btn btn-primary btn-sm" data-act="toplan">生成方案 →</button></div>' +
      "</div></section>";
  }

  function viewBuild() {
    var chips = [{ id: "all", name: "全部", ico: "grid" }].concat(M.CATS.map(function (c) {
      return { id: c.id, name: c.name, ico: c.id };
    })).map(function (c) {
      var ico = window.MODBAY_ICON.icon(c.ico, { size: 14 });
      return '<button class="fchip' + (M.ui.cat === c.id ? " active" : "") + '" data-act="cat" data-id="' + c.id + '">' +
        ico + "<span>" + M.esc(c.name) + "</span></button>";
    }).join("");
    return '' +
      '<div class="sec-head" style="margin-bottom:18px"><span class="sec-label">CONFIGURATOR</span>' +
      '<h2 class="sec-title">选型配置台</h2>' +
      '<p class="sec-desc">先定基座，再加模块。右侧校验报告随每次操作实时重算。</p>' +
      '<div style="margin-left:auto"><button class="btn btn-line btn-sm" data-act="clear">清空配置</button></div></div>' +
      '<div class="build-grid">' +
      '<section class="panel panel-lib"><div class="panel-head"><h3>模块库</h3><span class="mono">CLICK TO ADD</span></div>' +
      '<div class="panel-body" style="border-bottom:1px solid var(--line)">' +
      '<div class="filterbar" style="margin-bottom:0">' + chips + "</div>" +
      '<div class="searchbox" style="margin-top:10px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
      '<input class="lib-search" type="search" placeholder="搜索模块…" value="' + M.esc(M.ui.q) + '" autocomplete="off" style="width:100%"></div></div>' +
      '<div class="panel-body panel-scroll"><div class="mini-list" id="lib-mini-list">' + libMiniList() + "</div></div></section>" +
      bayPanel() + checkPanel() + "</div>" +
      '<div class="mobile-bar"><div><span class="mb-total">' + M.fmtMoney(M.totalPrice()) + '</span><span class="mb-sub">' + M.totalCount() + " 件 · 实时校验中</span></div>" +
      '<button class="btn btn-primary btn-sm" data-act="toplan">生成方案 →</button></div>';
  }

  window.MODBAY_VIEW_BUILD = viewBuild;
  window.MODBAY_LIB_LIST = libMiniList;
})();
