/* ============ MODBAY 应用核心：数据装配 / 状态 / 校验引擎 / SVG 生成 ============ */
(function () {
  "use strict";

  var BOARDS = window.MODBAY_BOARDS || [];
  var MODULES = (window.MODBAY_MODULES_1 || []).concat(window.MODBAY_MODULES_2 || [], window.MODBAY_MODULES_3 || []);
  var PRESETS = window.MODBAY_PRESETS || [];

  var ALL = {};
  BOARDS.concat(MODULES).forEach(function (m) { ALL[m.id] = m; });

  var CATS = [
    { id: "board", name: "基座开发板", cssVar: "--cat-board", glyph: "board" },
    { id: "sensor", name: "传感器", cssVar: "--cat-sensor", glyph: "sensor" },
    { id: "actuator", name: "执行与电机", cssVar: "--cat-actuator", glyph: "motor" },
    { id: "display", name: "显示与交互", cssVar: "--cat-display", glyph: "screen" },
    { id: "comm", name: "通信与存储", cssVar: "--cat-comm", glyph: "wave" },
    { id: "power", name: "电源与配件", cssVar: "--cat-power", glyph: "bolt" }
  ];
  var CATMAP = {};
  CATS.forEach(function (c) { CATMAP[c.id] = c; });

  /* ---------- 状态 ---------- */
  var state = { board: null, items: {} };
  var ui = { cat: "all", q: "", sort: "default", delivery: "kit", sw: "pro" };

  function save() {
    try {
      localStorage.setItem("modbay.plan.v1", JSON.stringify(state));
    } catch (e) { /* 隐私模式等场景静默失败 */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem("modbay.plan.v1");
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d && typeof d === "object") {
        if (d.board && ALL[d.board]) state.board = d.board;
        if (d.items && typeof d.items === "object") {
          state.items = {};
          Object.keys(d.items).forEach(function (id) {
            /* 过滤历史脏数据：基座 id / 已下架 id 不能留在 items 里 */
            if (ALL[id] && ALL[id].cat !== "board" && d.items[id] > 0) state.items[id] = Math.min(9, Math.round(d.items[id]));
          });
        }
      }
    } catch (e) { /* ignore */ }
  }

  /* ---------- 热度统计（本机操作计数） ---------- */
  var HEAT_KEY = "modbay.heat.v1";
  function todayKey(d0) {
    var d = d0 || new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function track(n) {
    try {
      var d = JSON.parse(localStorage.getItem(HEAT_KEY) || "{}");
      var k = todayKey();
      d[k] = (d[k] || 0) + (n || 1);
      localStorage.setItem(HEAT_KEY, JSON.stringify(d));
    } catch (e) { /* noop */ }
  }
  function heatData() {
    try { return JSON.parse(localStorage.getItem(HEAT_KEY)) || {}; } catch (e) { return {}; }
  }

  function setBoard(id) {
    if (id && !ALL[id]) return;
    if (state.board === id) return;
    state.board = id;
    save();
    track(1);
  }
  function addItem(id) {
    if (!ALL[id]) return;
    /* 基座是单选，不能被当成普通模块加进 items */
    if (ALL[id].cat === "board") { setBoard(id); return; }
    state.items[id] = Math.min(9, (state.items[id] || 0) + 1);
    save();
    track(1);
  }
  function delItem(id) { delete state.items[id]; save(); }
  function qty(id, d) {
    if (!ALL[id] || ALL[id].cat === "board") return;
    var v = (state.items[id] || 0) + d;
    if (v <= 0) delete state.items[id];
    else state.items[id] = Math.min(9, v);
    save();
  }
  function clearAll() { state.board = null; state.items = {}; save(); }

  function planItems() {
    var out = [];
    Object.keys(state.items).forEach(function (id) {
      if (state.items[id] > 0) out.push({ mod: ALL[id], qty: state.items[id] });
    });
    var order = { board: 0, sensor: 1, actuator: 2, display: 3, comm: 4, power: 5 };
    out.sort(function (a, b) {
      return (order[a.mod.cat] - order[b.mod.cat]) || a.mod.price - b.mod.price;
    });
    return out;
  }
  function totalPrice() {
    var t = state.board ? ALL[state.board].price : 0;
    planItems().forEach(function (it) { t += it.mod.price * it.qty; });
    return t;
  }
  function totalCount() {
    var n = state.board ? 1 : 0;
    planItems().forEach(function (it) { n += it.qty; });
    return n;
  }

  /* ---------- 引脚分配 ---------- */
  /* SPI 器件的控制脚命名（mod.pins 即控制脚数量）：
     之前 allocate 只分配了 CS，DC/RST/CE/DIO0 全被丢掉——接线图与 BSP 都会漏线。 */
  var CTRL_PINS = {
    tft18: ["DC", "RST", "BL"], ili9341: ["DC", "RST", "BL"],
    lora: ["DIO0", "RST"], nrf24: ["CE"], rc522: ["RST"], w5500: ["INT"], tfcard: []
  };

  function allocate(board, items) {
    var rows = [];
    var problems = [];
    var i2c = board.buses.i2c.map(function (b) { return { sda: b.sda, scl: b.scl, addrs: [] }; });
    var spi = board.buses.spi.slice();
    var uart = board.buses.uart.map(function (u) { return { tx: u.tx, rx: u.rx, used: false }; });

    var busPins = {};
    Object.keys(board.buses).forEach(function (k) {
      board.buses[k].forEach(function (b) {
        Object.keys(b).forEach(function (sig) { busPins[b[sig]] = true; });
      });
    });

    var pool = board.pins.slice();
    function takePin() {
      while (pool.length) {
        var p = pool.shift();
        if (!busPins[p]) return p;
      }
      return null;
    }

    items.forEach(function (it) {
      var mod = it.mod;
      for (var n = 0; n < it.qty; n++) {
        var signals = [];
        if (mod.bus === "i2c") {
          var bus = null;
          for (var i = 0; i < i2c.length; i++) {
            if (i2c[i].addrs.indexOf(mod.addr) === -1) { bus = i2c[i]; break; }
          }
          if (!bus) {
            problems.push({ sev: "error", code: "E_I2C",
              title: mod.name + "：I2C 总线或地址不足",
              hint: "该板只有 " + i2c.length + " 条 I2C，且总线 " + mod.addr + " 已被占用。把冲突的某个模块改址（AD0/焊盘），或换双 I2C 主控。" });
          } else {
            bus.addrs.push(mod.addr);
            signals = [{ name: "SDA", pin: bus.sda }, { name: "SCL", pin: bus.scl }];
          }
        } else if (mod.bus === "spi") {
          if (!spi.length) {
            problems.push({ sev: "error", code: "E_SPI", title: mod.name + "：无 SPI 总线", hint: "更换带 SPI 的基座。" });
          } else {
            signals = [
              { name: "SCK", pin: spi[0].sck },
              { name: "MOSI", pin: spi[0].mosi },
              { name: "MISO", pin: spi[0].miso }
            ];
            if (mod.cs) {
              var cs = takePin();
              if (cs) signals.push({ name: "CS", pin: cs });
              else problems.push({ sev: "error", code: "E_GPIO", title: mod.name + "：GPIO 余量不足", hint: "精简模块或换 IO 更多的基座。" });
            }
            /* 控制脚：显示屏的 DC/RST/BL、无线模块的 CE/DIO0/RST、网口的 INT */
            var ctrlNames = CTRL_PINS[mod.id];
            if (!ctrlNames) {
              ctrlNames = [];
              for (var ci = 0; ci < (mod.pins || 0); ci++) ctrlNames.push("CTRL" + (ci + 1));
            }
            for (var cj = 0; cj < ctrlNames.length; cj++) {
              var cp = takePin();
              if (cp) signals.push({ name: ctrlNames[cj], pin: cp });
              else problems.push({ sev: "error", code: "E_GPIO", title: mod.name + "：" + ctrlNames[cj] + " 无可用 GPIO",
                hint: "该模块除总线外还需 " + ctrlNames.length + " 个控制脚，精简其他模块或换 IO 更多的基座。" });
            }
          }
        } else if (mod.bus === "uart") {
          var u = null;
          for (var j = 0; j < uart.length; j++) if (!uart[j].used) { u = uart[j]; break; }
          if (!u) {
            problems.push({ sev: "error", code: "E_UART",
              title: mod.name + "：串口已被占用",
              hint: "该板只有 " + uart.length + " 路可用 UART，GSM/串口屏等模块换板或改用 SPI 版本。" });
          } else {
            u.used = true;
            signals = [{ name: "TX", pin: u.tx }, { name: "RX", pin: u.rx }];
          }
        } else {
          for (var k = 0; k < (mod.pins || 0); k++) {
            var p = takePin();
            if (p) signals.push({ name: "IO" + (k + 1), pin: p });
          }
          var got = signals.length;
          if (got < (mod.pins || 0)) {
            problems.push({ sev: "error", code: "E_GPIO",
              title: mod.name + "：GPIO 余量不足（需 " + (mod.pins || 0) + "，仅余 " + (board.pins.length - pool.length) + " 可用之外）",
              hint: "减少控制脚占用（如改用 I2C 版本），或换 IO 更多的基座。" });
          }
        }
        if (signals.length) rows.push({ mod: mod, signals: signals });
      }
    });
    return { rows: rows, problems: problems, poolLeft: pool.filter(function (p) { return !busPins[p]; }) };
  }

  /* ---------- 综合校验 ---------- */
  function check() {
    var board = state.board ? ALL[state.board] : null;
    var items = planItems();
    var errs = [], warns = [], oks = [];
    var rails = null, alloc = null;

    if (!board) {
      if (items.length) {
        errs.push({ code: "E_NO_BOARD", title: "尚未选择基座", hint: "方案必须有一块主控板。去左侧「基座开发板」选一块。" });
      } else {
        oks.push({ code: "OK_EMPTY", title: "配置台是空的", hint: "先选一块基座，再加功能模块。" });
      }
    } else {
      alloc = allocate(board, items);
      alloc.problems.forEach(function (p) { errs.push(p); });

      /* ---- 电源预算 ----
         分轨累加「典型 + 峰值」，并按效率、线损、安全降额给出可执行结论：
         · 有效容量 = 额定 × 降额系数（0.8），留出启动/温升余量
         · 升压/降压链路按效率折算上游需求（5V 轨 88%，外供 85%）
         · 杜邦线往返电阻按 0.08Ω/根估算压降，末端电压低于器件下限即告警
         · 按峰值电流给出滤波电容建议（每 100mA 约 100µF） */
      var DERATE = 0.8;          /* 安全降额系数 */
      var WIRE_R = 0.08;         /* 单根杜邦线电阻 Ω（往返 ×2） */
      var EFF = { "5v": 0.88, ext: 0.85 };
      var extProviders = 0, v5Providers = 0;
      items.forEach(function (it) {
        if (it.mod.provides) {
          if (it.mod.provides.ext) extProviders += it.mod.provides.ext * it.qty;
          if (it.mod.provides["5v"]) v5Providers += it.mod.provides["5v"] * it.qty;
        }
      });

      rails = {
        "3v3": { label: "3.3V 轨", used: 0, peak: 0, max: board.supply3v3, src: "板载 LDO", eff: 1 },
        "5v": { label: "5V 轨", used: 0, peak: 0, max: board.supply5v + v5Providers, extra: v5Providers, src: "USB / 升压", eff: EFF["5v"] },
        ext: { label: "外部供电轨", used: 0, peak: 0, max: extProviders, extra: extProviders, src: "外供", eff: EFF.ext }
      };

      var capNeed = { "3v3": 0, "5v": 0, ext: 0 };
      items.forEach(function (it) {
        var r = rails[it.mod.rail];
        if (!r) return;
        r.used += it.mod.ma * it.qty;
        r.peak += (it.mod.peak || it.mod.ma) * it.qty;
        capNeed[it.mod.rail] += (it.mod.peak || it.mod.ma) * it.qty;
      });

      Object.keys(rails).forEach(function (k) {
        var r = rails[k];
        if (r.used === 0) { r.verdict = "idle"; return; }
        r.effMax = r.max * DERATE;                       /* 降额后的可用容量（仅用于峰值判定） */
        r.headroom = r.effMax - r.peak;                  /* 按峰值算余量 */
        r.pct = r.max > 0 ? r.used / r.max : 9;          /* 典型负载相对额定容量的占比 */
        r.drop = (r.peak / 1000) * WIRE_R * 2;           /* 线损压降 V */
        r.cap = Math.max(100, Math.round(capNeed[k] / 100) * 100);  /* 建议滤波电容 µF */
        /* 上游折算：升压/降压链路需要从电池多拿多少 */
        r.upstream = r.eff < 1 ? Math.round(r.peak / r.eff) : r.peak;

        if (r.max === 0) {
          r.verdict = "missing";
          errs.push({
            code: "E_POWER_" + k.toUpperCase(),
            title: r.label + "：需求 " + fmtMa(r.used) + "，但没有任何电源提供",
            hint: "电机/GSM 等大电流负载必须外供：加入「12V 升压电源」或「18650 升压板」。"
          });
        } else if (r.used > r.max) {
          r.verdict = "over";
          errs.push({
            code: "E_POWER_" + k.toUpperCase(),
            title: r.label + "超载：" + fmtMa(r.used) + " > " + fmtMa(r.max),
            hint: "典型负载已超出电源容量。分流到其他轨，或降低模块数量 / 换更大电源。"
          });
        } else if (r.pct >= 0.85) {
          r.verdict = "tight";
          warns.push({
            code: "W_POWER_" + k.toUpperCase(),
            title: r.label + "吃紧：典型 " + fmtMa(r.used) + " / 额定 " + fmtMa(r.max) +
              "（" + Math.round(r.pct * 100) + "%），峰值余量 " + fmtMa(Math.max(0, r.headroom)),
            hint: "余量不足 15%，射频发送/电机启动时可能掉压。建议外供分摊，并就近加 " + r.cap + "µF 电容。"
          });
        } else if (r.peak > r.effMax) {
          /* 峰值超降额容量但典型占比尚可：靠电容与分流吸收，属警告而非错误 */
          r.verdict = "peak";
          warns.push({
            code: "W_PEAK_" + k.toUpperCase(),
            title: r.label + "峰值接近上限：" + fmtMa(r.peak) + " > 降额容量 " + fmtMa(r.effMax) +
              "（典型 " + fmtMa(r.used) + " / 额定 " + fmtMa(r.max) + "）",
            hint: "启动或堵转瞬间会掉压。就近并联 " + r.cap + "µF 电容吸收，或把大电流负载改外供。"
          });
        } else {
          r.verdict = "ok";
          oks.push({
            code: "OK_POWER_" + k.toUpperCase(),
            title: r.label + "预算充足：" + fmtMa(r.used) + " / " + fmtMa(r.effMax) +
              "（" + Math.round(r.pct * 100) + "%），峰值余量 " + fmtMa(r.headroom),
            hint: ""
          });
        }

        /* 线损：末端电压低于 4.5V（5V 轨）/ 3.0V（3.3V 轨）即告警 */
        var vNom = k === "5v" ? 5 : k === "3v3" ? 3.3 : 12;
        var vEnd = vNom - r.drop;
        r.vEnd = vEnd;
        if (r.drop > vNom * 0.08 && r.verdict !== "missing") {
          warns.push({
            code: "W_DROP_" + k.toUpperCase(),
            title: r.label + "线损压降 " + r.drop.toFixed(2) + "V，末端约 " + vEnd.toFixed(2) + "V",
            hint: "峰值 " + fmtMa(r.peak) + " 走细杜邦线会明显掉压。改用粗线/短距离直供，或把负载分散到多条线。"
          });
        }
        /* 大峰值负载的电容建议 */
        if (r.peak >= 500 && (r.verdict === "ok" || r.verdict === "tight")) {
          oks.push({
            code: "OK_CAP_" + k.toUpperCase(),
            title: r.label + "建议就近并联 " + r.cap + "µF 电解 + 100nF 陶瓷",
            hint: "峰值 " + fmtMa(r.peak) + "，用于吸收电机启动与射频发送的瞬时电流。"
          });
        }
      });

      /* 多级供电拓扑：5V 来自外供时，反推电池侧需求 */
      if (rails["5v"].max > 0 && rails["5v"].extra > 0 && rails["5v"].peak > 0) {
        var batt = Math.round(rails["5v"].upstream);
        oks.push({
          code: "OK_UPSTREAM",
          title: "5V 由升压模块提供，电池侧需承担约 " + fmtMa(batt) + "（效率 " + Math.round(EFF["5v"] * 100) + "%）",
          hint: "升压链路有损耗，选电池容量时按这个数算续航，别只按模块标称电流。"
        });
      }

      /* 电平匹配（有电平转换模块则降级） */
      var shifter = items.some(function (it) { return it.mod.solves === "level"; });
      var boardLv = parseFloat(board.logic);
      var bad = [];
      items.forEach(function (it) {
        if (it.mod.level.indexOf(boardLv) === -1) bad.push(it.mod);
      });
      if (bad.length) {
        if (shifter) {
          oks.push({ code: "OK_LEVEL", title: bad.length + " 个模块逻辑电平不匹配，已由电平转换模块覆盖",
            hint: "TXS0108 双向转换已计入预算，5V 信号不会倒灌主控。" });
        } else {
          warns.push({ code: "W_LEVEL", title: "逻辑电平不匹配：" + bad.map(function (m) { return m.name; }).slice(0, 3).join("、") + (bad.length > 3 ? " 等 " + bad.length + " 个" : ""),
            hint: "主控 IO 为 " + board.logic + "。串分压电阻或加「TXS0108 四路电平转换」，否则可能烧 IO。" });
        }
      }

      /* 电机峰值电流 */
      var motors = items.filter(function (it) { return it.mod.peak >= 300; });
      if (motors.length) {
        warns.push({ code: "W_MOTOR", title: "大峰值电流负载：" + motors.map(function (it) { return it.mod.name; }).slice(0, 2).join("、") + (motors.length > 2 ? " 等" : ""),
          hint: "堵转/启动电流可达 " + fmtMa(Math.max.apply(null, motors.map(function (it) { return it.mod.peak; }))) + "，务必用粗线直供并加大电容，绝对不要走主控稳压。" });
      }

      /* I2C 共享提示 */
      if (alloc) {
        var i2cCount = 0;
        alloc.rows.forEach(function (r) { if (r.mod.bus === "i2c") i2cCount++; });
        if (i2cCount >= 2) {
          oks.push({ code: "OK_I2C_SHARE", title: i2cCount + " 个 I2C 设备总线共享", hint: "同总线靠 7 位地址区分，上拉电阻 4.7kΩ，地址冲突会自动报错。" });
        }
        if (!items.length) {
          warns.push({ code: "W_ONLY_BOARD", title: "只选了基座，还没有功能模块", hint: "去左侧模块库挑几个传感器/执行器。" });
        }
      }
      if (!errs.length && !warns.length) {
        oks.push({ code: "OK_ALL", title: "全部检查通过，方案可焊接", hint: totalCount() + " 个组件，预计 " + fmtMoney(totalPrice()) + "。" });
      }
    }

    /* 统一打上严重度标记，供渲染层着色（errs/warns/oks 三档） */
    errs.forEach(function (c) { c.sev = "error"; });
    warns.forEach(function (c) { c.sev = "warn"; });
    oks.forEach(function (c) { c.sev = "ok"; });

    return { board: board, items: items, alloc: alloc, rails: rails, errs: errs, warns: warns, oks: oks,
      pass: errs.length === 0 };
  }

  /* ---------- 工具 ---------- */
  function fmtMa(ma) {
    if (ma >= 1000) return (Math.round(ma / 100) / 10) + "A";
    return (Math.round(ma * 10) / 10) + "mA";
  }
  function fmtMoney(n) {
    var v = Math.round(n * 100) / 100;
    return "¥" + (Number.isInteger(v) ? v : v.toFixed(2));
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  /* ---- 配套件推断 ----
     模块本身只是裸板，真正能焊起来还需要电池盒、开关、DC 座、杜邦线、螺丝、底板。
     这里按方案内容自动推断，不额外计入门店 BOM（BOM 仍是器件合计）。 */
  var ACC_CAT = { bat: "电源", sw: "开关", conn: "连接", mech: "结构" };

  function accessories(plan) {
    plan = plan || check();
    var items = plan.items || [];
    var list = [];
    var has18650 = items.some(function (it) { return it.mod.id === "lipo" || it.mod.id === "battery18650"; });
    var hasExt = items.some(function (it) { return it.mod.rail === "ext"; });
    var hasMotor = items.some(function (it) { return it.mod.cat === "actuator"; });
    var hasDisplay = items.some(function (it) { return it.mod.cat === "display"; });
    var nMod = items.reduce(function (a, it) { return a + it.qty; }, 0);

    if (has18650) {
      list.push({ name: "18650 电池盒（带引线）", qty: 1, price: 3.5, cat: "bat", why: "承载电芯并为升压板供电" });
      list.push({ name: "18650 锂电芯 2600mAh", qty: 1, price: 18, cat: "bat", why: "可充电供电，注意极性" });
    }
    if (hasExt || has18650) {
      list.push({ name: "船型开关 SS-12D00", qty: 1, price: 1.2, cat: "sw", why: "总电源通断，避免带电插拔" });
    }
    if (hasExt) {
      list.push({ name: "DC-005 电源座", qty: 1, price: 1.5, cat: "conn", why: "外接 12V 适配器输入" });
      list.push({ name: "自恢复保险丝 2A", qty: 1, price: 0.8, cat: "bat", why: "电机堵转时保护电源" });
    }
    /* 杜邦线：每个模块约 3 根（电源/地/信号），电机驱动按 6 根 */
    var wires = 0;
    items.forEach(function (it) {
      wires += (it.mod.cat === "actuator" ? 6 : it.mod.bus === "none" ? 2 : 3) * it.qty;
    });
    if (wires > 0) {
      list.push({ name: "杜邦线 母对母 20cm", qty: wires, price: 0.15, cat: "conn", why: "模块与主控的信号/供电连线" });
    }
    if (hasMotor) {
      list.push({ name: "电机固定支架 + M2 螺丝", qty: 1, price: 4.5, cat: "mech", why: "电机/舵机与底板固定" });
    }
    if (hasDisplay) {
      list.push({ name: "亚克力面板（屏幕开窗）", qty: 1, price: 8, cat: "mech", why: "保护屏幕并遮挡排线" });
    }
    list.push({ name: "M3×6 尼龙螺丝 + 螺母", qty: Math.max(4, nMod * 2), price: 0.2, cat: "mech", why: "模块与底板固定" });
    list.push({ name: "亚克力底板（激光切割）", qty: 1, price: 12, cat: "mech", why: "承载全部模块，预留安装孔" });
    return list;
  }

  function accTotal(plan) {
    return accessories(plan).reduce(function (a, x) { return a + x.price * x.qty; }, 0);
  }

  /* ---- 交付档位报价 ----
     kit  : 散件包（模块 + 配件，用户自己焊）
     built: 焊接成品（底板设计 + 打样 + 焊接 + 测试 + 发货） */
  var SERVICE = {
    fabBase: 35,        /* 打样起步价（5 片内） */
    fabStep: 18,        /* 超出 5 片后每片 */
    solderPer: 0.8,     /* 每个焊点 */
    solderMin: 25,      /* 焊接最低工时 */
    test: 15,           /* 通电测试 + 烧录示例程序 */
    design: 0           /* 底板设计免费（含在打样里） */
  };

  function estimatePads(plan) {
    plan = plan || check();
    var pads = 0;
    (plan.items || []).forEach(function (it) {
      /* 每个模块按 4 个焊点估（VCC/GND/信号×2），驱动板与屏幕更多 */
      var per = it.mod.cat === "actuator" ? 8 : it.mod.cat === "display" ? 6 : 4;
      pads += per * it.qty;
    });
    if (plan.board) pads += 8;
    return pads;
  }

  /* 软件方案档位：价格只在这里定义一次，方案页与下单页同源 */
  var SW_PRICE = { basic: 0, pro: 68, cloud: 168, ent: 980 };
  var SW_NAME = { basic: "BSP 基础包", pro: "驱动完整包", cloud: "云端对接包", ent: "定制交付" };
  function swQuote(tier) {
    var k = SW_PRICE[tier] === undefined ? "pro" : tier;
    return { tier: k, name: SW_NAME[k], price: SW_PRICE[k] };
  }

  function serviceQuote(plan, mode) {
    plan = plan || check();
    var bom = totalPrice();
    var acc = accTotal(plan);
    var pads = estimatePads(plan);
    var sw = swQuote(ui.sw);
    var q = { mode: mode || "kit", bom: bom, acc: acc, pads: pads,
      sw: sw.price, swName: sw.name, swTier: sw.tier,
      design: 0, fab: 0, solder: 0, test: 0, extra: 0, total: 0, days: 0 };

    if (q.mode === "built") {
      q.fab = SERVICE.fabBase;
      q.solder = Math.max(SERVICE.solderMin, Math.round(pads * SERVICE.solderPer));
      q.test = SERVICE.test;
      q.days = 6;
    } else {
      q.days = 2;
    }
    q.total = bom + acc + q.fab + q.solder + q.test + q.sw;
    return q;
  }

  function encodePlan() {
    var d = { b: state.board, i: state.items };
    return btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/=+$/, "");
  }
  function decodePlan(s) {
    try {
      var d = JSON.parse(decodeURIComponent(escape(atob(s))));
      if (d && d.b && ALL[d.b]) {
        state.board = d.b;
        state.items = {};
        Object.keys(d.i || {}).forEach(function (id) {
          if (ALL[id] && ALL[id].cat !== "board" && d.i[id] > 0) state.items[id] = Math.min(9, Math.round(d.i[id]));
        });
        save();
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  window.M = {
    ALL: ALL, CATS: CATS, CATMAP: CATMAP, PRESETS: PRESETS,
    BOARDS: BOARDS, MODULES: MODULES,
    state: state, ui: ui,
    save: save, load: load, setBoard: setBoard, addItem: addItem, delItem: delItem, qty: qty, clearAll: clearAll,
    planItems: planItems, totalPrice: totalPrice, totalCount: totalCount,
    allocate: allocate, check: check,
    accessories: accessories, accTotal: accTotal, swQuote: swQuote, SW_PRICE: SW_PRICE,
    estimatePads: estimatePads, serviceQuote: serviceQuote, SERVICE: SERVICE,
    fmtMa: fmtMa, fmtMoney: fmtMoney, esc: esc, hashStr: hashStr,
    encodePlan: encodePlan, decodePlan: decodePlan,
    track: track, heatData: heatData, todayKey: todayKey
  };
})();
