/* ============ MODBAY 视图层：工具 + 程序化 SVG 素材 ============ */
(function () {
  "use strict";
  var M = window.M;

  function catCss(cat) { return "var(" + (M.CATMAP[cat] ? M.CATMAP[cat].cssVar : "--cat-board") + ")"; }
  function catName(cat) { return M.CATMAP[cat] ? M.CATMAP[cat].name : cat; }

  var BUS_LABEL = { i2c: "I2C", spi: "SPI", uart: "UART", gpio: "GPIO", adc: "ADC", pwm: "PWM", none: "—" };
  var RAIL_LABEL = { "3v3": "3.3V", "5v": "5V", ext: "外供" };

  /* 模块实拍图（AI 生成素材，assets/mod/）：优先按型号匹配，其次按类目兜底 */
  /* 图片清单由 assets/mod/manifest.js 生成；有图用图，无图退回类目插画 */
  var MOD_PHOTO = window.MOD_PHOTOS || {};
  /* 类目群像图保留给「方案广场」等小卡片使用；模块库走「精确图 + 差异化插画」 */
  var CAT_PHOTO = {};

  /* 模块配图：有实拍图用实拍图，没有则退回程序化 PCB 示意图 */
  function modArt(id, cat) {
    var file = MOD_PHOTO[id] ? id : (CAT_PHOTO[cat] || null);
    if (file) {
      return '<img class="mod-img" src="assets/mod/' + file + '.webp" alt="" decoding="async">';
    }
    return modArtSvg(id, cat);
  }

  /* 类目插画：每个类目再按 id 哈希分 2–4 个子形态，
     让同类的不同器件也有辨识度（避免「一个模块图用到底」） */
  function catGlyphArt(id, cat) {
    var h = M.hashStr(id);
    var c = catCss(cat);
    var n = 5 + (h % 5);
    var head = '<svg viewBox="0 0 100 60" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<rect x="6" y="6" width="88" height="48" rx="4" fill="#0d1219" stroke="' + c + '" stroke-opacity=".35"/>';
    var g = "";
    var v = h % 4;

    if (cat === "sensor") {
      if (v === 0) {
        var pts = [];
        for (var i2 = 0; i2 <= 12; i2++) {
          pts.push((14 + i2 * 6) + "," + (30 + Math.sin(i2 * 0.9 + h % 7) * (8 + h % 6)).toFixed(1));
        }
        g = '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linecap="round"/>' +
          '<circle cx="82" cy="20" r="6" fill="none" stroke="' + c + '" stroke-width="1.8"/>' +
          '<circle cx="82" cy="20" r="2" fill="' + c + '"/>';
      } else if (v === 1) {
        g = '<rect x="30" y="14" width="7" height="30" rx="3.5" fill="none" stroke="' + c + '" stroke-width="2"/>' +
          '<circle cx="33.5" cy="46" r="6" fill="' + c + '" fill-opacity=".8"/>' +
          '<rect x="32" y="26" width="3" height="18" fill="' + c + '"/>' +
          '<g stroke="' + c + '" stroke-width="1.6" stroke-opacity=".5">' +
          Array.from({ length: n }, function (_, k) {
            return '<path d="M42 ' + (18 + k * 5) + 'h5"/>';
          }).join("") + "</g>";
      } else if (v === 2) {
        g = '<rect x="16" y="18" width="44" height="24" rx="3" fill="none" stroke="' + c + '" stroke-width="1.8"/>' +
          '<circle cx="28" cy="30" r="7" fill="' + c + '" fill-opacity=".35" stroke="' + c + '" stroke-width="1.6"/>' +
          '<circle cx="48" cy="30" r="7" fill="' + c + '" fill-opacity=".35" stroke="' + c + '" stroke-width="1.6"/>' +
          '<path d="M66 30h6M74 24v12" stroke="' + c + '" stroke-width="1.8" stroke-linecap="round" stroke-opacity=".6"/>';
      } else {
        g = '<circle cx="34" cy="30" r="10" fill="none" stroke="' + c + '" stroke-width="2"/>' +
          '<circle cx="34" cy="30" r="3.4" fill="' + c + '"/>' +
          '<g stroke="' + c + '" stroke-width="1.8" stroke-linecap="round">' +
          '<path d="M34 14v-4M34 50v4M18 30h-4M50 30h4M23 19l-3-3M45 41l3 3M45 19l3-3M23 41l-3 3"/></g>' +
          '<path d="M64 24h18M64 30h12M64 36h16" stroke="' + c + '" stroke-width="1.6" stroke-opacity=".45" stroke-linecap="round"/>';
      }
    } else if (cat === "actuator") {
      if (v === 0) {
        var teeth = "";
        for (var t = 0; t < 8; t++) {
          var a = t * Math.PI / 4;
          teeth += '<rect x="' + (48 + Math.cos(a) * 12).toFixed(1) + '" y="' + (30 + Math.sin(a) * 12).toFixed(1) +
            '" width="6" height="6" rx="1.5" fill="' + c + '" fill-opacity=".55" transform="rotate(' + (t * 45) + ' 51 33)"/>';
        }
        g = teeth + '<circle cx="51" cy="33" r="11" fill="none" stroke="' + c + '" stroke-width="2.2"/>' +
          '<circle cx="51" cy="33" r="3.4" fill="' + c + '"/>';
      } else if (v === 1) {
        g = '<rect x="24" y="18" width="30" height="22" rx="3" fill="none" stroke="' + c + '" stroke-width="2"/>' +
          '<circle cx="39" cy="18" r="5" fill="' + c + '" fill-opacity=".5" stroke="' + c + '" stroke-width="1.6"/>' +
          '<path d="M39 13V6M39 6h14" stroke="' + c + '" stroke-width="2.4" stroke-linecap="round"/>' +
          '<path d="M58 30h6M58 34h6" stroke="' + c + '" stroke-width="1.6" stroke-opacity=".5"/>';
      } else if (v === 2) {
        g = '<rect x="16" y="22" width="34" height="18" rx="9" fill="none" stroke="' + c + '" stroke-width="2"/>' +
          '<path d="M50 31h14" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/>' +
          '<circle cx="66" cy="31" r="3" fill="' + c + '" fill-opacity=".6"/>' +
          '<path d="M22 40v8M44 40v8" stroke="' + c + '" stroke-width="1.6" stroke-opacity=".5"/>';
      } else {
        g = '<rect x="20" y="16" width="26" height="28" rx="2" fill="none" stroke="' + c + '" stroke-width="2"/>' +
          '<path d="M26 24h14M26 30h14" stroke="' + c + '" stroke-width="1.6" stroke-opacity=".55"/>' +
          '<circle cx="54" cy="24" r="3" fill="' + c + '"/><circle cx="54" cy="38" r="3" fill="' + c + '"/>' +
          '<path d="M54 24l8 10" stroke="' + c + '" stroke-width="1.8"/>';
      }
    } else if (cat === "display") {
      if (v === 0) {
        g = '<rect x="20" y="14" width="42" height="32" rx="3" fill="#05080c" stroke="' + c + '" stroke-width="1.8"/>' +
          '<g fill="' + c + '" fill-opacity=".8">' +
          Array.from({ length: n }, function (_, k) {
            return '<rect x="' + (24 + (k % 5) * 7) + '" y="' + (18 + Math.floor(k / 5) * 7) + '" width="5" height="5" rx="1"/>';
          }).join("") + "</g>";
      } else if (v === 1) {
        g = '<g stroke="' + c + '" stroke-width="2.4" stroke-linecap="round" fill="none">' +
          '<path d="M26 16h12M26 16v14M38 16v14M26 30h12M26 30v14M38 30v14M26 44h12"/>' +
          '<path d="M56 16h12M56 16v14M68 16v14M56 30h12"/></g>';
      } else if (v === 2) {
        g = '<rect x="18" y="20" width="54" height="20" rx="3" fill="#05080c" stroke="' + c + '" stroke-width="1.8"/>' +
          '<g fill="' + c + '">' +
          Array.from({ length: n }, function (_, k) {
            return '<rect x="' + (22 + k * 7) + '" y="26" width="4" height="8" rx="1" opacity="' + (0.3 + k * 0.12).toFixed(2) + '"/>';
          }).join("") + "</g>";
      } else {
        g = '<circle cx="40" cy="30" r="16" fill="none" stroke="' + c + '" stroke-width="2"/>' +
          '<path d="M40 30V18" stroke="' + c + '" stroke-width="2.2" stroke-linecap="round"/>' +
          '<path d="M40 30l10 6" stroke="' + c + '" stroke-width="2.2" stroke-linecap="round" stroke-opacity=".6"/>' +
          '<circle cx="40" cy="30" r="2.4" fill="' + c + '"/>';
      }
    } else if (cat === "comm") {
      if (v % 2 === 0) {
        g = '<g stroke="' + c + '" fill="none" stroke-width="2" stroke-linecap="round">' +
          '<path d="M40 44V26"/><path d="M40 26l-6-8M40 26l6-8"/>' +
          '<path d="M54 20a12 12 0 0 1 0 18" opacity=".7"/>' +
          '<path d="M60 14a20 20 0 0 1 0 30" opacity=".45"/></g>' +
          '<circle cx="40" cy="45" r="2.4" fill="' + c + '"/>';
      } else {
        g = '<rect x="22" y="20" width="24" height="20" rx="3" fill="none" stroke="' + c + '" stroke-width="2"/>' +
          '<path d="M28 20v-6M34 20v-6M40 20v-6M28 40v6M34 40v6M40 40v6" stroke="' + c + '" stroke-width="1.6" stroke-opacity=".6"/>' +
          '<path d="M56 26a8 8 0 0 1 0 12M62 20a16 16 0 0 1 0 24" stroke="' + c + '" fill="none" stroke-width="1.8" opacity=".6"/>';
      }
    } else if (cat === "power") {
      if (v % 2 === 0) {
        g = '<rect x="20" y="22" width="34" height="18" rx="3" fill="none" stroke="' + c + '" stroke-width="2"/>' +
          '<rect x="54" y="27" width="4" height="8" rx="1.5" fill="' + c + '"/>' +
          '<path d="M32 26l-5 8h6l-3 6 8-9h-6z" fill="' + c + '"/>';
      } else {
        g = '<rect x="18" y="18" width="40" height="26" rx="3" fill="none" stroke="' + c + '" stroke-width="2"/>' +
          '<circle cx="32" cy="31" r="7" fill="none" stroke="' + c + '" stroke-width="1.8"/>' +
          '<rect x="44" y="24" width="8" height="14" rx="2" fill="' + c + '" fill-opacity=".55"/>' +
          '<path d="M62 24v14M68 24v14" stroke="' + c + '" stroke-width="1.8" stroke-opacity=".6"/>';
      }
    } else {
      return null;
    }
    return head + g + "</svg>";
  }

  /* 模块 PCB 示意图（按 id 哈希确定性生成，作为实拍图的兜底） */
  function modArtSvg(id, cat) {
    var glyph = catGlyphArt(id, cat);
    if (glyph) return glyph;
    var h = M.hashStr(id);
    var color = catCss(cat);
    var chipX = 30 + (h % 24);
    var chipY = 13 + ((h >> 3) % 12);
    var n = 5 + (h % 4);
    var steps = n > 1 ? 78 / (n - 1) : 0;
    var pins = "";
    for (var i = 0; i < n; i++) {
      pins += '<rect x="' + (10 + i * steps - 2).toFixed(1) + '" y="51" width="4" height="7" rx="1"/>';
    }
    var traces =
      '<path d="M' + chipX + ',' + (chipY + 16) + ' V44"/>' +
      '<path d="M' + (chipX + 26) + ',' + (chipY + 16) + ' V44"/>' +
      (h % 2 === 0 ? '<path d="M' + chipX + ',' + (chipY + 16) + ' H10"/>' : '<path d="M' + (chipX + 26) + ',' + (chipY + 16) + ' H90"/>');
    return '<svg viewBox="0 0 100 60" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<rect x="6" y="6" width="88" height="48" rx="3" fill="#111318" stroke="' + color + '" stroke-opacity=".55"/>' +
      '<g stroke="' + color + '" stroke-opacity=".38" stroke-width="1.2" fill="none">' + traces + '</g>' +
      '<rect x="' + chipX + '" y="' + chipY + '" width="26" height="16" rx="2" fill="' + color + '" fill-opacity=".85"/>' +
      '<rect x="' + (chipX + 4) + '" y="' + (chipY + 4) + '" width="18" height="8" rx="1" fill="#111318" fill-opacity=".3"/>' +
      '<g fill="#c9a86a" fill-opacity=".75">' + pins + '</g></svg>';
  }

  /* 预设方案小图标 */
  function presetIcon(name) {
    var s = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    if (name === "cloud") s += '<path d="M6.5 13a4 4 0 0 1 .6-7.96A5.5 5.5 0 0 1 17.3 7 3.5 3.5 0 0 1 17 14h-10.5z"/><path d="M9 17v2M13 17v2M17 17v2"/>';
    else if (name === "arm") s += '<path d="M4 20V9l6-4 4 3 6-3"/><circle cx="4" cy="20" r="1.4"/><circle cx="10" cy="5" r="1.4"/><circle cx="14" cy="8" r="1.4"/><circle cx="20" cy="5" r="1.4"/>';
    else if (name === "car") s += '<path d="M4 15h16l-1.5-4.5A2 2 0 0 0 16.6 9H7.4a2 2 0 0 0-1.9 1.5L4 15z"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/><path d="M8 9V7h8v2"/>';
    else s += '<circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/><path d="M8.5 15.5a5 5 0 0 1 0-7M12 12.5a8 8 0 0 1 0-9M15.5 9.5a11 11 0 0 1 0-6"/>';
    return s + "</svg>";
  }

  /* 首页主视觉：基座 + 模块磁吸组合（正交连线 + 流动动画） */
  function heroArt() {
    var mods = [
      { x: 24, y: 30, cat: "sensor" }, { x: 332, y: 30, cat: "actuator" },
      { x: 24, y: 246, cat: "comm" }, { x: 332, y: 246, cat: "display" }
    ];
    /* 模块边 → 板边：L 形正交走线，末端落在排针上 */
    var links = [
      "M144 70 V96 Q144 104 152 104 H162 Q170 104 170 112 V120",
      "M332 70 V96 Q332 104 324 104 H314 Q306 104 306 112 V120",
      "M144 286 V260 Q144 252 152 252 H162 Q170 252 170 244 V240",
      "M332 286 V260 Q332 252 324 252 H314 Q306 252 306 244 V240"
    ];
    var parts = "";
    mods.forEach(function (m, i) {
      var c = catCss(m.cat);
      parts += '<g class="hero-mod">' +
        '<rect x="' + m.x + '" y="' + (m.y + 2) + '" width="120" height="80" rx="8" fill="#000" fill-opacity=".35"/>' +
        '<rect x="' + m.x + '" y="' + m.y + '" width="120" height="80" rx="8" fill="var(--box-fill)" stroke="' + c + '" stroke-opacity=".75"/>' +
        '<rect x="' + (m.x + 12) + '" y="' + (m.y + 12) + '" width="30" height="18" rx="3" fill="' + c + '" fill-opacity=".85"/>' +
        '<text x="' + (m.x + 48) + '" y="' + (m.y + 26) + '" fill="' + c + '" font-size="10" font-family="Geist Mono, monospace">' + catName(m.cat) + "</text>" +
        '<g stroke="' + c + '" stroke-opacity=".35" stroke-width="1" fill="none">' +
        '<path d="M' + (m.x + 14) + ' ' + (m.y + 42) + 'h26"/><path d="M' + (m.x + 14) + ' ' + (m.y + 50) + 'h18"/>' +
        '<path d="M' + (m.x + 76) + ' ' + (m.y + 42) + 'h30"/></g>' +
        '<g fill="#c9a86a" fill-opacity=".8">' +
        [0, 1, 2, 3, 4].map(function (k) { return '<rect x="' + (m.x + 14 + k * 20) + '" y="' + (m.y + 62) + '" width="8" height="11" rx="1.5"/>'; }).join("") + "</g></g>" +
        '<path d="' + links[i] + '" fill="none" stroke="' + c + '" stroke-opacity=".75" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round" class="hero-dash"/>';
    });
    return '<svg viewBox="0 0 480 360" width="100%" aria-hidden="true">' +
      '<g opacity=".55">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (r) {
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (c) {
          return '<circle cx="' + (14 + c * 47) + '" cy="' + (14 + r * 44) + '" r="1.2" fill="#f2f1ee" fill-opacity=".16"/>';
        }).join("");
      }).join("") + "</g>" +
      /* 底板：PCB + 屏蔽罩 + 电容 + 双排针 */
      '<rect x="150" y="120" width="180" height="120" rx="10" fill="var(--cat-board)" fill-opacity=".22" stroke="var(--cat-board)" stroke-width="1.4"/>' +
      '<rect x="150" y="120" width="180" height="120" rx="10" fill="none" stroke="var(--accent)" stroke-width="1" stroke-opacity=".55"/>' +
      '<rect x="184" y="150" width="54" height="34" rx="4" fill="#23272e" stroke="#3a4048"/>' +
      '<rect x="192" y="158" width="38" height="18" rx="2" fill="var(--accent)" fill-opacity=".55"/>' +
      '<circle cx="268" cy="160" r="7" fill="#8b939c" fill-opacity=".85"/>' +
      '<circle cx="268" cy="160" r="3" fill="#2b3038"/>' +
      '<circle cx="286" cy="160" r="5" fill="#8b939c" fill-opacity=".7"/>' +
      '<rect x="248" y="196" width="22" height="12" rx="2" fill="#23272e" stroke="#3a4048"/>' +
      '<rect x="162" y="196" width="14" height="8" rx="1.5" fill="#6ee7a0" fill-opacity=".85"/>' +
      '<rect x="182" y="196" width="14" height="8" rx="1.5" fill="#ff6b5e" fill-opacity=".8"/>' +
      '<text x="158" y="140" fill="var(--ink)" font-size="8.5" font-family="Geist Mono, monospace" opacity=".75">BASE BOARD</text>' +
      '<g fill="#c9a86a" fill-opacity=".85">' +
      [0, 1, 2, 3, 4, 5, 6].map(function (k) { return '<rect x="' + (162 + k * 22) + '" y="112" width="9" height="8" rx="1.5"/>' +
        '<rect x="' + (162 + k * 22) + '" y="240" width="9" height="8" rx="1.5"/>'; }).join("") + "</g>" +
      parts +
      '<text x="240" y="300" fill="var(--muted)" font-size="10" font-family="Geist Mono, monospace" text-anchor="middle">drag · combine · validate</text></svg>';
  }

  /* 特性小图 */
  function featArt(glyph) {
    var s = '<svg viewBox="0 0 72 40" width="100%" height="40" aria-hidden="true">';
    if (glyph === "board") {
      s += '<rect x="8" y="6" width="56" height="28" rx="4" fill="#111318" stroke="var(--line-strong)"/>' +
        '<rect x="16" y="13" width="18" height="11" rx="2" fill="var(--cat-board)" fill-opacity=".85"/>' +
        '<g fill="#c9a86a" fill-opacity=".8"><rect x="38" y="13" width="6" height="18" rx="1"/><rect x="48" y="13" width="6" height="18" rx="1"/><rect x="58" y="13" width="6" height="8" rx="1"/></g>';
    } else if (glyph === "sensor") {
      s += '<circle cx="20" cy="20" r="9" fill="none" stroke="var(--cat-sensor)" stroke-width="2"/><circle cx="20" cy="20" r="3" fill="var(--cat-sensor)"/>' +
        '<path d="M36 20h18M54 20l-5-4M54 20l-5 4M34 12v16" stroke="var(--line-strong)" stroke-width="1.4" fill="none"/>' +
        '<path d="M58 8a12 12 0 0 1 0 24" stroke="var(--cat-sensor)" stroke-width="2" fill="none" opacity=".5"/>';
    } else if (glyph === "motor") {
      s += '<rect x="10" y="10" width="30" height="20" rx="3" fill="#111318" stroke="var(--cat-actuator)" stroke-width="1.6"/>' +
        '<circle cx="40" cy="20" r="4" fill="var(--cat-actuator)"/>' +
        '<path d="M50 20h14M62 16v8" stroke="var(--line-strong)" stroke-width="1.6" fill="none"/>' +
        '<path d="M14 14v12" stroke="var(--cat-actuator)" stroke-width="1.4" opacity=".6"/>';
    } else if (glyph === "screen") {
      s += '<rect x="8" y="6" width="46" height="28" rx="3" fill="#111318" stroke="var(--cat-display)" stroke-width="1.6"/>' +
        '<path d="M14 12h20M14 18h34M14 24h26" stroke="var(--cat-display)" stroke-width="2.4" opacity=".85"/>' +
        '<path d="M60 14l4 6-4 6" stroke="var(--line-strong)" stroke-width="1.6" fill="none"/>';
    } else if (glyph === "wave") {
      s += '<path d="M8 20a8 8 0 0 1 16 0a12 12 0 0 1 24 0a16 16 0 0 1 24 0" stroke="var(--cat-comm)" stroke-width="2" fill="none"/>' +
        '<circle cx="64" cy="20" r="3" fill="var(--cat-comm)"/>';
    } else if (glyph === "bolt") {
      s += '<path d="M26 4L12 22h9l-4 14 16-20H23l3-12z" fill="var(--cat-power)" fill-opacity=".9" stroke="var(--cat-power)"/>' +
        '<path d="M44 8v10M44 26v6M52 12l5 5M36 17l-5 5" stroke="var(--line-strong)" stroke-width="1.6"/>';
    } else if (glyph === "check") {
      s += '<circle cx="26" cy="20" r="14" fill="none" stroke="var(--ok)" stroke-width="2"/>' +
        '<path d="M19 20l5 5 10-11" stroke="var(--ok)" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    } else {
      s += '<rect x="14" y="4" width="44" height="32" rx="3" fill="#111318" stroke="var(--line-strong)"/>' +
        '<path d="M20 12h24M20 18h30M20 24h18M20 30h26" stroke="var(--accent-ink)" stroke-width="2.2"/>';
    }
    return s + "</svg>";
  }

  /* 页脚热度条：真实统计本机选型操作（近 12 周，GitHub contribution 风格） */
  function heatStrip() {
    var data = M.heatData();
    var cells = "";
    var vals = [], max = 0, i, d, key, v;
    for (i = 83; i >= 0; i--) {
      d = new Date();
      d.setDate(d.getDate() - i);
      key = M.todayKey(d);
      v = data[key] || 0;
      vals.push({ v: v, key: key });
      if (v > max) max = v;
    }
    vals.forEach(function (x) {
      var style;
      if (!x.v) style = "background:var(--line)";
      else {
        var op = max ? 0.25 + 0.75 * Math.min(1, x.v / max) : 1;
        style = "background:var(--accent);opacity:" + op.toFixed(2);
      }
      cells += "<i style='" + style + "' title='" + x.key + " · " + x.v + " 次选型操作'></i>";
    });
    return '<div class="heat" aria-hidden="true">' + cells + "</div>";
  }

  window.MODBAY_UI = {
    catCss: catCss, catName: catName, BUS_LABEL: BUS_LABEL, RAIL_LABEL: RAIL_LABEL,
    modArt: modArt, presetIcon: presetIcon, heroArt: heroArt, featArt: featArt, heatStrip: heatStrip,
    toast: function (msg, type) {
      var root = document.getElementById("toast-root");
      var d = document.createElement("div");
      d.className = "toast" + (type === "error" ? " is-error" : "");
      d.innerHTML = (type === "error" ? "<b>✕</b> " : "<b>✓</b> ") + M.esc(msg);
      root.appendChild(d);
      setTimeout(function () { d.style.opacity = "0"; d.style.transition = "opacity .25s"; }, 2200);
      setTimeout(function () { d.remove(); }, 2600);
    }
  };
})();
