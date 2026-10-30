/* 校验引擎单测（node 运行） */
global.window = {};
require("./assets/data-boards.js");
require("./assets/data-modules-1.js");
require("./assets/data-modules-2.js");
require("./assets/data-modules-3.js");
require("./assets/data-presets.js");
require("./assets/app-core.js");

var M = global.window.M;
var pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + " -> " + e.message); }
}
function assert(c, msg) { if (!c) throw new Error(msg || "assert"); }
function reset() { M.state.board = null; M.state.items = {}; }
function codes(list) { return list.map(function (c) { return c.code; }); }
function has(plan, code) { return codes(plan.errs).indexOf(code) > -1 || codes(plan.warns).indexOf(code) > -1; }

t("空配置台：提示为空", function () {
  reset();
  var p = M.check();
  assert(p.oks.length > 0, "应有 ok 项");
});

t("无基座有模块：E_NO_BOARD", function () {
  reset();
  M.state.items.bmp280 = 1;
  var p = M.check();
  assert(codes(p.errs).indexOf("E_NO_BOARD") > -1, "缺 E_NO_BOARD");
});

t("ESP32-S3 气象站：全绿", function () {
  reset();
  M.setBoard("esp32s3");
  M.state.items = { bmp280: 1, sht30: 1, oled096: 1 };
  var p = M.check();
  assert(p.errs.length === 0, "有错误: " + JSON.stringify(p.errs));
  assert(p.warns.length === 0, "有警告: " + JSON.stringify(p.warns));
  assert(Math.abs(p.rails["3v3"].used - (0.7 + 0.4 + 8)) < 0.01, "3v3 电流算错: " + p.rails["3v3"].used);
});

t("I2C 地址冲突：UNO 上双 VL53L0X 与 TCS34725（都 0x29）", function () {
  reset();
  M.setBoard("uno");
  M.state.items = { vl53l0x: 1, tcs34725: 1 };
  var p = M.check();
  assert(codes(p.errs).indexOf("E_I2C") > -1, "应报 I2C 冲突");
});

t("同一地址两块在双 I2C 板上可分开", function () {
  reset();
  M.setBoard("esp32s3");
  M.state.items = { bmp280: 2 };
  var p = M.check();
  assert(p.errs.length === 0, "双总线应能容纳: " + JSON.stringify(p.errs));
});

t("UART 占用：UNO 上 SIM800L + GSM 屏", function () {
  reset();
  M.setBoard("uno");
  M.state.items = { sim800l: 2 };
  var p = M.check();
  assert(codes(p.errs).indexOf("E_UART") > -1, "应报 UART 占用");
});

t("电源超载：NRF52 小板上大堆传感器", function () {
  reset();
  M.setBoard("nrf52840");
  M.state.items = { oled096: 1, lora: 1, nrf24: 1, w5500: 1, tfcard: 1, vl53l0x: 1 };
  var p = M.check();
  assert(codes(p.errs).indexOf("E_POWER_3V3") > -1, "应报 3.3V 超载: " + p.rails["3v3"].used + "/" + p.rails["3v3"].max);
});

t("外部供电缺失：蓝药丸 + TT 电机", function () {
  reset();
  M.setBoard("stm32f103");
  M.state.items = { tt: 1 };
  var p = M.check();
  assert(codes(p.errs).indexOf("E_POWER_EXT") > -1, "应报外部供电缺失");
});

t("外供后放行：蓝药丸 + TT 电机 + 12V 升压", function () {
  reset();
  M.setBoard("stm32f103");
  M.state.items = { tt: 1, boost12v: 1 };
  var p = M.check();
  assert(codes(p.errs).indexOf("E_POWER_EXT") === -1, "加电源后不该报缺电源");
  assert(has(p, "W_MOTOR"), "电机应给 W_MOTOR 峰值警告");
});

t("5V 模块接 3.3V 板：电平警告；加转换器后转 OK", function () {
  reset();
  M.setBoard("rp2040");
  M.state.items = { hcsr04: 1 };
  var p = M.check();
  assert(has(p, "W_LEVEL"), "应报电平警告");
  M.state.items.levelshifter = 1;
  var p2 = M.check();
  assert(!has(p2, "W_LEVEL"), "加转换器后不应再报电平警告");
  assert(codes(p2.oks).indexOf("OK_LEVEL") > -1, "应有 OK_LEVEL");
});

t("GPIO 不足：NRF52 上 4x4 矩阵键盘 + 一堆 GPIO 设备", function () {
  reset();
  M.setBoard("nrf52840");
  M.state.items = { keypad: 1, encoder: 1, buzzer: 1, relay: 1, mq2: 1 };
  var p = M.check();
  assert(codes(p.errs).indexOf("E_GPIO") > -1, "应报 GPIO 不足");
});

t("电源吃紧警告：3.3V 占用 >=85%", function () {
  reset();
  M.setBoard("nrf52840"); // 3v3 200mA
  M.state.items = { oled096: 1, w5500: 1, lora: 1, nrf24: 1, tfcard: 1 };
  var p = M.check();
  assert(has(p, "W_POWER_3V3"), "应报 3V3 吃紧");
});

