/* ============ MODBAY 视图：首页 ============ */
(function () {
  "use strict";
  var M = window.M, U = window.MODBAY_UI;

  function viewHome() {
    var stats = [
      { n: String(M.MODULES.length), s: "功能模块" },
      { n: String(M.BOARDS.length), s: "基座主控" },
      { n: String(M.CATS.length), s: "硬件大类" },
      { n: "9", s: "条实时校验规则" }
    ];
    var marquee = M.MODULES.map(function (m) {
      return '<span class="marquee-item">' + M.esc(m.name) + " <i>◆</i></span>";
    }).join("");
    var feats = [
      { g: "board", n: "01", name: "浏览 EXPLORE", p: "六大类硬件、每块板的电流 / 电平 / 接口 / 引脚余量全部摊开写，不搞参数黑箱。" },
      { g: "sensor", n: "02", name: "组合 COMPOSE", p: "一块基座 + 任意模块，或直接从预设方案一键载入，加减数量即时生效。" },
      { g: "check", n: "03", name: "校验 VALIDATE", p: "I2C 地址冲突、GPIO 抢占、电源轨超载、逻辑电平错配——下单前先替你排雷。" },
      { g: "bolt", n: "04", name: "预览 SHIP", p: "自动生成接线示意、引脚分配表、BOM 报价，导出 JSON 或分享链接给队友。" }
    ].map(function (f) {
      return '<div class="feat"><div class="feat-num">' + f.n + " / " + f.g.toUpperCase() + "</div>" +
        '<div class="feat-name">' + f.name + "</div><p>" + f.p + "</p>" +
        '<div class="feat-art">' + U.featArt(f.g) + "</div></div>";
    }).join("");

    var presets = M.PRESETS.map(function (p) {
      var board = M.ALL[p.board];
      var count = Object.keys(p.items).reduce(function (s, k) { return s + p.items[k]; }, 0) + 1;
      var price = board.price + Object.keys(p.items).reduce(function (s, k) { return s + M.ALL[k].price * p.items[k]; }, 0);
      return '<div class="feat"><div class="feat-num" style="color:' + U.catCss(board.cat) + '">' + U.presetIcon(p.icon) + "</div>" +
        '<div class="feat-name">' + M.esc(p.name) + "</div><p>" + M.esc(p.story) + "</p>" +
        '<div class="mcard-meta"><span class="kv">' + count + ' 件</span><span class="kv">' + M.fmtMoney(price) + "</span></div>" +
        '<div class="feat-art"><button class="btn btn-ghost btn-sm" data-act="preset" data-id="' + p.id + '">载入到配置台 →</button></div></div>';
    }).join("");

    return '' +
      '<section class="hero"><div>' +
      '<p class="hero-kicker">// MODBAY · 硬件选型配置台 <b>v0.9</b></p>' +
      '<h1 class="hero-title">把硬件，<br><em>拼成</em>你想要的样子。</h1>' +
      '<p class="hero-sub">开发板、传感器、电机、通信、电源——' + M.MODULES.length + ' 个模块自由组合。引脚占用、I2C 地址、电源预算、逻辑电平实时校验，方案一键导出。</p>' +
      '<div class="hero-cta">' +
      '<button class="btn btn-primary" data-act="goto" data-hash="#/build">开始选型 →</button>' +
      '<button class="btn btn-ghost" data-act="goto" data-hash="#/explore">浏览模块库</button>' +
      "</div></div>" +
      '<div class="hero-art">' + U.heroArt() + "</div></section>" +

      '<div class="stat-strip">' + stats.map(function (s) {
        return '<div class="stat"><b>' + s.n + "</b><span>" + s.s + "</span></div>";
      }).join("") + "</div>" +

      '<div class="marquee"><div class="marquee-track">' + marquee + marquee + "</div></div>" +

      '<section class="sec"><div class="sec-head"><span class="sec-label">01 / HOW IT WORKS</span>' +
      '<h2 class="sec-title">从浏览到落焊，四步闭环</h2></div>' +
      '<div class="feat-grid">' + feats + "</div></section>" +

      '<section class="sec"><div class="sec-head"><span class="sec-label">02 / TEMPLATES</span>' +
      '<h2 class="sec-title">从一份预设方案开始</h2>' +
      '<p class="sec-desc">载入后仍可自由增删模块，校验规则实时生效。</p></div>' +
      '<div class="feat-grid">' + presets + "</div></section>" +
      '<section class="sec" id="plaza-hot-slot"></section>';
  }

  window.MODBAY_VIEW_HOME = viewHome;
})();
