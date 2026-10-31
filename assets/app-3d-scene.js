/* ============ MODBAY 3D 场景装配：按模块型号摆放真实零件 ============ */
(function () {
  "use strict";
  var P = window.MODBAY_3D_PARTS, C = P.C;

  var PCB_SIZE = { sensor: [20, 14], actuator: [26, 18], display: [30, 22], comm: [24, 17], power: [32, 21] };

  /* 各型号专属零件（px,py,pz 为模块基准点，py 为 PCB 中心高度） */
  var RECIPES = {
    /* --- 传感器 --- */
    hcsr04: function (px, py, pz, m, d) {   /* 超声波：双探头圆筒 */
      var o = P.pcb(px, py, pz, 45, 20, C.pcbBlack, m, false);
      o.push(P.cyl(px - 11, py + 6.4, pz, 8, 12.8, C.silver, m, 16, 0.35));
      o.push(P.cyl(px + 11, py + 6.4, pz, 8, 12.8, C.silver, m, 16, 0.35));
      o.push(P.cyl(px - 11, py + 13.2, pz, 7.2, 0.8, "#6f7680", m, 16));
      o.push(P.cyl(px + 11, py + 13.2, pz, 7.2, 0.8, "#6f7680", m, 16));
      o.push(P.ic(px, py + 1.4, pz, 8, 6, 2, m));
      o.push(P.header(px, py + 1.2, pz, 4, 20, -1, m));
      return o;
    },
    dht22: function (px, py, pz, m, d) {    /* 温湿度：白色格栅壳 */
      return [box_(px, py, pz, 30, 16, 16, C.white, m),
        box_(px, py + 8.3, pz, 26, 1, 12, "#cfd6dc", m),
        box_(px, py + 1, pz, 6, 2.6, 6, C.chip, m),
        P.header(px, py + 0.8, pz, 3, 16, -1, m)];
    },
    mq2: function (px, py, pz, m, d) {      /* 气体：金属罐 + 加热丝 */
      var o = P.pcb(px, py, pz, 24, 20, C.pcbBlack, m, false);
      o.push(P.cyl(px, py + 7, pz - 2, 7.5, 12, "#9aa2ab", m, 14, 0.4));
      o.push(P.cyl(px, py + 13.3, pz - 2, 6.4, 0.8, "#6f7680", m, 14));
      o.push(P.ic(px, py + 1.3, pz + 7, 10, 5, 1.6, m));
      o.push(P.header(px, py + 1.2, pz, 4, 20, 1, m));
      return o;
    },
    pm25: function (px, py, pz, m, d) {     /* 粉尘：风扇 + 激光腔 */
      var o = P.pcb(px, py, pz, 34, 26, C.pcbBlack, m, false);
      o.push(box_(px, py + 5, pz, 30, 10, 22, C.silverDark, m));
      o.push(P.cyl(px - 7, py + 11, pz, 5.4, 2, "#5b6169", m, 14));
      for (var i = 0; i < 6; i++) o.push(box_(px - 11 + i * 1.6, py + 12.2, pz, 0.6, 0.6, 9, "#4a5058", m));
      o.push(box_(px + 8, py + 10.6, pz, 8, 1.2, 6, C.dark, m));
      o.push(P.header(px, py + 1.2, pz, 8, 26, -1, m));
      return o;
    },
    mlx90614: function (px, py, pz, m, d) { /* 红外测温：金属 TO 罐 */
      var o = P.pcb(px, py, pz, 20, 14, C.pcbBlack, m, false);
      o.push(P.cyl(px, py + 4.5, pz, 5.2, 9, "#aab2bb", m, 14, 0.5));
      o.push(P.cyl(px, py + 9.2, pz, 4.4, 0.8, "#7d848c", m, 14));
      o.push(P.ic(px, py + 1.3, pz + 5, 7, 4, 1.4, m));
      o.push(P.header(px, py + 1.2, pz, 4, 14, 1, m));
      return o;
    },
    soil: function (px, py, pz, m, d) {     /* 土壤：双探针 */
      var o = P.pcb(px, py, pz, 20, 14, C.pcbBlue, m, false);
      o.push(P.ic(px, py + 1.3, pz, 10, 6, 1.8, m));
      o.push(box_(px - 3, py + 9, pz - 8, 1.6, 16, 1.6, C.silver, m));
      o.push(box_(px + 3, py + 9, pz - 8, 1.6, 16, 1.6, C.silver, m));
      o.push(P.header(px, py + 1.2, pz, 4, 14, 1, m));
      return o;
    },
    ina219: function (px, py, pz, m, d) {   /* 电流监测：粗铜走线 + 采样电阻 */
      var o = P.pcb(px, py, pz, 22, 16, C.pcbBlack, m, false);
      o.push(P.ic(px - 3, py + 1.4, pz, 9, 6, 1.8, m));
      o.push(box_(px + 6, py + 0.9, pz, 3.4, 0.4, 8, C.copper, m));
      o.push(box_(px, py + 0.9, pz - 6, 18, 0.3, 3, C.copper, m));
      o.push(P.terminal(px, py - 1, pz + 6, 2, m, C.termBlue));
      return o;
    },
    /* --- 执行与电机 --- */
    sg90: function (px, py, pz, m) { return P.servo(px, py - 10, pz, m); },
    mg996r: function (px, py, pz, m) { return P.servo(px, py - 10, pz, m); },
    stepper28: function (px, py, pz, m) {   /* 步进：圆柱机身 + 出线 */
      var o = P.motor(px, py - 4, pz, 14, 19, m, false);
      o.push(P.cyl(px, py + 13.6, pz, 3, 4, C.silver, m, 12, 0.5));
      o.push(box_(px, py - 12.4, pz, 20, 1.6, 14, C.pcbBlue, m));
      o.push(P.header(px, py - 10, pz - 7, 5, 14, -1, m));
      return o;
    },
    tt: function (px, py, pz, m) { return P.motor(px, py + 0.8, pz, 7, 14, m, true); },
    l298n: function (px, py, pz, m, d) {    /* 双 H 桥：大散热片 + 端子 */
      var o = P.pcb(px, py, pz, 34, 26, C.pcbRed, m);
      o.push(P.heatsink(px, py + 0.8, pz - 6, 24, m));
      o.push(P.ic(px - 9, py + 1.4, pz + 8, 14, 8, 2.4, m));
      o.push(P.terminal(px + 10, py + 0.8, pz + 8, 2, m));
      o.push(P.terminal(px + 10, py + 0.8, pz - 2, 3, m, C.termBlue));
      o.push(P.cap(px - 14, py + 0.8, pz + 8, 3.2, 6, m));
      return o;
    },
    tb6612: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 26, 18, C.pcbBlack, m);
      o.push(P.ic(px - 4, py + 1.4, pz, 10, 8, 1.8, m));
      o.push(P.terminal(px + 8, py + 0.8, pz + 5, 2, m));
      o.push(P.cap(px + 8, py + 0.8, pz - 5, 3, 5, m));
      o.push(P.header(px - 10, py + 1.2, pz, 8, 18, 1, m));
      return o;
    },
    drv8833: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 24, 16, C.pcbBlack, m);
      o.push(P.ic(px, py + 1.4, pz, 10, 8, 1.6, m));
      o.push(P.header(px - 9, py + 1.2, pz, 6, 16, 1, m));
      o.push(P.header(px + 9, py + 1.2, pz, 6, 16, -1, m));
      return o;
    },
    tmc2209: function (px, py, pz, m, d) {  /* 静音驱动：模块小板 + 大芯片 */
      var o = P.pcb(px, py, pz, 20, 15, C.pcbBlack, m, false);
      o.push(P.ic(px, py + 1.5, pz, 9, 9, 2, m));
      o.push(P.heatsink(px, py + 0.8, pz - 6, 12, m));
      o.push(P.header(px - 7, py + 1.2, pz, 8, 15, 1, m));
      o.push(P.header(px + 7, py + 1.2, pz, 8, 15, -1, m));
      return o;
    },
    relay: function (px, py, pz, m, d) { return relayBox(px, py, pz, m, 1); },
    relay4: function (px, py, pz, m, d) { return relayBox(px, py, pz, m, 4); },
    ws2812: function (px, py, pz, m, d) { return ring(px, py, pz, m, 8, true); },
    ws2812_strip: function (px, py, pz, m, d) { return ring(px, py, pz, m, 14, true); },
    /* --- 显示 --- */
    oled096: function (px, py, pz, m, d) { return P.screen(px, py, pz, 24, 14, m); },
    oled13: function (px, py, pz, m, d) { return P.screen(px, py, pz, 28, 16, m); },
    tft18: function (px, py, pz, m, d) { return P.screen(px, py, pz, 30, 22, m); },
    ili9341: function (px, py, pz, m, d) { return P.screen(px, py, pz, 40, 30, m); },
    lcd1602: function (px, py, pz, m, d) {  /* 字符屏：绿底玻璃 + 排针 */
      var o = P.pcb(px, py, pz, 46, 24, C.pcbBlack, m, false);
      o.push(box_(px, py + 1.4, pz, 42, 2.2, 18, "#1e3a2a", m, 0.3));
      o.push(box_(px, py + 2.6, pz, 41, 0.2, 17, "#3f7f5a", m, 0.6));
      o.push(P.ic(px + 16, py + 1.3, pz, 8, 6, 1.6, m));
      o.push(P.header(px, py + 1.2, pz, 16, 24, -1, m));
      return o;
    },
    keypad: function (px, py, pz, m, d) {   /* 薄膜键盘：16 个键帽 */
      var o = [box_(px, py, pz, 42, 2, 34, "#2b3038", m)];
      for (var r = 0; r < 4; r++) for (var c2 = 0; c2 < 4; c2++) {
        o.push(P.cyl(px - 15 + c2 * 10, py + 1.7, pz - 12 + r * 8, 2.6, 1.4, "#3f454d", m, 10));
      }
      return o;
    },
    encoder: function (px, py, pz, m, d) {  /* 旋转编码器：轴 + 旋钮 */
      var o = P.pcb(px, py, pz, 18, 16, C.pcbBlack, m, false);
      o.push(P.cyl(px, py + 3, pz, 3.6, 4.4, C.silverDark, m, 12, 0.3));
      o.push(P.cyl(px, py + 6.4, pz, 5.6, 3.4, "#2f343b", m, 14, 0.25));
      o.push(P.button(px + 5, py + 1, pz + 5, m));
      return o;
    },
    /* --- 通信 --- */
    lora: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 26, 18, C.pcbBlack, m);
      o.push(P.ic(px - 3, py + 1.4, pz, 10, 8, 1.8, m));
      o.push(P.coilAntenna(px + 9, py + 0.8, pz - 4, m));
      o.push(P.header(px, py + 1.2, pz, 8, 18, -1, m));
      return o;
    },
    nrf24: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 22, 15, C.pcbBlack, m, false);
      o.push(P.ic(px, py + 1.4, pz, 9, 6, 1.6, m));
      o.push(box_(px + 8, py + 1.2, pz, 4, 0.4, 9, C.copper, m));
      o.push(P.header(px - 8, py + 1.2, pz, 4, 15, 1, m));
      o.push(P.header(px + 8, py + 1.2, pz, 4, 15, -1, m));
      return o;
    },
    /* --- 传感器（小封装细节） --- */
    bmp280: function (px, py, pz, m, d) {   /* 气压：金属封装 + 开孔盖 */
      var o = P.pcb(px, py, pz, 18, 14, C.pcbBlue, m, false);
      o.push(box_(px - 2, py + 1.7, pz, 6.4, 1.4, 6.4, C.silver, m, 0.45));
      o.push(box_(px - 2, py + 2.5, pz, 4.6, 0.35, 4.6, "#6f7680", m));
      o.push(P.ic(px + 5, py + 1.4, pz + 3, 5, 4, 1.2, m));
      o.push(P.header(px, py + 1.2, pz, 4, 14, -1, m));
      return o;
    },
    sht30: function (px, py, pz, m, d) {    /* 温湿度：DFN 白封装 + 金属焊盘 */
      var o = P.pcb(px, py, pz, 16, 12, C.pcbBlue, m, false);
      o.push(box_(px - 1, py + 1.4, pz, 5.6, 1.4, 5.6, C.white, m, 0.35));
      o.push(box_(px - 1, py + 2.2, pz, 3, 0.3, 3, "#9aa2ab", m));
      o.push(P.ic(px + 4.6, py + 1.4, pz - 2, 4.4, 3.6, 1, m));
      o.push(P.header(px, py + 1.2, pz, 4, 12, 1, m));
      return o;
    },
    sht40: function (px, py, pz, m, d) {    /* 温湿度：更小的 DFN 4-pin */
      var o = P.pcb(px, py, pz, 14, 11, C.pcbBlack, m, false);
      o.push(box_(px, py + 1.3, pz, 4.6, 1.2, 4.6, "#dfe4e9", m, 0.4));
      o.push(box_(px, py + 2, pz, 2.4, 0.25, 2.4, "#8b939c", m));
      o.push(P.header(px, py + 1.2, pz, 4, 11, 1, m));
      return o;
    },
    mpu6050: function (px, py, pz, m, d) {  /* 六轴：蓝板 + QFN + 退耦电容 */
      var o = P.pcb(px, py, pz, 20, 16, C.pcbBlue, m, false);
      o.push(box_(px - 2, py + 1.7, pz, 7, 1.4, 7, C.chip, m, 0.2));
      o.push(box_(px - 2, py + 2.5, pz, 5.4, 0.3, 5.4, "#3a4048", m));
      o = o.concat(P.cap(px + 6, py + 0.9, pz + 4, 1.6, 2.4, m));
      o.push(P.header(px, py + 1.2, pz, 4, 16, -1, m));
      return o;
    },
    vl53l0x: function (px, py, pz, m, d) {  /* 激光测距：红外窗 + 发射/接收双孔 */
      var o = P.pcb(px, py, pz, 18, 12, C.pcbBlack, m, false);
      o.push(box_(px - 1, py + 1.5, pz, 7, 1.2, 5.4, C.dark, m, 0.2));
      o.push(P.cyl(px - 3, py + 2.2, pz, 1.5, 0.5, "#5b1f2a", m, 12, 0.7));
      o.push(P.cyl(px + 1, py + 2.2, pz, 1.5, 0.5, "#3a2230", m, 12, 0.7));
      o.push(P.header(px, py + 1.2, pz, 4, 12, 1, m));
      return o;
    },
    tcs34725: function (px, py, pz, m, d) { /* 颜色：透明窗 + 白光 LED */
      var o = P.pcb(px, py, pz, 20, 14, C.pcbBlack, m, false);
      o.push(box_(px - 2, py + 1.5, pz, 6, 1.2, 6, C.chip, m, 0.15));
      o.push(box_(px - 2, py + 2.3, pz, 4.4, 0.3, 4.4, "#cfe6f5", m, 0.8));
      o.push(P.cyl(px + 5.4, py + 1.6, pz, 1.8, 0.8, C.white, m, 12, 0.6));
      o.push(P.header(px, py + 1.2, pz, 4, 14, -1, m));
      return o;
    },
    max30102: function (px, py, pz, m, d) { /* 心率血氧：红光/红外窗口 */
      var o = P.pcb(px, py, pz, 16, 12, C.pcbBlue, m, false);
      o.push(box_(px - 1, py + 1.4, pz, 5.4, 1.2, 4.4, C.chip, m, 0.2));
      o.push(P.cyl(px - 2.2, py + 2.2, pz, 1.5, 0.4, "#d43b3b", m, 12, 0.85));
      o.push(P.cyl(px + 1.2, py + 2.2, pz, 1.5, 0.4, "#3a1f2a", m, 12, 0.6));
      o.push(P.header(px, py + 1.2, pz, 4, 12, 1, m));
      return o;
    },
    bh1750: function (px, py, pz, m, d) {   /* 光照：白色感光窗 */
      var o = P.pcb(px, py, pz, 16, 12, C.pcbBlack, m, false);
      o.push(box_(px, py + 1.4, pz, 5.6, 1.2, 5.6, C.chip, m, 0.2));
      o.push(box_(px, py + 2.2, pz, 4, 0.25, 4, "#eef3f7", m, 0.7));
      o.push(P.header(px, py + 1.2, pz, 4, 12, -1, m));
      return o;
    },
    rtc: function (px, py, pz, m, d) {      /* 时钟：纽扣电池 + 晶振 */
      var o = P.pcb(px, py, pz, 24, 20, C.pcbBlue, m, false);
      o.push(P.cyl(px - 4, py + 2.4, pz, 6, 2, C.silver, m, 16, 0.55, "y"));
      o.push(P.cyl(px - 4, py + 3.6, pz, 4.6, 0.4, "#c9d2da", m, 16, 0.7, "y"));
      o.push(box_(px + 7, py + 1.6, pz + 4, 6, 1.4, 3, C.chip, m));
      o.push(P.ic(px + 7, py + 1.4, pz - 4, 5, 4, 1.2, m));
      o.push(P.header(px, py + 1.2, pz, 6, 20, -1, m));
      return o;
    },
    buzzer: function (px, py, pz, m, d) {   /* 蜂鸣器：圆柱壳 + 顶部出声孔 */
      var o = P.pcb(px, py, pz, 16, 14, C.pcbBlack, m, false);
      o.push(P.cyl(px, py + 4, pz, 6, 7, C.dark, m, 16, 0.2));
      o.push(P.cyl(px, py + 7.6, pz, 5.4, 0.6, "#2c323a", m, 16, 0.35));
      o.push(P.cyl(px, py + 8, pz, 1.6, 0.5, "#0a0c10", m, 12));
      o.push(P.header(px, py + 1.2, pz, 3, 14, 1, m));
      return o;
    },
    gps: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 30, 24, C.pcbBlack, m, false);
      o.push(P.patchAntenna(px, py + 0.8, pz - 5, m));
      o.push(P.ic(px - 8, py + 1.4, pz + 8, 10, 7, 1.8, m));
      o.push(P.header(px, py + 1.2, pz, 5, 24, 1, m));
      return o;
    },
    sim800l: function (px, py, pz, m, d) {  /* GSM：金属屏蔽罩 + 端子 */
      var o = P.pcb(px, py, pz, 26, 22, C.pcbRed, m, false);
      o.push(box_(px, py + 3.4, pz, 18, 5, 16, C.silver, m, 0.4));
      o.push(P.ic(px - 9, py + 1.4, pz + 8, 7, 5, 1.4, m));
      o.push(P.terminal(px + 10, py + 0.8, pz + 8, 2, m, C.termBlue));
      return o;
    },
    w5500: function (px, py, pz, m, d) {    /* 以太网：网口 + 变压器 */
      var o = P.pcb(px, py, pz, 34, 24, C.pcbBlack, m, false);
      o.push(box_(px - 8, py + 7, pz, 18, 14, 16, C.silver, m, 0.3));
      o.push(box_(px - 8, py + 14.2, pz, 16, 1.2, 14, "#6f7680", m));
      o.push(P.ic(px + 10, py + 1.4, pz + 4, 10, 7, 1.8, m));
      o.push(P.header(px + 10, py + 1.2, pz - 8, 8, 8, -1, m));
      return o;
    },
    esp01s: function (px, py, pz, m, d) {   /* 透传模块：板载 PCB 天线 */
      var o = P.pcb(px, py, pz, 14, 25, C.pcbBlue, m, false);
      o.push(P.ic(px, py + 1.3, pz - 6, 8, 8, 1.4, m));
      for (var i = 0; i < 6; i++) o.push(box_(px, py + 1.3, pz + 4 + i * 2, 8 - (i % 2) * 3, 0.4, 1, C.gold, m));
      o.push(P.header(px, py + 1.2, pz, 4, 25, -1, m));
      return o;
    },
    rc522: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 30, 22, C.pcbBlue, m, false);
      o.push(P.coilAntenna(px, py + 0.8, pz, m));
      o.push(P.ic(px + 10, py + 1.4, pz + 6, 8, 6, 1.6, m));
      o.push(P.header(px + 10, py + 1.2, pz - 8, 8, 8, -1, m));
      return o;
    },
    tfcard: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 24, 18, C.pcbBlack, m, false);
      o.push(box_(px, py + 1.6, pz, 18, 2.6, 14, C.silver, m, 0.25));
      o.push(box_(px + 3, py + 2.4, pz, 12, 1.6, 12, "#2f343b", m));
      o.push(P.header(px, py + 1.2, pz, 6, 18, -1, m));
      return o;
    },
    rs485: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 20, 14, C.pcbBlack, m, false);
      o.push(P.ic(px, py + 1.4, pz, 8, 6, 1.4, m));
      o.push(P.terminal(px + 8, py + 0.8, pz, 2, m, C.termBlue));
      o.push(P.header(px - 7, py + 1.2, pz, 4, 14, 1, m));
      return o;
    },
    /* --- 电源 --- */
    boost12v: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 34, 24, C.pcbGreen, m);
      o.push(P.inductor(px - 8, py + 0.8, pz + 5, m));
      o.push(P.cap(px + 6, py + 0.8, pz + 6, 3.4, 7, m));
      o.push(P.cap(px + 12, py + 0.8, pz - 4, 3, 5.4, m));
      o.push(P.ic(px - 8, py + 1.4, pz - 6, 9, 6, 1.6, m));
      o.push(P.terminal(px + 10, py + 0.8, pz + 10, 2, m, C.termBlue));
      return o;
    },
    buck5v: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 28, 18, C.pcbBlue, m, false);
      o.push(P.inductor(px, py + 0.8, pz, m));
      o.push(P.cap(px + 9, py + 0.8, pz + 4, 3, 5.4, m));
      o.push(P.ic(px - 9, py + 1.4, pz + 5, 8, 6, 1.4, m));
      o.push(P.terminal(px + 9, py + 0.8, pz - 5, 2, m, C.termBlue));
      return o;
    },
    lipo: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 26, 20, C.pcbGreen, m, false);
      o.push(P.inductor(px - 6, py + 0.8, pz + 4, m));
      o.push(P.cap(px + 7, py + 0.8, pz + 5, 3, 5, m));
      o.push(P.usbC(px, py + 0.8, pz - 11, -1, m));
      o.push(P.button(px + 9, py + 1, pz - 4, m));
      return o;
    },
    battery18650: function (px, py, pz, m) { return P.battery(px, py - 20, pz, m); },
    solar6v: function (px, py, pz, m) { return P.solarPanel(px, py - 1.2, pz, m); },
    levelshifter: function (px, py, pz, m, d) {
      var o = P.pcb(px, py, pz, 20, 14, C.pcbBlack, m, false);
      o.push(P.ic(px, py + 1.4, pz, 7, 5, 1.2, m));
      o.push(P.header(px - 6, py + 1.2, pz, 6, 14, 1, m));
      o.push(P.header(px + 6, py + 1.2, pz, 6, 14, -1, m));
      return o;
    }
  };

  /* 小工具：局部 box 包装（避免与零件库同名冲突） */
  function box_(x, y, z, w, h, d, c, mod, gloss) { return P.box(x, y, z, w, h, d, c, mod, gloss); }

  /* 继电器：蓝色方块 + 端子 + 排针 */
  function relayBox(px, py, pz, m, n) {
    var o = P.pcb(px, py, pz, 18 + n * 8, 20, C.pcbBlue, m);
    for (var i = 0; i < n; i++) {
      var x = px - (n - 1) * 5 + i * 10;
      o.push(box_(x, py + 5.4, pz + 2, 9, 9, 12, "#1e4f8a", m, 0.2));
      o.push(box_(x, py + 10.2, pz + 2, 8, 0.6, 11, "#173e6d", m));
      o.push(P.terminal(x, py + 0.8, pz - 8, 2, m, C.termGreen));
    }
    o.push(P.header(px, py + 1.2, pz + 8, n + 2, 20, 1, m));
    return o;
  }
  /* RGB 灯环 / 灯带 */
  function ring(px, py, pz, m, n, strip) {
    var o = [];
    if (strip) {
      o.push(box_(px, py, pz, 46, 1.2, 8, "#101318", m));
      for (var i = 0; i < n; i++) {
        var x = px - 21 + i * (42 / (n - 1));
        o.push(box_(x, py + 1.4, pz, 2.6, 1.4, 5, i % 3 === 0 ? "#ff6b5e" : i % 3 === 1 ? "#6ee7a0" : "#5aa9ff", m, 0.5));
      }
      return o;
    }
    for (var k = 0; k < n; k++) {
      var a = k / n * Math.PI * 2, r = 12;
      o.push(box_(px + Math.cos(a) * r, py + 0.8, pz + Math.sin(a) * r, 4, 1.4, 4, k % 3 === 0 ? "#ff6b5e" : k % 3 === 1 ? "#6ee7a0" : "#5aa9ff", m, 0.5));
    }
    o.push(P.cyl(px, py + 0.4, pz, 10, 0.8, "#16191f", m, 16));
    return o;
  }

  /* 类别默认零件（无专属配方时） */
  function defaultParts(mod, px, py, pz, detail) {
    var cat = mod.cat, size = PCB_SIZE[cat] || PCB_SIZE.sensor;
    var w = size[0], d = size[1];
    var pcbC = cat === "display" ? C.pcbBlue : (cat === "power" ? C.pcbGreen : C.pcbBlack);
    var o = P.pcb(px, py, pz, w, d, pcbC, mod.id);
    if (cat === "display") {
      o = o.concat(P.screen(px, py + 0.9, pz, w - 4, d - 4, mod.id));
    } else if (cat === "comm") {
      o = o.concat(P.ic(px - 2, py + 1.4, pz, 10, 7, 1.8, mod.id));
      o = o.concat(P.coilAntenna(px + w / 2 - 4, py + 0.8, pz - d / 4, mod.id));
      o = o.concat(P.header(px, py + 1.2, pz, 6, d, -1, mod.id));
    } else if (cat === "power") {
      o = o.concat(P.inductor(px - 6, py + 0.8, pz + 4, mod.id));
      o = o.concat(P.cap(px + 7, py + 0.8, pz + 5, 3.2, 6, mod.id));
      o = o.concat(P.terminal(px + 8, py + 0.8, pz - 6, 2, mod.id, C.termBlue));
    } else if (cat === "actuator") {
      o = o.concat(P.ic(px - 3, py + 1.4, pz, 11, 8, 1.8, mod.id));
      o = o.concat(P.terminal(px + 9, py + 0.8, pz + 4, 2, mod.id));
      o = o.concat(P.cap(px + 9, py + 0.8, pz - 5, 3, 5, mod.id));
      o = o.concat(P.header(px - 10, py + 1.2, pz, 8, d, 1, mod.id));
    } else {
      o = o.concat(P.ic(px, py + 1.4, pz, 9, 6, 1.6, mod.id));
      o = o.concat(P.header(px, py + 1.2, pz, 4, d, 1, mod.id));
    }
    if (detail) {
      o = o.concat(P.smd(px - w / 2 + 3, py + 0.8, pz + d / 2 - 3, mod.id));
      o = o.concat(P.smd(px + w / 2 - 4, py + 0.8, pz + d / 2 - 3, mod.id));
      o = o.concat(P.led(px + w / 2 - 3, py + 0.8, pz - d / 2 + 3, mod.id));
    }
    return o;
  }

  /* 零件库的若干函数（cap/smd/button/led/usbC/battery/…）返回的是零件数组，
     配方里若用 push 塞进去就会形成嵌套数组，导致包围盒量测出 NaN。
     这里统一深度扁平化，配方怎么写都不会漏。 */
  function flatten(list, out) {
    out = out || [];
    (list || []).forEach(function (p) {
      if (Array.isArray(p)) flatten(p, out);
      else if (p && typeof p === "object") out.push(p);
    });
    return out;
  }

  function moduleParts(mod, px, py, pz, detail) {
    var f = RECIPES[mod.id];
    var raw = f ? f(px, py, pz, mod.id, detail) : defaultParts(mod, px, py, pz, detail);
    return flatten(raw);
  }

  window.MODBAY_3D_SCENE = { moduleParts: moduleParts, PCB_SIZE: PCB_SIZE, C: C };
})();