t("引脚分配：SPI 片选不重复、I2C 同总线地址不重复", function () {
  reset();
  M.setBoard("esp32s3");
  M.state.items = { tft18: 1, tfcard: 1, bmp280: 1, sht30: 1 };
  var p = M.check();
  var csPins = {};
  p.alloc.rows.forEach(function (r) {
    r.signals.forEach(function (s) {
      if (s.name === "CS") assert(!csPins[s.pin], "CS 引脚重复: " + s.pin), csPins[s.pin] = 1;
    });
  });
  assert(p.alloc.rows.length === 4, "应有 4 行分配");
  assert(p.errs.length === 0, JSON.stringify(p.errs));
});

t("预设方案全部可载入且无错误", function () {
  M.PRESETS.forEach(function (pre) {
    reset();
    M.setBoard(pre.board);
    Object.keys(pre.items).forEach(function (k) { M.state.items[k] = pre.items[k]; });
    var p = M.check();
    assert(p.errs.length === 0, pre.name + " 有错误: " + JSON.stringify(p.errs));
  });
});

t("回归：校验项必须带 sev（否则渲染层类名变成 check-undefined）", function () {
  reset();
  M.setBoard("rp2040");
  M.state.items = { hcsr04: 1, tt: 1 };
  var p = M.check();
  p.errs.concat(p.warns, p.oks).forEach(function (c) {
    assert(c.sev === "error" || c.sev === "warn" || c.sev === "ok", "缺少 sev: " + c.code);
  });
  assert(p.errs.every(function (c) { return c.sev === "error"; }), "errs 的 sev 应为 error");
  assert(p.warns.every(function (c) { return c.sev === "warn"; }), "warns 的 sev 应为 warn");
});

t("回归：开发板不能被当作模块加入 items", function () {
  reset();
  M.addItem("uno");
  assert(M.state.board === "uno", "应转为设置基座");
  assert(!M.state.items.uno, "开发板混进 items 了");
  M.qty("uno", 1);
  assert(!M.state.items.uno, "qty 不应处理开发板");
});

t("回归：电源板必须带 outV（18650 是 5V 不是 12V）", function () {
  assert(M.ALL.lipo.outV === 5, "lipo.outV 应为 5，实际 " + M.ALL.lipo.outV);
  assert(M.ALL["boost12v"].outV === 12, "boost12v.outV 应为 12，实际 " + M.ALL["boost12v"].outV);
});

t("数据完整性：全部商品字段合法", function () {
  var all = M.BOARDS.concat(M.MODULES);
  assert(M.MODULES.length >= 50, "模块数不足: " + M.MODULES.length);
  all.forEach(function (m) {
    assert(m.id && m.name && m.cat && typeof m.price === "number", m.id + " 缺基础字段");
    assert(["board", "sensor", "actuator", "display", "comm", "power"].indexOf(m.cat) > -1, m.id + " 分类非法: " + m.cat);
    if (m.cat === "board") {
      assert(/^(3\.3|5)V$/.test(m.logic), m.id + " 基座 logic 非法: " + m.logic);
      assert(!isNaN(parseFloat(m.logic)), m.id + " logic 无法解析为电平");
      assert(m.pins && m.pins.length > 0, m.id + " 基座缺引脚池");
      assert(m.buses && m.buses.i2c && m.buses.spi && m.buses.uart, m.id + " 基座缺总线定义");
    } else {
      assert(Array.isArray(m.level) && m.level.length, m.id + " 缺 level");
      assert(["i2c", "spi", "uart", "gpio", "adc", "pwm", "none"].indexOf(m.bus) > -1, m.id + " bus 非法: " + m.bus);
      assert(["3v3", "5v", "ext"].indexOf(m.rail) > -1, m.id + " rail 非法: " + m.rail);
    }
    if (m.provides) {
      Object.keys(m.provides).forEach(function (k) {
        assert(["5v", "ext"].indexOf(k) > -1, m.id + " provides 轨非法: " + k);
        assert(m.provides[k] > 0, m.id + " provides 电流非法");
      });
      assert(typeof m.outV === "number", m.id + " 有 provides 但缺 outV（电压会显示错）");
    }
    if (m.addr) assert(/^0x[0-9A-Fa-f]{2}$/.test(m.addr), m.id + " I2C 地址格式错: " + m.addr);
    if (m.bus === "i2c") assert(m.addr, m.id + " I2C 模块缺 addr");
    assert((m.specs || []).length >= 3, m.id + " 规格少于 3 条");
  });
});

t("分享编码/解码往返", function () {
  reset();
  M.setBoard("picow");
  M.state.items = { dht22: 1, lora: 1 };
  var s = M.encodePlan();
  reset();
  assert(M.decodePlan(s), "解码失败");
  assert(M.state.board === "picow", "board 丢失");
  assert(M.state.items.lora === 1, "items 丢失");
});

t("价格合计", function () {
  reset();
  M.setBoard("uno"); // 65
  M.state.items = { hcsr04: 2, lcd1602: 1 }; // 9 + 11
  assert(M.totalPrice() === 85, "价格错: " + M.totalPrice());
  assert(M.totalCount() === 4, "件数错");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
