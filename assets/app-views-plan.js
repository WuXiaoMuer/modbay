/* ============ MODBAY 视图：方案预览（含程序化接线图） ============ */
(function () {
  "use strict";
  var M = window.M, U = window.MODBAY_UI;

  function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  function wiringSvg(plan) {
    var rows = plan.alloc ? plan.alloc.rows : [];
    if (!plan.board || (!rows.length && !plan.items.length)) {
      return '<div class="bay-empty" style="padding:40px"><b>暂无接线图</b>先选基座并添加功能模块。</div>';
    }
    /* 电源分区数据：供电方（provides）+ 电平桥（solves）+ 外供/5V 负载 */
    var providers = plan.items.filter(function (it) { return it.mod.provides; });
    var shifters = plan.items.filter(function (it) { return it.mod.solves === "level"; });
    var RAIL_NAME = { ext: "外供轨", "5v": "5V 轨" };
    function providesText(mod) {
      return Object.keys(mod.provides).map(function (k) {
        return (mod.outV || (k === "ext" ? 12 : 5)) + "V / " + M.fmtMa(mod.provides[k]) + " → " + RAIL_NAME[k];
      }).join("，");
    }
    /* 缺电源的轨：有负载但没有任何 provides 覆盖 */
    var consumers = plan.items.filter(function (it) {
      return (it.mod.rail === "ext" || it.mod.rail === "5v") && it.mod.ma > 0;
    });
    var railHasProvider = {};
    providers.forEach(function (it) {
      Object.keys(it.mod.provides).forEach(function (k) { railHasProvider[k] = true; });
    });
    var missingRails = {};
    consumers.forEach(function (it) { if (!railHasProvider[it.mod.rail]) missingRails[it.mod.rail] = true; });

    /* 引脚列：电源 / 地置顶（真实接线必备），信号脚按编号升序 */
    var needRail = {};
    rows.forEach(function (r) { needRail[r.mod.rail] = true; });
    var powerPins = [];
    if (needRail["3v3"]) powerPins.push("3V3");
    if (needRail["5v"]) powerPins.push("5V");
    powerPins.push("GND");
    var pins = powerPins.slice(), seen = {};
    rows.forEach(function (r) {
      r.signals.forEach(function (s) { if (!seen[s.pin]) { seen[s.pin] = 1; pins.push(s.pin); } });
    });
    /* 引脚按「模块使用顺序」排列（而非物理编号）：同一模块的信号脚相邻，
       走线几乎不交叉，可读性远高于按编号排序。 */
    pins = powerPins.concat(pins.slice(powerPins.length));

    var nPower = providers.length + shifters.length + Object.keys(missingRails).length;
    var ROW_H = 64;
    /* 引脚 y 按「所属模块所在行」分配：同一模块的信号脚以该模块中线为中心上下排开，
       走线几乎是水平直线；共用引脚（SPI 总线）沿用首次分配的位置。 */
    var y = {};
    /* 电源/地引脚置顶（真实接线必备），模块区从其下方开始，两者不抢位置 */
    powerPins.forEach(function (p, i) { y[p] = 56 + i * 24; });
    var ROWS_TOP = 56 + Math.max(0, powerPins.length - 1) * 24 + 30;
    rows.forEach(function (r, i) {
      var mid = ROWS_TOP + i * ROW_H + 24;
      var n = r.signals.length;
      r.signals.forEach(function (sg, k) {
        if (y[sg.pin] === undefined) y[sg.pin] = mid + (k - (n - 1) / 2) * 17;
      });
    });
    /* 引脚列防重叠：按 y 排序后强制最小间距，避免相邻模块的脚标签压在一起 */
    var MIN_GAP = 15.5;
    var colOrder = pins.slice().sort(function (a, b) { return y[a] - y[b]; });
    for (var gi = 1; gi < colOrder.length; gi++) {
      var prevY = y[colOrder[gi - 1]], curY = y[colOrder[gi]];
      if (curY - prevY < MIN_GAP) y[colOrder[gi]] = prevY + MIN_GAP;
    }
    var maxY = 0;
    pins.forEach(function (p) { if (y[p] > maxY) maxY = y[p]; });
    var boardH = Math.max(ROWS_TOP + rows.length * ROW_H - 34, maxY - 44 + 30);
    /* 高度按内容算：板 + 电源分区 + 图例，不留大片空白 */
    var POWER_BLOCK = nPower ? (nPower * 58 + 26) : 0;
    var H = Math.max(360, ROWS_TOP + rows.length * ROW_H + POWER_BLOCK + 64);
    var busColor = { i2c: "var(--accent)", spi: "var(--cat-comm)", uart: "var(--cat-board)" };

    /* ---- 母线式布线 ----
       引脚列(188) → GND/VCC 干线(212/238) → 信号走廊(276 起，每模块独占 20px 带) → 模块框(470)
       GND / VCC 各只有一条垂直干线，模块用短支线取电，不再出现 N 条平行长线。 */
    var GX = 444, VX = 458, C0 = 266, CS = 32, MX = 470, MW = 300, MOD_H = 48;
    var busBottom = 44 + boardH - 10;
    var vccPins = pins.filter(function (p) { return p === "3V3" || p === "5V"; });
    var vccX = {};
    vccPins.forEach(function (p, i) { vccX[p] = VX + i * 13; });

    /* ---- 总线束布线 ----
       同一条总线（I2C / SPI / GPIO…）的所有引脚合并成一条垂直主干，模块从主干水平分支。
       19 根独立线收敛成 4–6 条总线束，这是真实排线图的画法，也是密度问题的正解。 */
    var busGroups = {}, busIdx = 0;
    rows.forEach(function (r, i) {
      var b = r.mod.bus || "gpio";
      if (!busGroups[b]) {
        busGroups[b] = { cx: C0 + busIdx * 30, pins: [], items: [] };
        busIdx++;
      }
      busGroups[b].items.push(i);
      r.signals.forEach(function (sg) {
        if (busGroups[b].pins.indexOf(sg.pin) < 0) busGroups[b].pins.push(sg.pin);
      });
    });

    var busParts = "";
    Object.keys(busGroups).forEach(function (b) {
      var g = busGroups[b];
      var ys = [];
      g.pins.forEach(function (p) { if (y[p] !== undefined) ys.push(y[p]); });
      g.items.forEach(function (idx) {
        rows[idx].signals.forEach(function (sg, k) { ys.push(ROWS_TOP + idx * ROW_H + 17 + k * 7); });
      });
      if (!ys.length) return;
      var lo = Math.min.apply(null, ys) - 7;
      var hi = Math.max.apply(null, ys) + 7;
      var col = busColor[b] || "var(--line-strong)";
      /* 主干（粗线 = 一束线） */
      busParts += '<path d="M' + g.cx + " " + lo.toFixed(0) + " V" + hi.toFixed(0) +
        '" fill="none" stroke="' + col + '" stroke-width="2.8" stroke-opacity=".85" stroke-linecap="round"/>';
      busParts += '<text x="' + (g.cx + 6) + '" y="' + (lo - 4).toFixed(0) + '" fill="' + col +
        '" font-size="9" font-family="Geist Mono, monospace">' + b.toUpperCase() + " ×" + g.pins.length + "</text>";
      /* 引脚接入主干 */
      g.pins.forEach(function (p) {
        if (y[p] === undefined) return;
        busParts += '<path d="M188 ' + y[p].toFixed(0) + " H" + g.cx + '" fill="none" stroke="' + col + '" stroke-width="1.3" stroke-opacity=".8"/>' +
          '<circle cx="188" cy="' + y[p].toFixed(0) + '" r="2.6" fill="var(--box-fill)" stroke="' + col + '" stroke-width="1.2"/>' +
          '<circle cx="188" cy="' + y[p].toFixed(0) + '" r="1" fill="' + col + '"/>';
      });
    });

    /* ---- 电源干线 ----
       贴在模块框左侧（444/458），模块用极短支线取电；只有 GND/3V3 两根引脚需要横跨总线束。 */
    busParts += '<path d="M188 ' + y["GND"].toFixed(0) + " H" + GX + " V" + busBottom.toFixed(0) +
      '" fill="none" stroke="var(--gnd)" stroke-width="2.2" stroke-opacity=".5" stroke-linecap="round"/>' +
      '<circle cx="188" cy="' + y["GND"].toFixed(0) + '" r="2.6" fill="var(--box-fill)" stroke="var(--gnd)" stroke-width="1.2"/>' +
      '<circle cx="188" cy="' + y["GND"].toFixed(0) + '" r="1" fill="var(--gnd)"/>';
    vccPins.forEach(function (p) {
      busParts += '<path d="M188 ' + y[p].toFixed(0) + " H" + vccX[p] + " V" + busBottom.toFixed(0) +
        '" fill="none" stroke="var(--vcc)" stroke-width="2.2" stroke-opacity=".5" stroke-linecap="round"/>' +
        '<circle cx="188" cy="' + y[p].toFixed(0) + '" r="2.6" fill="var(--box-fill)" stroke="var(--vcc)" stroke-width="1.2"/>' +
        '<circle cx="188" cy="' + y[p].toFixed(0) + '" r="1" fill="var(--vcc)"/>';
    });

    var mods = rows.map(function (r, i) {
      var top = ROWS_TOP + i * ROW_H;
      var color = U.catCss(r.mod.cat);
      var lc = busColor[r.mod.bus] || "var(--line-strong)";
      var parts = "";

      /* 取电支线：VCC / GND 各一条，从干线水平进模块 */
      var vx = vccX[r.mod.rail === "5v" ? "5V" : (r.mod.rail === "3v3" ? "3V3" : "")];
      if (vx) {
        parts += '<path d="M' + vx + " " + (top + 8) + " H" + MX + '" fill="none" stroke="var(--vcc)" stroke-width="1.8" stroke-opacity=".95"/>' +
          '<circle cx="' + vx + '" cy="' + (top + 8) + '" r="2.6" fill="var(--vcc)"/>';
      }
      parts += '<path d="M' + GX + " " + (top + MOD_H - 5) + " H" + MX + '" fill="none" stroke="var(--gnd)" stroke-width="1.8" stroke-opacity=".95"/>' +
        '<circle cx="' + GX + '" cy="' + (top + MOD_H - 5) + '" r="2.6" fill="var(--gnd)"/>';

      /* 信号支线：从所属总线束的主干水平引出，落在模块框左侧焊盘 */
      var grp = busGroups[r.mod.bus || "gpio"];
      parts += r.signals.map(function (sg, k) {
        var ty = top + 17 + k * 7;
        return '<path d="M' + grp.cx + " " + ty + " H" + MX + '" fill="none" stroke="' + lc + '" stroke-width="1.4" stroke-opacity=".85"/>' +
          '<circle cx="' + MX + '" cy="' + ty + '" r="2.8" fill="var(--box-fill)" stroke="' + lc + '" stroke-width="1.3"/>' +
          '<circle cx="' + MX + '" cy="' + ty + '" r="1" fill="' + lc + '"/>';
      }).join("");

      /* 模块框：名称一行 + 信号映射两行 */
      var mapTxt = r.signals.map(function (sg) { return sg.name + "→" + sg.pin; });
      var half = Math.ceil(mapTxt.length / 2);
      var mapEl = mapTxt.length > 3
        ? '<text x="500" y="' + (top + 34) + '" fill="var(--muted)" font-size="9.5" font-family="Geist Mono, monospace">' + M.esc(mapTxt.slice(0, half).join("  ")) + "</text>" +
          '<text x="500" y="' + (top + 45) + '" fill="var(--muted)" font-size="9.5" font-family="Geist Mono, monospace">' + M.esc(mapTxt.slice(half).join("  ")) + "</text>"
        : '<text x="500" y="' + (top + 39) + '" fill="var(--muted)" font-size="9.5" font-family="Geist Mono, monospace">' + M.esc(mapTxt.join("  ")) + "</text>";

      return '<g class="mod-box" data-wire-mod="' + M.esc(r.mod.id) + '">' +
        '<rect x="' + MX + '" y="' + top + '" width="' + MW + '" height="' + MOD_H + '" rx="8" fill="var(--box-fill)" stroke="' + color + '" stroke-opacity=".7"/>' +
        '<rect x="480" y="' + (top + 13) + '" width="16" height="16" rx="3" fill="' + color + '" fill-opacity=".85"/>' +
        '<text x="500" y="' + (top + 20) + '" fill="var(--ink)" font-size="11.5" font-family="Archivo, sans-serif">' + M.esc(trunc(r.mod.name, 22)) + "</text>" +
        '<text x="' + (MX + MW - 12) + '" y="' + (top + 20) + '" fill="' + color + '" font-size="9.5" text-anchor="end" font-family="Geist Mono, monospace">' +
          M.esc((r.mod.rail === "5v" ? "5V" : r.mod.rail === "3v3" ? "3.3V" : "外供") + " · " + (r.mod.ma || 0) + "mA") + "</text>" +
        mapEl + parts + "</g>";
    }).join("");

    /* ---- 模块间驱动关系 ----
       驱动板（L298N / TB6612 / DRV8833 / TMC2209）与被驱动的电机/舵机之间画一条回环连线，
       走模块框右侧走廊，颜色用「执行」类目色，虚线表示功率输出而非信号。 */
    var DRIVER_IDS = ["l298n", "tb6612", "drv8833", "tmc2209", "stepper28"];
    var MOTOR_IDS = ["tt", "mg996r", "sg90"];
    var driveParts = "";
    var driverRows = [], motorRows = [];
    rows.forEach(function (r, i) {
      if (DRIVER_IDS.indexOf(r.mod.id) >= 0) driverRows.push({ r: r, top: ROWS_TOP + i * ROW_H });
      if (MOTOR_IDS.indexOf(r.mod.id) >= 0) motorRows.push({ r: r, top: ROWS_TOP + i * ROW_H });
    });
    if (driverRows.length && motorRows.length) {
      var dCol = "var(--cat-actuator)";
      var laneX = 812;
      var lane = 0;
      driverRows.forEach(function (d) {
        motorRows.forEach(function (m) {
          if (d.r === m.r) return;
          var y1 = d.top + MOD_H / 2, y2 = m.top + MOD_H / 2;
          var lx = laneX + (lane % 3) * 10;
          lane++;
          driveParts += '<path d="M' + (MX + MW) + " " + y1 + " H" + lx + " V" + y2 + " H" + (MX + MW) + '" ' +
            'fill="none" stroke="' + dCol + '" stroke-width="1.5" stroke-opacity=".75" stroke-dasharray="5 4"/>' +
            /* 两端小方块，区别于信号焊点 */
            '<rect x="' + (MX + MW - 1) + '" y="' + (y1 - 3) + '" width="6" height="6" rx="1.5" fill="' + dCol + '"/>' +
            '<rect x="' + (MX + MW - 1) + '" y="' + (y2 - 3) + '" width="6" height="6" rx="1.5" fill="' + dCol + '"/>';
        });
      });
      driveParts += '<text x="' + (laneX + 4) + '" y="' + (ROWS_TOP - 10) + '" fill="' + dCol +
        '" font-size="9" font-family="Geist Mono, monospace">驱动输出</text>';
    }

    var pinElems = pins.map(function (p) {
      var isPwr = p === "GND" || p === "3V3" || p === "5V";
      var c = p === "GND" ? "var(--gnd)" : isPwr ? "var(--vcc)" : "var(--accent-ink)";
      return '<text x="180" y="' + (y[p] + 4).toFixed(0) + '" fill="' + (isPwr ? c : "var(--muted)") + '" font-size="10.5" font-family="Geist Mono, monospace" text-anchor="end">' + p + "</text>" +
        '<circle cx="188" cy="' + y[p].toFixed(0) + '" r="2.6" fill="' + c + '"/>';
    }).join("");

    /* ---- POWER 供电分区：一条母线 + 单条入板馈线（旧版每节点各画长曲线，互相重叠） ---- */
    var amber = "var(--cat-power)", red = "var(--danger)";
    var powerParts = "";
    if (nPower) {
      /* 电源分区挂在模块列下方：一条垂直干线 + 各节点短支线，与模块框同宽对齐 */
      var powerTop = ROWS_TOP + rows.length * ROW_H + 30;
      var PBX = 452;
      var boardBottom = 44 + boardH;
      var busC = Object.keys(missingRails).length ? red : amber;
      var NODE_H = 46, NODE_GAP = 12;

      var nodes = [];
      providers.forEach(function (it) { nodes.push({ name: it.mod.name, sub: providesText(it.mod), ghost: false }); });
      shifters.forEach(function (it) { nodes.push({ name: it.mod.name, sub: "3.3V ↔ 5V 自动双向桥接", ghost: false }); });
      Object.keys(missingRails).forEach(function (k) {
        nodes.push({ name: "✕ 缺外部电源（" + RAIL_NAME[k] + "）", sub: "去加 12V 升压板或 18650 升压板", ghost: true });
      });

      var firstY = powerTop + 10;
      var lastMid = firstY + (nodes.length - 1) * (NODE_H + NODE_GAP) + NODE_H / 2;

      powerParts += '<text x="20" y="' + (powerTop - 8) + '" fill="' + busC + '" font-size="11" font-family="Geist Mono, monospace" letter-spacing="2">— POWER 供电 —</text>';
      /* 入板馈线：从板底向上进入基座 */
      powerParts += '<path d="M' + PBX + " " + boardBottom + " V" + (boardBottom - 22) + '" fill="none" stroke="' + busC + '" stroke-width="2" stroke-opacity=".85"/>' +
        '<circle cx="' + PBX + '" cy="' + (boardBottom - 22) + '" r="3" fill="' + busC + '"/>' +
        '<text x="' + (PBX + 9) + '" y="' + (boardBottom - 12) + '" fill="' + busC + '" font-size="9.5" font-family="Geist Mono, monospace">VIN / 5V 入板</text>';
      /* 垂直干线 */
      powerParts += '<path d="M' + PBX + " " + boardBottom + " V" + lastMid + '" fill="none" stroke="' + busC + '" stroke-width="2" stroke-opacity=".65" stroke-linecap="round"/>';

      nodes.forEach(function (n, i) {
        var top = firstY + i * (NODE_H + NODE_GAP);
        var mid = top + NODE_H / 2;
        var c = n.ghost ? red : amber;
        powerParts += '<path d="M' + PBX + " " + mid + " H470" + '" fill="none" stroke="' + c + '" stroke-width="1.6" stroke-opacity=".9"/>' +
          '<circle cx="' + PBX + '" cy="' + mid + '" r="2.6" fill="' + c + '"/>' +
          '<rect x="470" y="' + top + '" width="300" height="' + NODE_H + '" rx="8" fill="var(--box-fill)" stroke="' + c + '" stroke-width="1.4"' +
          (n.ghost ? ' stroke-dasharray="5 4"' : "") + "/>" +
          '<text x="500" y="' + (top + 20) + '" fill="var(--ink)" font-size="11.5" font-family="Archivo, sans-serif">' + M.esc(trunc(n.name, 22)) + "</text>" +
          '<text x="500" y="' + (top + 36) + '" fill="' + c + '" font-size="9.5" font-family="Geist Mono, monospace">' + M.esc(n.sub) + "</text>";
      });
    }

    var lg = [["I2C", "var(--accent)"], ["SPI", "var(--cat-comm)"], ["UART", "var(--cat-board)"],
      ["GPIO", "var(--line-strong)"], ["VCC", "var(--vcc)"], ["GND", "var(--gnd)"], ["驱动", "var(--cat-actuator)"]];
    var legend = '<g font-family="Geist Mono, monospace" font-size="10" fill="var(--muted)">' +
      lg.map(function (it, i) {
        var x = 476 + i * 56;
        return '<circle cx="' + x + '" cy="' + (H - 16) + '" r="3.2" fill="' + it[1] + '"/>' +
          '<text x="' + (x + 9) + '" y="' + (H - 13) + '">' + it[0] + "</text>";
      }).join("") + "</g>";

    return '<svg viewBox="0 0 900 ' + H + '" width="100%" role="img" aria-label="接线示意图">' +
      '<rect x="20" y="34" width="168" height="' + boardH + '" rx="10" fill="var(--box-fill)" stroke="var(--accent)" stroke-width="1.4"/>' +
      '<text x="34" y="56" fill="var(--ink)" font-size="12" font-weight="700" font-family="Archivo, sans-serif">' + M.esc(trunc(plan.board.name, 13)) + "</text>" +
      '<text x="34" y="72" fill="var(--muted)" font-size="9.5" font-family="Geist Mono, monospace">' + plan.board.logic + " · " + plan.board.gpio + " GPIO</text>" +
      pinElems + mods + busParts + driveParts + powerParts + legend + "</svg>";
  }

  function checkListHtml(plan) {
    function item(c, cls, ic) {
      return '<div class="check ' + cls + '"><span class="check-ic">' + ic + '</span><div><div class="check-title">' + M.esc(c.title) + "</div>" +
        (c.hint ? '<div class="check-hint">' + M.esc(c.hint) + "</div>" : "") + "</div></div>";
    }
    var ic = function (n) { return window.MODBAY_ICON.icon(n, { size: 15, w: 2 }); };
    var h = plan.errs.map(function (c) { return item(c, "check-error", ic("error")); }).join("");
    h += plan.warns.map(function (c) { return item(c, "check-warn", ic("warn")); }).join("");
    h += plan.oks.filter(function (c) { return c.hint; }).map(function (c) { return item(c, "check-ok", ic("check")); }).join("");
    return h || '<div class="check check-ok"><span class="check-ic">' + ic("check") + '</span><div><div class="check-title">暂无检查项</div></div></div>';
  }

  function bomTable(plan) {
    var rows = "";
    if (plan.board) {
      rows += '<tr><td><span class="catdot" style="background:' + U.catCss("board") + '"></span>' + M.esc(plan.board.name) + '</td>' +
        '<td class="num">1</td><td class="num">' + M.fmtMoney(plan.board.price) + '</td><td class="num">' + M.fmtMoney(plan.board.price) + "</td></tr>";
    }
    plan.items.forEach(function (it) {
      rows += '<tr><td><span class="catdot" style="background:' + U.catCss(it.mod.cat) + '"></span>' + M.esc(it.mod.name) + "</td>" +
        '<td class="num">' + it.qty + '</td><td class="num">' + M.fmtMoney(it.mod.price) + '</td><td class="num">' + M.fmtMoney(it.mod.price * it.qty) + "</td></tr>";
    });
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>物料</th><th class="num">数量</th><th class="num">单价</th><th class="num">小计</th></tr></thead>' +
      "<tbody>" + rows + "</tbody>" +
      '<tfoot><tr><td>合计</td><td class="num">' + M.totalCount() + '</td><td></td><td class="num">' + M.fmtMoney(M.totalPrice()) + "</td></tr></tfoot></table></div>";
  }

  /* 配套件：模块是裸板，真正焊起来还需要这些（不计入门店 BOM 合计） */
  function accTable(plan) {
    var list = M.accessories(plan);
    if (!list.length) return "";
    var rows = list.map(function (a) {
      return '<tr><td>' + M.esc(a.name) + '<div class="acc-why">' + M.esc(a.why) + "</div></td>" +
        '<td class="num">' + a.qty + "</td><td class=\"num\">" + M.fmtMoney(a.price) + "</td>" +
        '<td class="num">' + M.fmtMoney(a.price * a.qty) + "</td></tr>";
    }).join("");
    var sum = M.accTotal(plan);
    return '<div class="acc-block">' +
      '<div class="acc-head"><span>配套件（焊接必需）</span><b class="mono">¥' + sum.toFixed(2) + "</b></div>" +
      '<div class="tbl-wrap"><table class="tbl tbl-acc"><thead><tr><th>物料</th><th class="num">数量</th><th class="num">单价</th><th class="num">小计</th></tr></thead>' +
      "<tbody>" + rows + "</tbody></table></div></div>";
  }

  /* 交付方式：散件包 / 焊接成品 */
  function deliveryHtml(plan) {
    var cur = M.ui.delivery || "kit";
    var kit = M.serviceQuote(plan, "kit");
    var built = M.serviceQuote(plan, "built");
    function card(id, q, title, sub, feats) {
      var on = cur === id;
      return '<button class="dl-card' + (on ? " is-on" : "") + '" data-act="delivery" data-id="' + id + '">' +
        '<div class="dl-top"><span class="dl-name">' + title + "</span>" +
        (on ? '<span class="dl-tick">✓</span>' : "") + "</div>" +
        '<div class="dl-price mono">¥' + q.total.toFixed(2) + "</div>" +
        '<div class="dl-sub">' + sub + " · 约 " + q.days + " 天</div>" +
        (q.sw > 0 ? '<div class="dl-sw mono">含软件方案 · ' + M.esc(q.swName) + " ¥" + q.sw + "</div>" : "") +
        '<ul class="dl-feats">' + feats.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul></button>";
    }
    return '<section class="panel plan-span"><div class="panel-head"><h3>交付方式</h3>' +
      '<span class="mono">DELIVERY · 决定履约流程</span></div><div class="panel-body">' +
      '<div class="dl-grid" style="display:flex;gap:14px;width:100%">' +
      card("kit", kit, "散件包", "自己动手焊", [
        "模块 + 全部配套件",
        "杜邦线预剪好，附接线图",
        "不含底板打样与焊接"
      ]) +
      card("built", built, "焊接成品", "我们焊好测好发货", [
        "底板设计 + 打样（含在价内）",
        "焊接工时 ¥" + built.solder + "（" + built.pads + " 个焊点）",
        "通电测试 + 烧录示例程序",
        "整机装好，开箱即用"
      ]) +
      "</div>" +
      '<div class="dl-flow">' +
      (cur === "built"
        ? '<span class="dl-step is-done">付款</span><i>→</i><span class="dl-step">底板设计确认</span><i>→</i><span class="dl-step">打样</span><i>→</i><span class="dl-step">焊接</span><i>→</i><span class="dl-step">测试</span><i>→</i><span class="dl-step">发货</span>'
        : '<span class="dl-step is-done">付款</span><i>→</i><span class="dl-step">配货打包</span><i>→</i><span class="dl-step">发货</span>') +
      "</div></div></section>";
  }

  function pinTable(plan) {
    var rows = (plan.alloc ? plan.alloc.rows : []);
    var sharedNote = { i2c: "〔总线共享 · 靠地址区分〕", spi: "〔总线共享 · 独立片选〕" };
    var list = rows.map(function (r) {
      var note = sharedNote[r.mod.bus] ? ' <span style="color:var(--muted);font-size:11px">' + sharedNote[r.mod.bus] + "</span>" : "";
      /* 与接线图一致：每块模块都要接 VCC 与 GND */
      var railTxt = r.mod.rail === "ext" ? "外供轨" : (r.mod.rail === "5v" ? "5V" : "3V3");
      var pwr = ' <span style="color:var(--muted);font-size:11px">｜<span style="color:var(--vcc)">VCC→' + railTxt + '</span> <span style="color:var(--gnd)">GND→GND</span></span>';
      return "<tr><td>" + M.esc(r.mod.name) + "</td><td>" + U.BUS_LABEL[r.mod.bus] + '</td><td class="mono" style="font-size:12px">' +
        r.signals.map(function (s) { return s.name + " → " + s.pin; }).join("，") + note + pwr + "</td></tr>";
    });
    plan.items.forEach(function (it) {
      var m = it.mod, line = "";
      if (m.provides) {
        line = Object.keys(m.provides).map(function (k) {
          return "输出 " + (m.outV || (k === "ext" ? 12 : 5)) + "V / " + M.fmtMa(m.provides[k]) + " → " + (k === "ext" ? "外部供电轨" : "5V 轨");
        }).join("，");
      } else if (m.solves === "level") {
        line = "3.3V ↔ 5V 自动双向电平桥接";
      }
      if (line) list.push('<tr><td><span class="catdot" style="background:' + U.catCss("power") + '"></span>' + M.esc(m.name) + "</td><td>供电</td>" +
        '<td class="mono" style="font-size:12px">' + M.esc(line) + (it.qty > 1 ? " ×" + it.qty : "") + "</td></tr>");
    });
    /* 冲突自检：非总线信号引脚不允许出现在两行里（引擎本应保证，这里兜底展示） */
    var pinUsers = {};
    var dup = 0;
    rows.forEach(function (r) {
      if (r.mod.bus === "i2c" || r.mod.bus === "spi" || r.mod.bus === "uart") return;
      r.signals.forEach(function (s) {
        pinUsers[s.pin] = (pinUsers[s.pin] || 0) + 1;
        if (pinUsers[s.pin] > 1) dup++;
      });
    });
    var sharedN = rows.filter(function (r) { return sharedNote[r.mod.bus]; }).length;
    var headBadge = dup === 0
      ? '<span class="mono" style="color:var(--ok)">无冲突' + (sharedN ? " · 总线共享 " + sharedN + " 设备" : "") + "</span>"
      : '<span class="mono" style="color:var(--danger)">发现 ' + dup + " 处引脚重复</span>";
    var foot = '<p class="sec-desc" style="font-size:12px;margin:8px 4px 0">I2C / SPI 设备共享同一组总线引脚（靠设备地址与片选区分），<b>不是冲突</b>；专用 GPIO 均独立分配，引擎保证无重复、I2C 同总线地址重复会直接报错。</p>';
    return '<div style="padding:12px 14px 0">' + headBadge + "</div>" +
      '<div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl"><thead><tr><th>模块</th><th>接口</th><th>信号 → 引脚</th></tr></thead><tbody>' +
      (list.join("") || '<tr><td colspan="3" style="color:var(--muted)">暂无分配</td></tr>') + "</tbody></table></div>" + foot;
  }

  /* 装配估算：下单前知道要买几根杜邦线、大概多重 */
  function assemblyHint(plan) {
    var rows = plan.alloc ? plan.alloc.rows : [];
    var sig = 0, pwr = 0;
    rows.forEach(function (r) {
      sig += r.signals.length;
      pwr += 1;                                   /* GND 人人都有 */
      if (r.mod.rail !== "ext") pwr += 1;         /* 非外供模块另有 VCC */
    });
    var W = { sensor: 6, actuator: 25, display: 25, comm: 12, power: 45 };
    var weight = plan.board ? 30 : 0;
    plan.items.forEach(function (it) { weight += (W[it.mod.cat] || 10) * it.qty; });
    return '<p class="sec-desc" style="font-size:12px;margin:10px 14px 0">装配估算：杜邦线 <b>' + (sig + pwr) + '</b> 根（信号 ' + sig +
      " + 电源/地 " + pwr + "）· 总重约 <b>" + weight + " g</b>（含基座，不含外壳，按类目估算）</p>";
  }

  function railTable(plan) {
    if (!plan.rails) return '<p class="sec-desc">选择基座后显示电源预算。</p>';
    var html = "";
    Object.keys(plan.rails).forEach(function (k) {
      var r = plan.rails[k];
      if (r.used === 0 && r.max === 0) return;
      var pct = r.max ? Math.min(100, Math.round(r.used / r.max * 100)) : (r.used ? 100 : 0);
      html += '<div class="rail ' + (r.used > r.max ? "over" : r.used ? "ok" : "") + '" style="margin-bottom:18px"><div class="rail-head"><b>' + r.label + "</b>" +
        "<span>" + M.fmtMa(r.used) + " / " + (r.max ? M.fmtMa(r.max) : "无电源") + (r.extra ? "（含外供 " + M.fmtMa(r.extra) + "）" : "") + "</span></div>" +
        '<div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
    });
    return html || '<p class="sec-desc">当前方案无外接用电模块。</p>';
  }

  function accessoryPanel(plan) {
    /* 配件推荐（提升客单价的转化位）：只推方案真缺的，不做无关打扰 */
    var has = function (id) { return plan.items.some(function (it) { return it.mod.id === id; }); };
    var recs = [];
    if ((has("tb6612") || has("l298n") || has("stepper28") || has("tt") || has("sg90")) && !has("boost12v") && !has("lipo")) recs.push("boost12v");
    if (plan.items.some(function (it) { return it.mod.rail === "ext"; }) && !has("lipo") && !has("boost12v")) recs.push("lipo");
    if (plan.warns.some(function (w) { return w.code === "W_LEVEL"; }) && !has("levelshifter")) recs.push("levelshifter");
    if (!recs.length) return "";
    var rows = recs.map(function (id) {
      var m = M.ALL[id];
      return '<div style="display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:10px;padding:8px 10px">' +
        '<span class="slot-bar" style="background:' + U.catCss(m.cat) + '"></span>' +
        '<span style="flex:1;min-width:0"><span style="font-size:13px;font-weight:600">' + M.esc(m.name) + '</span><br><span style="font-size:11.5px;color:var(--muted)">' + M.esc(m.desc.slice(0, 40)) + "…</span></span>" +
        '<span class="mono" style="font-size:12.5px">' + M.fmtMoney(m.price) + "</span>" +
        '<button class="btn btn-ghost btn-sm" data-act="add" data-id="' + m.id + '">+ 加购</button></div>';
    }).join("");
    return '<div class="panel plan-span" style="margin-top:18px"><div class="panel-head"><h3>可能还需要</h3><span class="mono">ADD-ONS</span></div>' +
      '<div class="panel-body" style="display:flex;flex-direction:column;gap:8px">' + rows +
      '<p class="sec-desc" style="font-size:12px;margin-top:4px">按你的选型缺口推荐；加购后校验与 BOM 实时重算。</p></div></div>';
  }

  function viewPlan(query) {
    var shared = false, brokenLink = false;
    if (query && query.indexOf("p=") === 0) {
      shared = M.decodePlan(query.slice(2));
      if (!shared) brokenLink = true;   /* 链接被截断 / 乱码 / 数据损坏 */
    }
    var plan = M.check();
    if (brokenLink && !plan.board && !plan.items.length) {
      return '<div class="sec-head"><span class="sec-label">BROKEN LINK</span><h2 class="sec-title">方案链接已损坏</h2>' +
        '<p class="sec-desc">分享链接里的方案数据没能解析出来——多半是被聊天软件截断或复制不全。请让分享者重新点一次「分享链接」发你完整地址。</p></div>' +
        '<div class="bay-empty" style="padding:48px 24px"><b>你可以先做这些</b>' +
        '<div style="display:flex;gap:12px;justify-content:center;margin-top:16px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" data-act="goto" data-hash="#/plaza">去方案广场逛逛</button>' +
        '<button class="btn btn-ghost" data-act="goto" data-hash="#/build">自己搭一个</button></div></div>';
    }
    if (!plan.board && !plan.items.length) {
      return '<div class="sec-head"><span class="sec-label">PLAN PREVIEW</span><h2 class="sec-title">方案预览</h2></div>' +
        '<div class="bay-empty" style="padding:64px 24px"><b>还没有可预览的方案</b>先去配置台选型。</div>' +
        '<div style="display:flex;gap:12px;justify-content:center;margin-top:18px">' +
        '<button class="btn btn-primary" data-act="goto" data-hash="#/build">进入配置台</button>' +
        '<button class="btn btn-ghost" data-act="goto" data-hash="#/explore">浏览模块库</button></div>';
    }
    var now = new Date();
    var stamp = "MODBAY-PLAN-" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" + M.hashStr(M.encodePlan()).toString(36).slice(0, 5).toUpperCase();
    var i2cCount = (plan.alloc ? plan.alloc.rows : []).filter(function (r) { return r.mod.bus === "i2c"; }).length;
    var gpioLeft = plan.alloc ? plan.alloc.poolLeft.length : 0;

    return (brokenLink ? '<div class="panel plan-span" style="margin-bottom:18px;border-color:var(--warn)"><div class="panel-body" style="display:flex;gap:12px;align-items:center">' +
      '<span class="plan-badge" style="color:var(--warn);border-color:var(--warn)">链接已损坏</span>' +
      '<span style="font-size:13px;color:var(--muted)">分享链接的数据没解析出来，下面显示的是你本机当前的方案。请让分享者重新发一次完整链接。</span></div></div>' : "") +
      '<div class="plan-head"><div><span class="sec-label" style="margin-bottom:10px;display:inline-block">' + (shared ? "SHARED PLAN · 来自链接" : "PLAN PREVIEW") + "</span>" +
      '<h1 class="plan-title">你的方案，长这样。</h1>' +
      '<div class="plan-meta">' + stamp + " · 生成于 " + now.toLocaleString("zh-CN", { hour12: false }) + (plan.board ? " · 基座 " + M.esc(plan.board.name) : "") +
      (M.remixFrom ? ' · <span style="color:var(--accent-ink)">Remix 自 ' + M.esc(M.remixFrom.name) + "（作者 " + M.esc(M.remixFrom.author) + "）</span>" : "") + "</div></div>" +
      '<div class="plan-actions">' +
      '<button class="btn btn-primary btn-sm" data-act="goto" data-hash="#/checkout">' + window.MODBAY_ICON.icon("cart", { size: 15 }) + ' 下单购买</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="plaza-publish">发布到广场</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="copy">' + window.MODBAY_ICON.icon("copy", { size: 15 }) + ' 复制清单</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="share">' + window.MODBAY_ICON.icon("share", { size: 15 }) + ' 分享链接</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="export">' + window.MODBAY_ICON.icon("download", { size: 15 }) + ' 导出 JSON</button>' +
      '<button class="btn btn-line btn-sm" data-act="print">' + window.MODBAY_ICON.icon("print", { size: 15 }) + ' 打印</button>' +
      "</div></div>" +

      '<div class="kv-grid plan-span" style="margin-bottom:18px">' +
      '<div class="kv-cell"><span>组件数</span><b>' + M.totalCount() + "</b></div>" +
      '<div class="kv-cell"><span>BOM 总价</span><b>' + M.fmtMoney(M.totalPrice()) + "</b></div>" +
      '<div class="kv-cell"><span>I2C 设备</span><b>' + i2cCount + "</b></div>" +
      '<div class="kv-cell"><span>GPIO 余量</span><b>' + gpioLeft + "</b></div>" +
      '<div class="kv-cell"><span>硬校验</span><b style="color:' + (plan.errs.length ? "var(--danger)" : "var(--ok)") + '">' + (plan.errs.length ? plan.errs.length + " FAIL" : "PASS") + "</b></div>" +
      "</div>" +

      '<div class="plan-grid">' +
      '<section class="panel"><div class="panel-head"><h3>校验报告</h3><span class="mono">' + plan.errs.length + " ERR / " + plan.warns.length + " WARN</span></div>" +
      '<div class="panel-body"><div class="check-list">' + checkListHtml(plan) + "</div></div></section>" +

      '<section class="panel plan-span"><div class="panel-head"><h3>BOM 物料清单</h3><span class="mono">CNY</span></div>' +
      '<div class="panel-body" style="padding:0">' + bomTable(plan) + assemblyHint(plan) + accTable(plan) + "</div></section>" +
      deliveryHtml(plan) +

      '<section class="panel plan-span"><div class="panel-head"><h3>3D 装配预览</h3><span class="mono">DRAG TO ORBIT</span></div>' +
      '<div class="panel-body" style="padding:0"><div class="v3-wrap"><div class="view3d" id="view3d"></div><aside class="v3-side" id="v3-side"></aside></div>' +
      '<p class="wiring-cap">基座 <b>' + (plan.board ? M.esc(plan.board.name) : "—") + '</b> 的立体装配示意：左端是叠装核心板（屏蔽罩 / USB-C / 双排针 / 电源电路），右侧按模块实测尺寸分行居中插装、带接触阴影；底板尺寸随选型自动伸缩，电源件落在地面并连线入板。拖拽旋转 · 滚轮缩放 · 点击模块看参数。</p></div></section>' +

      '<section class="panel plan-span"><div class="panel-head"><h3>接线示意图</h3><span class="mono">AUTO-GENERATED WIRING</span></div>' +
      '<div class="panel-body"><div class="wiring">' + wiringSvg(plan) + '</div><p class="wiring-cap">正交走线，像真实线束：<b>红=VCC 供电</b>（3.3V/5V 按模块电源轨取）、<b>灰=GND 共地</b>（每块模块都要接）、蓝/紫/青=信号总线（I2C 两根 / SPI 含片选）；琥珀虚线=外部供电轨，红虚线=缺外供。所有线必须共地，否则通信不稳。</p></div></section>' +

      '<section class="panel plan-span"><div class="panel-head"><h3>引脚分配表</h3><span class="mono">PIN MAP</span></div>' +
      '<div class="panel-body" style="padding:0">' + pinTable(plan) + "</div></section>" +

      window.MODBAY_BOARD.view(plan) +
      window.MODBAY_CODE.view(plan) +
      window.MODBAY_CANVAS.view(plan) +

      '<section class="panel plan-span"><div class="panel-head"><h3>电源预算</h3><span class="mono">POWER BUDGET</span></div>' +
      '<div class="panel-body">' + railTable(plan) +
      '<div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" data-act="goto" data-hash="#/build">← 继续改方案</button>' +
      '<button class="btn btn-line btn-sm" data-act="clear">' + window.MODBAY_ICON.icon("trash", { size: 15 }) + ' 清空重新来</button></div></div></section>' +
      "</div>" + accessoryPanel(plan);
  }

  window.MODBAY_VIEW_PLAN = viewPlan;
  window.MODBAY_WIRING = wiringSvg;
})();
