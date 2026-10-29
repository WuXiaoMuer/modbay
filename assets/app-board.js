/* ============ MODBAY 底板设计图 ============
 * 依据选型生成一块可打样的连接底板：
 *   板框 / 安装孔 / 主控占位 / 模块占位与排针焊盘 / 电源入口 / 电源与信号母线 / 丝印 / 尺寸标注
 * 输出 mm 单位的 SVG（1 单位 = 1mm），附工艺参数与按面积报价。
 */
(function () {
  "use strict";

  var M = window.M;
  var esc = M.esc;

  /* 模块实物尺寸（mm，长 × 宽）——按常见成品模块实测，用于占位与打样 */
  var FP = {
    /* 基座 */
    esp32s3: [68, 28], stm32f103: [53, 23], rp2040: [43, 18], uno: [68, 53],
    picow: [51, 21], nrf52840: [45, 18], k210: [70, 40],
    /* 传感器 */
    dht22: [28, 12], bmp280: [16, 16], sht30: [20, 16], sht40: [20, 16],
    mpu6050: [21, 16], hcsr04: [45, 20], vl53l0x: [18, 12], tcs34725: [20, 16],
    mq2: [32, 22], soil: [24, 16], max30102: [20, 14], rtc: [38, 22],
    bh1750: [20, 16], ina219: [22, 20], mlx90614: [20, 20], pm25: [50, 38],
    /* 执行 */
    sg90: [23, 12], mg996r: [40, 20], tt: [70, 22], l298n: [43, 43],
    tb6612: [22, 22], drv8833: [20, 18], stepper28: [42, 30], tmc2209: [22, 20],
    relay: [43, 26], relay4: [76, 32], buzzer: [33, 15], ws2812: [40, 40],
    /* 显示 */
    oled096: [27, 27], oled13: [27, 27], lcd1602: [80, 36], tft18: [35, 50], ili9341: [60, 78],
    encoder: [30, 20], keypad: [70, 70],
    /* 通信 */
    nrf24: [29, 15], lora: [30, 18], rc522: [60, 40], w5500: [55, 28],
    tfcard: [30, 25], gps: [25, 25], sim800l: [25, 25], esp01s: [24, 14], rs485: [44, 14],
    /* 电源 */
    lipo: [30, 20], battery18650: [40, 30], solar6v: [70, 45],
    buck5v: [40, 25], boost12v: [40, 25], levelshifter: [25, 15]
  };
  var CAT_FP = { sensor: [20, 16], actuator: [30, 20], display: [28, 28], comm: [30, 20], power: [35, 25] };

  function fpOf(mod) {
    return FP[mod.id] || CAT_FP[mod.cat] || [25, 20];
  }

  /* ---------- 布局（mm） ----------
   * 主控竖放（省横向空间，也更像真实 shield 底板），模块按行装箱、每行居中。
   * 电机/舵机/大件属于「板外件」，不占底板面积，只在清单里注明。 */
  var PAD = 5, GAP = 4, HOLE = 3.2, HOLE_INSET = 4, HEADER = 2.54, MAXW = 108;
  var OFFBOARD = { tt: 1, sg90: 1, mg996r: 1, stepper28: 1, solar6v: 1, battery18650: 1, keypad: 1 };

  function layout(plan) {
    var b = plan.board ? fpOf(plan.board) : [50, 25];
    /* 竖放：宽高互换 */
    var bw = Math.min(b[1], b[0]), bh = Math.max(b[1], b[0]);
    if (b[0] > b[1]) { bw = b[1]; bh = b[0]; } else { bw = b[0]; bh = b[1]; }

    var items = (plan.items || []).filter(function (it) {
      return it.mod.cat !== "power" && !OFFBOARD[it.mod.id];
    });

    /* 按行装箱：单行总宽不超过 MAXW；单件本身超宽时独占一行 */
    var rows = [], cur = { list: [], w: 0, h: 0 };
    items.forEach(function (it) {
      var f = fpOf(it.mod);
      var addW = cur.list.length ? GAP + f[0] : f[0];
      if (cur.list.length && cur.w + addW > MAXW) {
        rows.push(cur); cur = { list: [], w: 0, h: 0 };
        addW = f[0];
      }
      cur.list.push({ it: it, w: f[0], h: f[1] });
      cur.w += addW;
      cur.h = Math.max(cur.h, f[1]);
    });
    if (cur.list.length) rows.push(cur);

    var areaW = rows.length ? Math.max.apply(null, rows.map(function (r) { return r.w; })) : 24;
    var areaH = rows.reduce(function (a, r) { return a + r.h; }, 0) + GAP * Math.max(0, rows.length - 1);

    var W = PAD + bw + 15 + areaW + PAD;
    var H = Math.max(PAD * 2 + bh, PAD * 2 + areaH, 46);

    var bx = PAD, by = (H - bh) / 2;
    var ax = PAD + bw + 15;
    var ay = (H - areaH) / 2;

    var placed = [];
    var y = ay;
    rows.forEach(function (r) {
      var x = ax + (areaW - r.w) / 2;   /* 每行水平居中 */
      r.list.forEach(function (m) {
        placed.push({ it: m.it, x: x, y: y + (r.h - m.h) / 2, w: m.w, h: m.h, rowTop: y, rowH: r.h });
        x += m.w + GAP;
      });
      y += r.h + GAP;
    });

    var off = (plan.items || []).filter(function (it) { return OFFBOARD[it.mod.id]; });
    /* pcb = 整块底板外框；mcu = 主控占位（在 pcb 内部） */
    return { W: W, H: H, pcb: { x: 0, y: 0, w: W, h: H },
      mcu: { x: bx, y: by, w: bw, h: bh }, modules: placed, rows: rows.length, offboard: off };
  }

  /* ---------- SVG ---------- */
  function designSvg(plan) {
    var L = layout(plan);
    var W = L.W, H = L.H, P = L.pcb, MCU = L.mcu;
    var s = [];
    s.push('<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="底板设计图">');
    s.push('<defs><pattern id="bgrid" width="2.54" height="2.54" patternUnits="userSpaceOnUse">' +
      '<path d="M2.54 0H0V2.54" fill="none" stroke="var(--line)" stroke-width="0.08" stroke-opacity=".55"/></pattern></defs>');

    /* ---- 整板外框 ---- */
    s.push('<rect x="' + P.x + '" y="' + P.y + '" width="' + P.w + '" height="' + P.h +
      '" rx="2.5" fill="var(--cat-board)" fill-opacity=".1" stroke="var(--accent)" stroke-width=".4"/>');
    s.push('<rect x="' + P.x + '" y="' + P.y + '" width="' + P.w + '" height="' + P.h +
      '" rx="2.5" fill="url(#bgrid)"/>');

    /* ---- 四角 M3 安装孔 ---- */
    [[P.x + HOLE_INSET, P.y + HOLE_INSET], [P.x + P.w - HOLE_INSET, P.y + HOLE_INSET],
     [P.x + HOLE_INSET, P.y + P.h - HOLE_INSET], [P.x + P.w - HOLE_INSET, P.y + P.h - HOLE_INSET]]
      .forEach(function (h) {
        s.push('<circle cx="' + h[0] + '" cy="' + h[1] + '" r="' + (HOLE / 2 + 1.3) + '" fill="none" stroke="var(--line-strong)" stroke-width=".15" stroke-dasharray=".7 .7"/>');
        s.push('<circle cx="' + h[0] + '" cy="' + h[1] + '" r="' + (HOLE / 2) + '" fill="var(--bg)" stroke="var(--muted)" stroke-width=".25"/>');
      });

    /* ---- 主控占位（竖放） ---- */
    s.push('<rect x="' + MCU.x + '" y="' + MCU.y + '" width="' + MCU.w + '" height="' + MCU.h +
      '" rx="1" fill="var(--box-fill)" stroke="var(--line-strong)" stroke-width=".3"/>');
    s.push('<text x="' + (MCU.x + MCU.w / 2) + '" y="' + (MCU.y + MCU.h / 2 - 1.2) +
      '" font-size="1.9" text-anchor="middle" fill="var(--ink)" font-family="Geist Mono, monospace">' +
      esc(short(plan.board ? plan.board.name : "MAIN", 11)) + "</text>");
    s.push('<text x="' + (MCU.x + MCU.w / 2) + '" y="' + (MCU.y + MCU.h / 2 + 2.2) +
      '" font-size="1.7" text-anchor="middle" fill="var(--muted)" font-family="Geist Mono, monospace">MCU</text>');
    headerCol(s, MCU.x + 1, MCU.y + 3, MCU.h - 6, "var(--line-strong)");
    headerCol(s, MCU.x + MCU.w - 1, MCU.y + 3, MCU.h - 6, "var(--line-strong)");
    s.push('<text x="' + (MCU.x + MCU.w / 2) + '" y="' + (MCU.y + MCU.h - 2) +
      '" font-size="1.6" text-anchor="middle" fill="var(--faint)" font-family="Geist Mono, monospace">USB</text>');

    /* ---- 模块占位 + 焊盘 + 丝印 ---- */
    L.modules.forEach(function (m) {
      var c = window.MODBAY_UI && window.MODBAY_UI.catCss ? window.MODBAY_UI.catCss(m.it.mod.cat) : "var(--accent)";
      s.push('<rect x="' + m.x + '" y="' + m.y + '" width="' + m.w + '" height="' + m.h +
        '" rx="1" fill="' + c + '" fill-opacity=".12" stroke="' + c + '" stroke-width=".32"/>');
      var label = short(m.it.mod.name, 22);
      var per = Math.max(5, Math.floor(m.w / 2.0));
      var lines = label.length > per ? [label.slice(0, per), short(label.slice(per), per)] : [label];
      lines.forEach(function (ln, li) {
        s.push('<text x="' + (m.x + m.w / 2) + '" y="' + (m.y + m.h / 2 - (lines.length - 1) * 1.4 + li * 2.8 + 0.9) +
          '" font-size="1.8" text-anchor="middle" fill="' + c + '" font-family="Archivo, sans-serif">' + esc(ln) + "</text>");
      });
      var n = Math.max(2, Math.floor((m.w - 2) / HEADER));
      headerRow(s, m.x + (m.w - (n - 1) * HEADER) / 2, m.y + m.h - 1.2, (n - 1) * HEADER, c);
      s.push('<text x="' + (m.x + m.w / 2) + '" y="' + (m.y + m.h + 2.1) + '" font-size="1.45" text-anchor="middle" fill="var(--faint)" font-family="Geist Mono, monospace">' +
        m.w + "x" + m.h + "</text>");
    });

    /* ---- 电源入口（板左边缘） ---- */
    var px = P.x, py = P.y + P.h / 2;
    s.push('<rect x="' + (px - 0.4) + '" y="' + (py - 2.6) + '" width="4" height="5.2" rx=".6" fill="var(--cat-power)" fill-opacity=".25" stroke="var(--cat-power)" stroke-width=".28"/>');
    s.push('<text x="' + (px + 2) + '" y="' + (py + 6.2) + '" font-size="1.6" text-anchor="middle" fill="var(--cat-power)" font-family="Geist Mono, monospace">VIN</text>');

    /* ---- 电源母线 ----
       三条竖线走在主控与模块区之间的走廊里，模块从竖线短支线取电；
       母线本身由主控底部一条横线统一馈入，不横穿任何模块占位。 */
    if (L.modules.length) {
      var minX = Math.min.apply(null, L.modules.map(function (m) { return m.x; }));
      var maxY = Math.max.apply(null, L.modules.map(function (m) { return m.y + m.h; }));
      var topY = Math.min.apply(null, L.modules.map(function (m) { return m.y; }));
      var feedY = Math.min(MCU.y + MCU.h - 4, maxY + 3.5);
      var c0 = minX - 2.4;
      var corridor = [
        { x: c0, color: "var(--vcc)", name: "3V3" },
        { x: c0 - 2.6, color: "var(--gnd)", name: "GND" },
        { x: c0 - 5.2, color: "var(--cat-power)", name: "5V" }
      ];
      corridor.forEach(function (b) {
        /* 主控底部 -> 走廊 -> 竖线上行 */
        s.push('<path d="M' + (MCU.x + MCU.w) + " " + feedY.toFixed(1) + " H" + b.x.toFixed(1) +
          " V" + (topY - 1.8).toFixed(1) + '" fill="none" stroke="' + b.color +
          '" stroke-width=".48" stroke-opacity=".8" stroke-linejoin="round"/>');
        s.push('<circle cx="' + b.x.toFixed(1) + '" cy="' + feedY.toFixed(1) + '" r=".5" fill="' + b.color + '"/>');
        /* 竖排标签（沿走廊向上写，三条不打架） */
        s.push('<text x="' + (b.x - 0.5).toFixed(1) + '" y="' + (topY - 2.4).toFixed(1) +
          '" font-size="1.45" fill="' + b.color + '" font-family="Geist Mono, monospace" text-anchor="end">' + b.name + "</text>");
      });
      /* 模块取电支线：走「行上方的通道」再下钻，避免横穿中间的模块 */
      L.modules.forEach(function (m, i) {
        var b = corridor[i % corridor.length];
        var chY = (m.rowTop !== undefined ? m.rowTop : m.y) - 1.5;   /* 通道：整行上方 1.5mm，同一行共用 */
        var mx = m.x + m.w / 2;
        s.push('<path d="M' + b.x.toFixed(1) + " " + chY.toFixed(1) + " H" + mx.toFixed(1) +
          " V" + m.y.toFixed(1) + '" fill="none" stroke="' + b.color +
          '" stroke-width=".22" stroke-opacity=".7" stroke-linejoin="round"/>');
        s.push('<circle cx="' + b.x.toFixed(1) + '" cy="' + chY.toFixed(1) + '" r=".42" fill="' + b.color + '"/>');
        s.push('<circle cx="' + mx.toFixed(1) + '" cy="' + m.y.toFixed(1) + '" r=".45" fill="var(--bg)" stroke="' + b.color + '" stroke-width=".2"/>');
      });
    }

    /* ---- 尺寸标注 ---- */
    dimH(s, P.x, P.x + P.w, P.y + 1.2, P.w);
    dimV(s, P.y, P.y + P.h, P.x + 1.2, P.h);
    s.push('<text x="' + (P.w - 2) + '" y="' + (P.h - 2) + '" font-size="1.4" text-anchor="end" fill="var(--faint)" font-family="Geist Mono, monospace">' +
      "MODBAY - 2 LAYER - 1.6mm - " + L.modules.length + " MODULES</text>");
    s.push("</svg>");
    return s.join("");
  }

  function headerRow(s, x, y, len, color) {
    var n = Math.max(1, Math.round(len / HEADER));
    for (var i = 0; i <= n; i++) {
      var cx = x + i * HEADER;
      s.push('<circle cx="' + cx.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="0.55" fill="var(--bg)" stroke="' +
        (color || "var(--line-strong)") + '" stroke-width=".2"/>');
    }
  }

  function headerCol(s, x, y, len, color) {
    var n = Math.max(1, Math.round(len / HEADER));
    for (var i = 0; i <= n; i++) {
      s.push('<circle cx="' + x.toFixed(2) + '" cy="' + (y + i * HEADER).toFixed(2) + '" r="0.55" fill="var(--bg)" stroke="' +
        (color || "var(--line-strong)") + '" stroke-width=".2"/>');
    }
  }

  function dimH(s, x0, x1, y, val) {
    s.push('<path d="M' + x0 + " " + y + " H" + x1 + '" stroke="var(--muted)" stroke-width=".15" fill="none"/>');
    [x0, x1].forEach(function (x) {
      s.push('<path d="M' + x + " " + (y - 0.8) + " V" + (y + 0.8) + '" stroke="var(--muted)" stroke-width=".2"/>');
    });
    s.push('<text x="' + ((x0 + x1) / 2) + '" y="' + (y - 0.8) + '" font-size="1.8" text-anchor="middle" fill="var(--muted)" font-family="Geist Mono, monospace">' + val.toFixed(1) + "</text>");
  }
  function dimV(s, y0, y1, x, val) {
    s.push('<path d="M' + x + " " + y0 + " V" + y1 + '" stroke="var(--muted)" stroke-width=".15" fill="none"/>');
    [y0, y1].forEach(function (y) {
      s.push('<path d="M' + (x - 0.8) + " " + y + " H" + (x + 0.8) + '" stroke="var(--muted)" stroke-width=".2"/>');
    });
    s.push('<text x="' + (x - 1.2) + '" y="' + ((y0 + y1) / 2) + '" font-size="1.8" text-anchor="middle" fill="var(--muted)" font-family="Geist Mono, monospace" transform="rotate(-90 ' + (x - 1.2) + " " + ((y0 + y1) / 2) + ')">' + val.toFixed(1) + "</text>");
  }

  function short(s0, n) {
    s0 = String(s0 || "");
    return s0.length > n ? s0.slice(0, n - 1) + "…" : s0;
  }

  /* ---------- 工艺与报价 ---------- */
  function fab(plan) {
    var L = layout(plan);
    var areaCm2 = (L.W / 10) * (L.H / 10);
    var pads = 0;
    (plan.alloc ? plan.alloc.rows : []).forEach(function (r) { pads += r.signals.length; });
    var modules = L.modules.length;
    /* 焊点 = 模块排针 + 主控排针 + 电源座 */
    var joints = pads * 2 + 8;
    var price = Math.max(35, Math.round(areaCm2 * 0.55 + joints * 0.06));
    return {
      W: L.W, H: L.H, area: areaCm2, modules: modules, joints: joints, price: price,
      layers: 2, thickness: 1.6, copper: 1, surface: "HASL 有铅喷锡",
      minTrace: 0.15, minHole: 0.3, pitch: 2.54, color: "黑色阻焊 / 白色丝印",
      lead: "打样 3~5 天（5 片起）"
    };
  }

  /* ---------- 渲染 ---------- */
  function view(plan) {
    if (!plan.board) {
      return '<section class="panel plan-span"><div class="panel-head"><h3>底板设计图</h3></div>' +
        '<div class="panel-body"><p class="wiring-cap">选定基座后，这里会按模块实物尺寸生成可打样的连接底板。</p></div></section>';
    }
    var f = fab(plan);
    var L_off = (layout(plan).offboard || []);

    return '<section class="panel plan-span"><div class="panel-head"><h3>底板设计图 · 可直接打样</h3>' +
      '<span class="mono">' + f.W.toFixed(0) + " × " + f.H.toFixed(0) + " mm</span></div>" +
      '<div class="panel-body">' +
      '<div class="board-wrap">' +
      '<div class="board-stage">' + designSvg(plan) +
      '<div class="board-legend mono">' +
      '<span><i style="background:var(--accent)"></i>板框 / M3 安装孔</span>' +
      '<span><i style="background:var(--line-strong)"></i>2.54 排针焊盘</span>' +
      '<span><i style="background:var(--vcc)"></i>3V3</span>' +
      '<span><i style="background:var(--gnd)"></i>GND</span>' +
      '<span><i style="background:var(--cat-power)"></i>5V / VIN</span>' +
      "</div></div>" +

      '<aside class="board-side">' +
      '<div class="fab-grid">' +
      '<div class="fab-cell"><span>板框尺寸</span><b>' + f.W.toFixed(1) + " × " + f.H.toFixed(1) + " mm</b></div>" +
      '<div class="fab-cell"><span>面积</span><b>' + f.area.toFixed(1) + " cm²</b></div>" +
      '<div class="fab-cell"><span>层数 / 板厚</span><b>' + f.layers + " 层 / " + f.thickness + " mm</b></div>" +
      '<div class="fab-cell"><span>铜厚 / 表面</span><b>' + f.copper + " oz / " + esc(f.surface) + "</b></div>" +
      '<div class="fab-cell"><span>最小线宽 / 孔径</span><b>' + f.minTrace + " / " + f.minHole + " mm</b></div>" +
      '<div class="fab-cell"><span>焊盘间距</span><b>' + f.pitch + " mm</b></div>" +
      '<div class="fab-cell"><span>阻焊 / 丝印</span><b>' + esc(f.color) + "</b></div>" +
      '<div class="fab-cell"><span>焊点总数</span><b>' + f.joints + " 点</b></div>" +
      "</div>" +
      '<div class="fab-sum"><div><span>打样 + 焊接（含测试）</span><b>' + M.fmtMoney(f.price) + "</b></div>" +
      '<div class="fab-note mono">' + esc(f.lead) + " · 已含在「焊接成品」档位内</div></div>" +
      '<p class="board-tip">主控竖放靠左、模块按行居中、四角 M3 安装孔、底边 2.54mm 排针焊盘。' +
      "导出的 Gerber 含板框 / 焊盘 / 丝印三层，焊接按接线图对位。</p>" +
      (L_off.length ? '<p class="board-tip board-off">板外件（不占底板面积）：<b>' +
        L_off.map(function (o) { return esc(o.mod.name); }).join("、") + "</b></p>" : "") +
      "</aside></div>" +
      "</div></section>";
  }

  window.MODBAY_BOARD = {
    view: view, svg: designSvg, fab: fab, layout: layout, footprint: fpOf
  };
})();
