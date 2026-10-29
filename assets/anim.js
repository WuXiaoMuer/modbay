/* ============ MODBAY 动效编排 ============
 * 纯增强层：不改变任何业务逻辑与文本内容，只加 class / 事件。
 */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 品牌标识 ---------- */
  function mountBrand() {
    var el = document.getElementById("brand-mark");
    if (el && window.MODBAY_ICON) el.innerHTML = window.MODBAY_ICON.brandMark(26);
  }

  /* ---------- stagger 序号 ---------- */
  function assignStagger() {
    document.querySelectorAll(".stagger").forEach(function (box) {
      var i = 0;
      Array.prototype.forEach.call(box.children, function (c) {
        if (c.nodeType !== 1) return;
        if (c.classList.contains("is-skip")) return;
        c.style.setProperty("--i", String(Math.min(i, 12)));
        i++;
      });
    });
  }

  /* ---------- 卡片网格自动 stagger ---------- */
  function autoStagger() {
    [".cards", ".plaza-grid", ".feat-grid", ".orders-list", ".guide-grid"].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (box) {
        if (!box.classList.contains("stagger")) box.classList.add("stagger");
      });
    });
  }

  /* ---------- 视图入场 ---------- */
  var app = null;
  function playView() {
    if (!app) return;
    app.classList.remove("view-enter");
    /* 强制回流，保证动画重放 */
    void app.offsetWidth;
    app.classList.add("view-enter");
  }

  /* ---------- 接线图：线束归组 + 悬停高亮 ---------- */
  function wireInteract() {
    document.querySelectorAll(".wiring svg").forEach(function (svg) {
      if (svg.dataset.wired === "1") return;
      svg.dataset.wired = "1";
      var paths = svg.querySelectorAll("path[stroke]");
      Array.prototype.forEach.call(paths, function (p, i) {
        if (p.getAttribute("fill") !== "none") return;
        p.classList.add("wire");
        var len = 0;
        try { len = Math.ceil(p.getTotalLength()); } catch (e) { len = 900; }
        p.style.setProperty("--len", String(len));
        p.style.animationDelay = (reduce ? 0 : i * 26) + "ms";
        var owner = p.closest("[data-wire-mod]");
        if (owner) p.dataset.owner = owner.getAttribute("data-wire-mod");
      });
      var wrap = svg.closest(".wiring");
      if (wrap && !wrap.dataset.wired) {
        wrap.dataset.wired = "1";
        svg.addEventListener("pointerover", function (e) {
          var g = e.target.closest && e.target.closest("[data-wire-mod]");
          if (!g) return;
          var id = g.getAttribute("data-wire-mod");
          wrap.classList.add("is-focus");
          Array.prototype.forEach.call(svg.querySelectorAll(".wire"), function (p) {
            p.classList.toggle("is-hi", p.dataset.owner === id);
          });
        });
        svg.addEventListener("pointerout", function () {
          wrap.classList.remove("is-focus");
          Array.prototype.forEach.call(svg.querySelectorAll(".wire"), function (p) { p.classList.remove("is-hi"); });
        });
      }
    });
  }

  /* ---------- 主按钮光斑跟随 ---------- */
  function bindButtonGlow() {
    document.querySelectorAll(".btn-primary").forEach(function (b) {
      if (b.dataset.glow) return;
      b.dataset.glow = "1";
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
        b.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
      });
    });
  }

  /* ---------- 数字入场（不改文本） ---------- */
  function popNumbers() {
    document.querySelectorAll(".stat .v, .metric .v, .kpi .v").forEach(function (el) {
      if (el.dataset.popped) return;
      el.dataset.popped = "1";
      el.classList.add("num-pop");
    });
  }

  /* ---------- 滚动进度条 ---------- */
  var bar = null;
  function initScrollBar() {
    if (bar) return;
    bar = document.createElement("div");
    bar.className = "scroll-progress";
    document.body.appendChild(bar);
    var tick = function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
      bar.style.width = (p * 100).toFixed(2) + "%";
      bar.classList.toggle("is-on", p > 0.01 && p < 0.99);
    };
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    tick();
  }

  /* ---------- 统一增强 ---------- */
  var timer = null;
  function enhance() {
    mountBrand();
    autoStagger();
    assignStagger();
    wireInteract();
    bindButtonGlow();
    popNumbers();
  }
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(enhance, 30);
  }

  function boot() {
    app = document.getElementById("app");
    mountBrand();
    enhance();
    playView();
    initScrollBar();
    if (app) {
      new MutationObserver(function () { playView(); schedule(); })
        .observe(app, { childList: true, subtree: false });
    }
    /* 弹层出现时也补一次增强 */
    new MutationObserver(schedule).observe(document.body, { childList: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.MODBAY_MOTION = { enhance: enhance, play: playView };
})();
