/* ============ MODBAY 主控：路由 / 页脚 / 事件绑定 / 导出分享 ============ */
(function () {
  "use strict";
  var M = window.M, U = window.MODBAY_UI;
  var app = document.getElementById("app");
  var foot = document.getElementById("foot");
  var footDone = false;

  var BRAND = '<svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true">' +
    '<rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="none" stroke="var(--accent)" stroke-width="2"/>' +
    '<circle cx="12" cy="12" r="3.4" fill="var(--accent)"/>' +
    '<path d="M7 12h2.2M14.8 12H17" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>';

  /* ---------- 路由 ---------- */
  function parseHash() {
    var h = location.hash.replace(/^#/, "") || "/";
    var qi = h.indexOf("?");
    return { path: (qi === -1 ? h : h.slice(0, qi)) || "/", query: qi === -1 ? "" : h.slice(qi + 1) };
  }

  function render(scroll) {
    var act = document.activeElement;
    var searchEl = act && (act.className === "lib-search" || act.id === "lib-search") ? act : null;
    var caret = searchEl ? searchEl.selectionStart : null;
    var r = parseHash();
    /* 广场分享方案 /plan/:pid 与普通方案页 /plan?p= 区分 */
    var pid = null;
    if (r.path.indexOf("/plan/") === 0) pid = r.path.slice("/plan/".length);
    var html;
    if (r.path === "/explore") html = window.MODBAY_VIEW_EXPLORE();
    else if (r.path === "/build") html = window.MODBAY_VIEW_BUILD();
    else if (pid) html = '<div id="plan-loading" class="view-inner"><div class="bay-empty" style="padding:56px 24px">正在加载广场方案…</div></div>';
    else if (r.path === "/plan") html = window.MODBAY_VIEW_PLAN(r.query);
    else if (r.path === "/guide") html = window.MODBAY_VIEW_GUIDE();
    else if (r.path === "/checkout") html = window.MODBAY_VIEW_CHECKOUT();
    else if (r.path === "/orders") html = window.MODBAY_VIEW_ORDERS();
    else if (r.path === "/admin") html = window.MODBAY_VIEW_ADMIN();
    else if (r.path === "/plaza") html = window.MODBAY_VIEW_PLAZA();
    else if (r.path === "/" || r.path === "") html = window.MODBAY_VIEW_HOME();
    else html = notFound(r.path);
    app.innerHTML = html;
    if (!footDone) { foot.innerHTML = footHtml(); footDone = true; }
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-nav") === r.path);
    });
    if (searchEl) {
      var el = document.querySelector(searchEl.id ? "#" + searchEl.id : ".lib-search");
      if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { /* noop */ } }
    }
    /* 异步挂载的广场数据 */
    var v3 = document.getElementById("view3d");
    if (v3 && window.MODBAY_3D) window.MODBAY_3D.mount(v3, M.check());
    if (document.getElementById("cv-stage") && window.MODBAY_CANVAS) window.MODBAY_CANVAS.mount(M.check());
    if (pid) {
      window.MODBAY_VIEW_PLAN_SHARED(pid).then(function (h) {
        if (parseHash().path === "/plan/" + pid) app.innerHTML = h;
      });
    } else if (r.path === "/plaza") {
      window.MODBAY_MOUNT_PLAZA();
    } else if (r.path === "/") {
      window.MODBAY_MOUNT_HOME_HOT();
    }
    if (scroll) window.scrollTo(0, 0);
  }

  function notFound(path) {
    return '<div class="sec-head"><span class="sec-label">404 · NOT FOUND</span><h2 class="sec-title">这个页面不存在</h2>' +
      '<p class="sec-desc">路由 <span class="mono">#' + M.esc(path) + "</span> 没有对应页面——可能链接打错了，或旧链接已失效。</p></div>" +
      '<div class="bay-empty" style="padding:48px 24px"><b>要不要去这些地方看看</b>' +
      '<div style="display:flex;gap:12px;justify-content:center;margin-top:16px;flex-wrap:wrap">' +
      '<button class="btn btn-primary" data-act="goto" data-hash="#/">回首页</button>' +
      '<button class="btn btn-ghost" data-act="goto" data-hash="#/plaza">方案广场</button>' +
      '<button class="btn btn-ghost" data-act="goto" data-hash="#/build">选型配置台</button>' +
      '<button class="btn btn-line" data-act="goto" data-hash="#/orders">我的订单</button></div></div>';
  }

  window.MODBAY_RERENDER = function () { render(false); };

  function footHtml() {
    var cats = M.CATS.map(function (c) {
      return '<a href="javascript:void(0)" data-act="catgoto" data-id="' + c.id + '">' + M.esc(c.name) + "</a>";
    }).join("");
    return '<div class="foot-inner">' +
      '<div><div class="brand" style="margin-bottom:14px">' + BRAND + "MODBAY <small>模块湾</small></div>" +
      '<p class="foot-note">硬件选型配置台：把开发板、传感器、电机拼成你的方案，实时校验引脚占用 / I2C 地址 / 电源预算 / 逻辑电平。页面参数为教学演示量级，非采购报价。</p>' +
      U.heatStrip() + '<p class="mono" style="font-size:11px;color:var(--faint);margin-top:8px">选型热度 · 近 12 周（本机操作统计）</p></div>' +
      '<div><h4>硬件分类</h4>' + cats + "</div>" +
      '<div><h4>平台</h4><a href="#/guide">平台指南</a><a href="#/build">选型配置台</a><a href="#/orders">我的订单</a><a href="#/admin">演示后台</a>' +
      '<a href="https://github.com/WuXiaoMuer" target="_blank" rel="noopener">GitHub · WuXiaoMuer ↗</a>' +
      '<a href="https://getartcraft.com/" target="_blank" rel="noopener">设计语言参考 ArtCraft ↗</a></div></div>' +
      '<div class="foot-bottom"><div class="foot-inner"><p>MODBAY · 硬件定制平台概念站 — vanilla HTML / CSS / JS, zero build</p></div></div>';
  }

  /* ---------- 方案导出 / 复制 / 分享 ---------- */
  function planJson() {
    var plan = M.check();
    return {
      app: "MODBAY", version: 1, generatedAt: new Date().toISOString(),
      board: plan.board ? { id: plan.board.id, name: plan.board.name, price: plan.board.price, logic: plan.board.logic, gpio: plan.board.gpio } : null,
      items: plan.items.map(function (it) {
        return { id: it.mod.id, name: it.mod.name, qty: it.qty, unitPrice: it.mod.price, bus: it.mod.bus, addr: it.mod.addr || null, rail: it.mod.rail, currentMa: it.mod.ma };
      }),
      totals: { components: M.totalCount(), bomCNY: M.totalPrice() },
      checks: {
        pass: plan.pass,
        errors: plan.errs.map(function (c) { return { code: c.code, title: c.title, hint: c.hint }; }),
        warnings: plan.warns.map(function (c) { return { code: c.code, title: c.title, hint: c.hint }; })
      },
      power: plan.rails,
      pinMap: plan.alloc ? plan.alloc.rows.map(function (r) { return { module: r.mod.id, signals: r.signals }; }) : []
    };
  }
  function exportJson() {
    var blob = new Blob([JSON.stringify(planJson(), null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modbay-plan.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    U.toast("方案 JSON 已开始下载");
  }
  function bomMarkdown() {
    var plan = M.check();
    var l = ["# MODBAY 方案清单", ""];
    if (plan.board) l.push("- 基座：" + plan.board.name + " ×1 — " + M.fmtMoney(plan.board.price));
    plan.items.forEach(function (it) { l.push("- " + it.mod.name + " ×" + it.qty + " — " + M.fmtMoney(it.mod.price) + "/件"); });
    l.push("", "**合计：" + M.fmtMoney(M.totalPrice()) + "**（" + M.totalCount() + " 件）", "", "## 校验结果");
    l.push("错误 " + plan.errs.length + " 项，警告 " + plan.warns.length + " 项");
    plan.errs.concat(plan.warns).forEach(function (c) { l.push("- " + c.title + "：" + c.hint); });
    return l.join("\n");
  }
  function downloadFile(name, text) {
    try {
      var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
      U.toast("已下载：" + name);
    } catch (e) { U.toast("下载失败，请手动复制", "error"); }
  }

  function copyText(text, msg) {
    var ok = function () { U.toast(msg); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); ok(); } catch (e) { U.toast("复制失败，请手动选择文本", "error"); }
      ta.remove();
    }
  }
  function sharePlan() {
    var url = location.href.split("#")[0] + "#/plan?p=" + M.encodePlan();
    copyText(url, "分享链接已复制，发给队友即可还原方案");
  }

  /* ---------- 主题 ---------- */
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", cur);
    try { localStorage.setItem("modbay.theme", cur); } catch (e) { /* noop */ }
  }

  /* ---------- 事件 ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!t) return;
    var act = t.getAttribute("data-act");
    var id = t.getAttribute("data-id");
    switch (act) {
      case "goto":
        e.preventDefault();
        location.hash = t.getAttribute("data-hash");
        break;
      case "cat":
        M.ui.cat = id;
        render(true);
        break;
      case "delivery":
        M.ui.delivery = id === "built" ? "built" : "kit";
        render(false);
        break;
      case "clearsearch":
        M.ui.q = "";
        render(false);
        break;
      case "catgoto":
        M.ui.cat = id;
        if (parseHash().path === "/explore") render(true);
        else location.hash = "#/explore";
        break;
      case "add": {
        if (!M.ALL[id]) break;
        var isBoard = M.ALL[id].cat === "board";
        M.addItem(id);
        U.toast(isBoard ? "基座已设为：" + M.ALL[id].name : "已加入：" + M.ALL[id].name);
        render(false);
        break;
      }
      case "setboard":
        M.setBoard(id);
        U.toast("基座已设为：" + M.ALL[id].name);
        render(false);
        break;
      case "qty":
        if (!M.ALL[id]) break;
        M.qty(id, parseInt(t.getAttribute("data-d"), 10) || 0);
        render(false);
        break;
      case "del":
        if (!M.ALL[id]) break;
        M.delItem(id);
        U.toast("已移除：" + M.ALL[id].name);
        render(false);
        break;
      case "clear":
        M.clearAll();
        U.toast("配置台已清空");
        render(false);
        break;
      case "preset": {
        var p = M.PRESETS.filter(function (x) { return x.id === id; })[0];
        if (p) {
          M.setBoard(p.board);
          M.state.items = {};
          Object.keys(p.items).forEach(function (k) { M.state.items[k] = p.items[k]; });
          M.save();
          M.track(3);
          U.toast("已载入预设：" + p.name);
          if (parseHash().path === "/build") render(true);
          else location.hash = "#/build";
        }
        break;
      }
      case "toplan":
        M.track(2);
        if (!M.state.board && !M.totalCount()) {
          U.toast("先选一块基座和若干模块", "error");
          location.hash = "#/explore";
        } else {
          location.hash = "#/plan?p=" + M.encodePlan();
        }
        break;
      case "copy":
        copyText(bomMarkdown(), "BOM 清单已复制（Markdown）");
        break;
      case "share":
        sharePlan();
        break;
      case "export":
        exportJson();
        break;
      case "print":
        window.print();
        break;
      case "theme":
        toggleTheme();
        break;
      /* ---- 软件方案 ---- */
      case "code-file": {
        var path = t.getAttribute("data-path");
        if (!window.MODBAY_CODE) break;
        window.MODBAY_CODE.setFile(path);
        var fl = window.MODBAY_CODE.files(M.check());
        var f = fl.filter(function (x) { return x.path === path; })[0];
        var pane = document.getElementById("code-pane");
        if (f && pane) {
          pane.innerHTML = window.MODBAY_CODE.paneHtml(f);
          document.querySelectorAll(".code-file").forEach(function (b) {
            b.classList.toggle("is-on", b.getAttribute("data-path") === path);
          });
        }
        break;
      }
      case "code-copy": {
        var cpath = t.getAttribute("data-path");
        var cf = window.MODBAY_CODE.files(M.check()).filter(function (x) { return x.path === cpath; })[0];
        if (cf) copyText(cf.body, "已复制：" + cpath);
        break;
      }
      case "code-dl": {
        var dpath = t.getAttribute("data-path");
        var df = window.MODBAY_CODE.files(M.check()).filter(function (x) { return x.path === dpath; })[0];
        if (df) downloadFile(dpath.split("/").pop(), df.body);
        break;
      }
      case "code-dlall": {
        var all = window.MODBAY_CODE.files(M.check());
        var NL = String.fromCharCode(10);
        var bundle = all.map(function (x) {
          return "/* ===== " + x.path + " ===== */" + NL + x.body;
        }).join(NL + NL);
        downloadFile("modbay-software.txt", bundle);
        U.toast("已导出 " + all.length + " 个文件（合并为 txt）");
        break;
      }
      case "sw":
        M.ui.sw = id;
        render(false);
        break;
      /* ---- 自由画板 ---- */
      case "cv-auto":
        window.MODBAY_CANVAS.auto(M.check());
        U.toast("已重新排布");
        break;
      case "cv-reset":
        window.MODBAY_CANVAS.reset(M.check());
        U.toast("已清除自定义位置");
        break;
    }
  });

  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el && (el.className === "lib-search" || el.id === "lib-search")) {
      M.ui.q = el.value;
      var mini = document.getElementById("lib-mini-list");
      if (mini) mini.innerHTML = window.MODBAY_LIB_LIST();
      else render(false);
    }
  });

  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el && el.id === "lib-sort") {
      M.ui.sort = el.value;
      render(false);
      var s = document.getElementById("lib-sort");
      if (s) s.value = el.value;
    } else if (el && el.id === "board-select") {
      if (el.value) { M.setBoard(el.value); U.toast("基座已更换"); }
      else { M.setBoard(null); U.toast("已移除基座"); }
      render(false);
    }
  });

  /* Esc 关闭浮层（键盘可达性） */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" || e.keyCode === 27) {
      ["pay-modal", "plaza-publish"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.remove();
      });
    }
  });

  window.addEventListener("hashchange", function () { render(true); });

  /* ---------- 启动 ---------- */
  M.load();
  try {
    var th = localStorage.getItem("modbay.theme");
    document.documentElement.setAttribute("data-theme", th === "light" ? "light" : "dark");
  } catch (e) { document.documentElement.setAttribute("data-theme", "dark"); }
  render(true);
})();
