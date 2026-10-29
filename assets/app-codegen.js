/* ============ MODBAY 软件方案生成器 ============
 * 把「选型结果」翻译成一套可落地的软件工程：
 *   BSP（板级支持包）· 驱动层 · 联动逻辑 · 协议栈 · 外部通信
 * 输出两套目标：MicroPython（可直接跑）与 C（ESP-IDF / Arduino 骨架）。
 * 所有内容都由 plan.alloc 的真实引脚分配推导，不是模板占位。
 */
(function () {
  "use strict";

  var M = window.M;
  var esc = M.esc;

  /* ---------- 引脚名 → 目标平台写法 ---------- */
  function pyPin(name) {
    var n = name || "";
    var m;
    if ((m = /^GPIO?(\d+)$/.exec(n))) return "Pin(" + m[1] + ")";
    if ((m = /^GP(\d+)$/.exec(n))) return "Pin(" + m[1] + ")";
    if ((m = /^D(\d+)$/.exec(n))) return "Pin(" + m[1] + ")";
    if ((m = /^P([A-E])(\d+)$/.exec(n))) return 'Pin("' + m[1] + m[2] + '")';
    if ((m = /^A(\d+)$/.exec(n))) return "Pin(" + m[1] + ")";
    return 'Pin("' + n + '")';
  }
  function cNum(name) {
    var n = name || "";
    var m;
    if ((m = /^GPIO?(\d+)$/.exec(n))) return String(m[1]);
    if ((m = /^GP(\d+)$/.exec(n))) return String(m[1]);
    if ((m = /^D(\d+)$/.exec(n))) return String(m[1]);
    return null;
  }
  function cPin(name) {
    var num = cNum(name);
    return num !== null ? "(" + num + ")" : "(MB_SYM_" + String(name).replace(/[^A-Za-z0-9]/g, "_") + ")";
  }
  /* 宏名只做大写净化，前缀由调用方决定（Python: M_ / C: MB_） */
  function macro(name) {
    return String(name).replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
  }
  function pyConst(modId, sigName) {
    return "M_" + macro(modId) + (sigName ? "_" + macro(sigName) : "");
  }
  function cConst(modId, sigName) {
    return "MB_" + macro(modId) + (sigName ? "_" + macro(sigName) : "");
  }

  /* ---------- 驱动配方 ----------
   * cls 决定生成哪套骨架；api 是生成出来的函数名；ret 是读回的数据语义。 */
  var RECIPE = {
    /* 传感器 —— I2C 寄存器型 */
    bmp280:    { cls: "i2c_reg", api: "bmp280", ret: "pressure_pa, temperature_c", reg: "0xD0", who: "0x58", note: "读 0x88..0xA1 校准表后按 Bosch 公式补偿" },
    sht30:     { cls: "i2c_reg", api: "sht30", ret: "temperature_c, humidity_pct", note: "发 0x2C06 单次测量，6 字节返回，含 CRC8" },
    sht40:     { cls: "i2c_reg", api: "sht40", ret: "temperature_c, humidity_pct", note: "发 0xFD 高精度测量，等 10ms 读 6 字节" },
    mpu6050:   { cls: "i2c_reg", api: "mpu6050", ret: "ax, ay, az, gx, gy, gz", reg: "0x75", who: "0x68", note: "先解除睡眠（PWR_MGMT_1=0），再读 0x3B 起 14 字节" },
    vl53l0x:   { cls: "i2c_reg", api: "vl53l0x", ret: "distance_mm", note: "需加载 ST 初始化序列；简化版按单次测距流程" },
    tcs34725:  { cls: "i2c_reg", api: "tcs34725", ret: "r, g, b, c", note: "先写 ATIME 积分时间，再读 0x14 起 8 字节" },
    max30102:  { cls: "i2c_reg", api: "max30102", ret: "ir_raw, red_raw", note: "FIFO 模式读取，心率算法需另配" },
    rtc:       { cls: "i2c_reg", api: "ds3231", ret: "year, month, day, hour, minute, second", note: "BCD 编码，0x00 起 7 字节" },
    bh1750:    { cls: "i2c_reg", api: "bh1750", ret: "lux", note: "发 0x10 连续高分辨率模式，读 2 字节" },
    ina219:    { cls: "i2c_reg", api: "ina219", ret: "bus_voltage_v, current_ma", note: "校准寄存器 0x05 必须先写，否则电流为 0" },
    mlx90614:  { cls: "i2c_reg", api: "mlx90614", ret: "object_c, ambient_c", note: "0x07 物体温度，0x06 环境温度，单位 0.02K" },
    /* 传感器 —— GPIO / ADC */
    dht22:     { cls: "onewire", api: "dht22", ret: "temperature_c, humidity_pct", note: "单总线 40bit，微秒级时序，读间隔 ≥2s" },
    hcsr04:    { cls: "pulse", api: "hcsr04", ret: "distance_cm", note: "Trig 拉高 10µs，Echo 高电平宽度 ÷58 = cm" },
    mq2:       { cls: "adc", api: "mq2", ret: "raw, voltage_mv", note: "加热丝需预热 24h 才稳定；R0 需在洁净空气中标定" },
    soil:      { cls: "adc", api: "soil", ret: "raw, moisture_pct", note: "干湿标定两点后线性映射，长期通电会电解腐蚀探头" },
    pm25:      { cls: "uart_rx", api: "pm25", ret: "pm1, pm25, pm10", note: "9600 8N1，帧头 0x42 0x4D，帧长 32 字节" },
    /* 执行器 */
    sg90:      { cls: "servo", api: "sg90", ret: "angle", note: "50Hz，0.5~2.5ms 对应 0~180°" },
    mg996r:    { cls: "servo", api: "mg996r", ret: "angle", note: "堵转电流可达 2.5A，务必独立供电" },
    ws2812:    { cls: "ws2812", api: "ws2812", ret: "pixel", note: "800kHz 单线归零码，时序敏感，禁中断" },
    relay:     { cls: "gpio_out", api: "relay", ret: "on/off", note: "多数模块低电平触发，上电默认拉高避免误吸合" },
    relay4:    { cls: "gpio_out", api: "relay4", ret: "ch1..ch4", note: "四路独立，注意总电流不要超过模块端子额定" },
    buzzer:    { cls: "gpio_out", api: "buzzer", ret: "on/off", note: "有源蜂鸣器给电平即响；无源需 PWM 方波" },
    tt:        { cls: "motor_dc", api: "tt", ret: "speed -100..100", note: "两脚直接驱动需 H 桥；单脚只能单向" },
    l298n:     { cls: "motor_dc", api: "l298n", ret: "speed -100..100 ×2", note: "ENA/IN1/IN2 控制 A 路，IN3/IN4/ENB 控制 B 路" },
    tb6612:    { cls: "motor_dc", api: "tb6612", ret: "speed -100..100 ×2", note: "STBY 必须拉高，否则芯片休眠无输出" },
    drv8833:   { cls: "motor_dc", api: "drv8833", ret: "speed -100..100 ×2", note: "两路各 2 脚，PWM 互补输出" },
    stepper28: { cls: "stepper", api: "stepper28", ret: "steps", note: "四相八拍，ULN2003 驱动，步进角 5.625°/64" },
    tmc2209:   { cls: "stepper", api: "tmc2209", ret: "steps", note: "STEP/DIR 脉冲，需先配置细分与电流" },
    /* 显示与交互 */
    oled096:   { cls: "oled", api: "oled096", ret: "text", w: 128, h: 64, note: "SSD1306，页寻址 8 页" },
    oled13:    { cls: "oled", api: "oled13", ret: "text", w: 128, h: 64, note: "SH1106 与 SSD1306 寄存器略有差异" },
    lcd1602:   { cls: "lcd", api: "lcd1602", ret: "text", w: 16, h: 2, note: "PCF8574 背板，4bit 模式" },
    tft18:     { cls: "spi_display", api: "tft18", ret: "pixel", w: 128, h: 160, note: "ST7735，需 DC/RST/CS 三线" },
    ili9341:   { cls: "spi_display", api: "ili9341", ret: "pixel", w: 240, h: 320, note: "ILI9341，SPI 40MHz 下刷新约 15fps" },
    encoder:   { cls: "encoder", api: "encoder", ret: "delta, pressed", note: "A/B 相正交解码，机械触点需 1~5ms 消抖" },
    keypad:    { cls: "keypad", api: "keypad", ret: "key", note: "4×4 矩阵扫描，行输出列输入，需上拉" },
    /* 通信与存储 */
    nrf24:     { cls: "spi_radio", api: "nrf24", ret: "payload", note: "2.4G 私有协议，需配置通道/地址/速率" },
    lora:      { cls: "spi_radio", api: "sx1278", ret: "payload", note: "433MHz，需按地区设频点与占空比" },
    rc522:     { cls: "spi_radio", api: "rc522", ret: "uid", note: "13.56MHz，读卡流程 REQA→防冲突→选卡" },
    w5500:     { cls: "spi_net", api: "w5500", ret: "socket", note: "硬件 TCP/IP，8 个 socket，需配置 MAC/IP" },
    tfcard:    { cls: "spi_storage", api: "sdcard", ret: "block", note: "SPI 模式，初始化需 74 个时钟以上" },
    gps:       { cls: "uart_rx", api: "gps", ret: "lat, lon, sats", note: "9600 8N1，解析 NMEA $GPRMC/$GPGGA" },
    sim800l:   { cls: "uart_at", api: "sim800l", ret: "ok", note: "AT 指令，波特率自适应 9600~115200" },
    esp01s:    { cls: "uart_at", api: "esp01s", ret: "ok", note: "AT 固件，115200 8N1" },
    rs485:     { cls: "uart_half", api: "rs485", ret: "frame", note: "半双工，DE/RE 需在发送前后翻转" },
    /* 电源件不生成驱动 */
    lipo:      { cls: "none" }, battery18650: { cls: "none" }, solar6v: { cls: "none" },
    buck5v:    { cls: "none" }, boost12v: { cls: "none" }, levelshifter: { cls: "none" }
  };

  function recipeOf(mod) {
    var r = RECIPE[mod.id];
    if (r) return r;
    /* 未登记的模块按总线兜底，保证任何选型都有驱动骨架 */
    var byBus = {
      i2c: { cls: "i2c_reg", api: mod.id, ret: "raw", note: "通用寄存器读写，具体寄存器表见器件手册" },
      spi: { cls: "spi_dev", api: mod.id, ret: "raw", note: "通用 SPI 传输" },
      uart: { cls: "uart_rx", api: mod.id, ret: "frame", note: "串口透传" },
      adc: { cls: "adc", api: mod.id, ret: "raw", note: "ADC 采样" },
      pwm: { cls: "servo", api: mod.id, ret: "duty", note: "PWM 输出" },
      gpio: { cls: "gpio_out", api: mod.id, ret: "on/off", note: "GPIO 电平" },
      none: { cls: "none" }
    };
    return byBus[mod.bus] || byBus.gpio;
  }

  /* ---------- 总线规划：把 alloc.rows 归并成 BSP 常量 ---------- */
  function buses(plan) {
    var out = { i2c: [], spi: [], uart: [], gpio: [] };
    (plan.alloc ? plan.alloc.rows : []).forEach(function (r) {
      var sig = {};
      r.signals.forEach(function (s) { sig[s.name] = s.pin; });
      if (r.mod.bus === "i2c") {
        var key = sig.SDA + "|" + sig.SCL;
        var hit = out.i2c.filter(function (b) { return b.sda === sig.SDA; })[0];
        if (!hit) out.i2c.push({ sda: sig.SDA, scl: sig.SCL, devs: [] });
        (hit || out.i2c[out.i2c.length - 1]).devs.push(r.mod);
      } else if (r.mod.bus === "spi") {
        var h2 = out.spi.filter(function (b) { return b.sck === sig.SCK; })[0];
        if (!h2) { h2 = { sck: sig.SCK, mosi: sig.MOSI, miso: sig.MISO, devs: [] }; out.spi.push(h2); }
        h2.devs.push(r.mod);
        if (sig.CS) r.cs = sig.CS;
      } else if (r.mod.bus === "uart") {
        out.uart.push({ tx: sig.TX, rx: sig.RX, dev: r.mod });
      } else {
        out.gpio.push({ mod: r.mod, pins: r.signals });
      }
    });
    return out;
  }

  function planSlug(plan) {
    if (!plan.board) return "empty";
    return plan.board.id + "-" + (plan.items || []).map(function (it) { return it.mod.id; }).join("-").slice(0, 40);
  }

  /* =====================================================================
   * 代码生成：MicroPython
   * ===================================================================== */
  function pyBoard(plan, b) {
    var L = [];
    L.push("# bsp_board.py — 板级支持包（由 MODBAY 依据选型自动生成）");
    L.push("# 基座：" + plan.board.name + " / 逻辑电平 " + plan.board.logic);
    L.push("from machine import Pin");
    L.push("");
    L.push('BOARD_NAME = "' + plan.board.name + '"');
    L.push('BOARD_ID   = "' + plan.board.id + '"');
    L.push("LOGIC_MV   = " + (parseFloat(plan.board.logic) * 1000 || 3300));
    L.push("");
    L.push("# ---- 电源轨容量（mA，来自板载稳压实测经验值） ----");
    L.push("RAIL_3V3_MAX = " + (plan.board.supply3v3 || 0));
    L.push("RAIL_5V_MAX  = " + (plan.board.supply5v || 0));
    L.push("RAIL_EXT_MAX = " + (plan.board.supplyExt || 0));
    L.push("");
    b.i2c.forEach(function (x, i) {
      L.push("# I2C" + i + " — " + x.devs.map(function (m) { return m.name; }).join(" / "));
      L.push("I2C" + i + "_SDA = " + pyPin(x.sda));
      L.push("I2C" + i + "_SCL = " + pyPin(x.scl));
      L.push("I2C" + i + "_FREQ = 400000");
      L.push("");
    });
    b.spi.forEach(function (x, i) {
      L.push("# SPI" + i + " — " + x.devs.map(function (m) { return m.name; }).join(" / "));
      L.push("SPI" + i + "_SCK  = " + pyPin(x.sck));
      L.push("SPI" + i + "_MOSI = " + pyPin(x.mosi));
      L.push("SPI" + i + "_MISO = " + pyPin(x.miso));
      L.push("SPI" + i + "_BAUD = 10000000");
      L.push("");
    });
    b.uart.forEach(function (x, i) {
      L.push("# UART" + i + " — " + x.dev.name);
      L.push("UART" + i + "_TX   = " + pyPin(x.tx));
      L.push("UART" + i + "_RX   = " + pyPin(x.rx));
      L.push("UART" + i + "_BAUD = " + (/sim800l|esp01s/.test(x.dev.id) ? 115200 : 9600));
      L.push("");
    });
    L.push("# ---- 模块引脚 ----");
    (plan.alloc ? plan.alloc.rows : []).forEach(function (r) {
      r.signals.forEach(function (s) {
        L.push(pyConst(r.mod.id, s.name) + " = " + pyPin(s.pin) + "  # " + r.mod.name + " · " + s.name);
      });
    });
    return L.join("\n") + "\n";
  }

  function pyDriver(mod, r, row) {
    var api = r.api;
    var L = [];
    var pins = (row ? row.signals : []).map(function (s) { return s; });
    L.push('"""' + mod.name + " 驱动（" + (mod.brand || "") + "）");
    L.push("");
    L.push(r.note || "");
    L.push('"""');
    L.push("import time");
    L.push("from machine import Pin, I2C, SPI, UART, PWM, ADC");

    if (r.cls === "i2c_reg") {
      L.push("");
      L.push("ADDR = " + (mod.addr || "0x00") + "  # 7 位地址" + (mod.altAddr ? "，可改 " + mod.altAddr : ""));
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, i2c, addr=ADDR):");
      L.push("        self.i2c = i2c");
      L.push("        self.addr = addr");
      L.push("        self._check()");
      L.push("");
      L.push("    def _check(self):");
      if (r.who) {
        L.push("        # WHO_AM_I 校验，地址接错会在这里立刻暴露");
        L.push("        who = self.i2c.readfrom_mem(self.addr, " + r.reg + ", 1)[0]");
        L.push("        if who != " + r.who + ":");
        L.push('            raise OSError("device id %02X != ' + r.who + '，检查接线/地址" % who)');
      } else {
        L.push("        if self.addr not in self.i2c.scan():");
        L.push('            raise OSError("地址 %02X 无应答，检查 SDA/SCL 与供电" % self.addr)');
      }
      L.push("");
      L.push("    def read(self):");
      L.push('        """返回 ' + r.ret + '"""');
      L.push("        # TODO 按器件寄存器表补全；下面给出通用读法");
      L.push("        raw = self.i2c.readfrom_mem(self.addr, 0x00, 6)");
      L.push("        return tuple(raw)");
      L.push("");
      L.push("    def _u16(self, reg):");
      L.push("        d = self.i2c.readfrom_mem(self.addr, reg, 2)");
      L.push("        return (d[0] << 8) | d[1]");
    } else if (r.cls === "onewire") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, pin):");
      L.push("        self.pin = Pin(pin, Pin.IN, Pin.PULL_UP)");
      L.push("");
      L.push("    def read(self):");
      L.push('        """返回 (temperature_c, humidity_pct)；失败抛 OSError"""');
      L.push("        import dht");
      L.push("        d = dht.DHT22(self.pin)");
      L.push("        time.sleep_ms(20)");
      L.push("        d.measure()");
      L.push("        return d.temperature(), d.humidity()");
    } else if (r.cls === "pulse") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, trig, echo):");
      L.push("        self.trig = Pin(trig, Pin.OUT, value=0)");
      L.push("        self.echo = Pin(echo, Pin.IN)");
      L.push("");
      L.push("    def read(self):");
      L.push('        """返回距离 cm；超时返回 None"""');
      L.push("        self.trig.value(1); time.sleep_us(10); self.trig.value(0)");
      L.push("        t0 = time.ticks_us()");
      L.push("        while self.echo.value() == 0:");
      L.push("            if time.ticks_diff(time.ticks_us(), t0) > 30000:");
      L.push("                return None");
      L.push("        t1 = time.ticks_us()");
      L.push("        while self.echo.value() == 1:");
      L.push("            if time.ticks_diff(time.ticks_us(), t1) > 30000:");
      L.push("                return None");
      L.push("        return time.ticks_diff(time.ticks_us(), t1) / 58.0");
    } else if (r.cls === "adc") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, pin):");
      L.push("        self.adc = ADC(Pin(pin))");
      L.push("        self.adc.atten(ADC.ATTN_11DB)  # 0~3.6V 量程");
      L.push("");
      L.push("    def read(self):");
      L.push('        """返回 (raw, voltage_mv)"""');
      L.push("        raw = self.adc.read()");
      L.push("        return raw, raw * 3300 // 4095");
    } else if (r.cls === "servo") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, pin):");
      L.push("        self.pwm = PWM(Pin(pin), freq=50)");
      L.push("");
      L.push("    def write(self, angle):");
      L.push('        """0~180 度；50Hz 下 0.5~2.5ms 脉宽"""');
      L.push("        angle = max(0, min(180, angle))");
      L.push("        duty = int(26 + angle / 180 * 100)   # 16bit duty 近似映射");
      L.push("        self.pwm.duty_u16(duty * 655)")
      L.push("        return angle");
    } else if (r.cls === "ws2812") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, pin, n=8):");
      L.push("        import neopixel");
      L.push("        self.np = neopixel.NeoPixel(Pin(pin), n)");
      L.push("");
      L.push("    def set(self, i, r, g, b):");
      L.push("        self.np[i] = (r, g, b)");
      L.push("        self.np.write()");
      L.push("");
      L.push("    def fill(self, r, g, b):");
      L.push("        self.np.fill((r, g, b)); self.np.write()");
    } else if (r.cls === "gpio_out") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, pins):");
      L.push("        self.pins = [Pin(p, Pin.OUT, value=0) for p in pins]");
      L.push("");
      L.push("    def set(self, ch, on):");
      L.push('        """ch 从 0 开始；低电平触发模块需取反"""');
      L.push("        if 0 <= ch < len(self.pins):");
      L.push("            self.pins[ch].value(1 if on else 0)");
    } else if (r.cls === "motor_dc") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, pins):");
      L.push("        self.pins = [Pin(p, Pin.OUT, value=0) for p in pins]");
      L.push("        self.pwm = [PWM(self.pins[i], freq=20000) for i in range(len(self.pins))]");
      L.push("");
      L.push("    def drive(self, ch, speed):");
      L.push('        """speed -100~100；符号决定方向，绝对值决定占空比"""');
      L.push("        i = ch * 2");
      L.push("        if i + 1 >= len(self.pins):");
      L.push("            return");
      L.push("        s = max(-100, min(100, speed))");
      L.push("        duty = int(abs(s) / 100 * 65535)");
      L.push("        self.pwm[i].duty_u16(duty if s >= 0 else 0)");
      L.push("        self.pwm[i + 1].duty_u16(duty if s < 0 else 0)");
      L.push("        return s");
    } else if (r.cls === "stepper") {
      L.push("");
      L.push("# 四相八拍励磁序列（1-2 相混合，力矩与平稳折中）");
      L.push("SEQ = [(1,0,0,0),(1,1,0,0),(0,1,0,0),(0,1,1,0),(0,0,1,0),(0,0,1,1),(0,0,0,1),(1,0,0,1)]");
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, pins, step_delay_ms=2):");
      L.push("        self.pins = [Pin(p, Pin.OUT, value=0) for p in pins]");
      L.push("        self.delay = step_delay_ms");
      L.push("");
      L.push("    def step(self, n):");
      L.push('        """正数正转，负数反转；28BYJ-48 一圈约 4096 步"""');
      L.push("        for _ in range(abs(n)):");
      L.push("            for phase in (SEQ if n > 0 else list(reversed(SEQ))):");
      L.push("                for i, v in enumerate(phase):");
      L.push("                    self.pins[i].value(v)");
      L.push("                time.sleep_ms(self.delay)");
    } else if (r.cls === "oled" || r.cls === "lcd") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, i2c, addr=" + (mod.addr || "0x3C") + "):");
      L.push("        self.i2c = i2c");
      L.push("        self.addr = addr");
      L.push("        self._init_seq()");
      L.push("");
      L.push("    def _init_seq(self):");
      L.push("        # 上电初始化序列：关显示 → 设时钟 → 开显示");
      L.push("        for cmd in (0xAE, 0xD5, 0x80, 0xA8, 0x3F, 0xAF):");
      L.push("            self.i2c.writeto(self.addr, bytes([0x00, cmd]))");
      L.push("");
      L.push("    def text(self, s, row=0, col=0):");
      L.push('        """' + (r.cls === "oled" ? "128×64 页寻址，row 0~7" : "16×2 字符，row 0~1") + '"""');
      L.push("        # TODO 字模渲染；建议直接用现成库（ssd1306 / lcd_api）");
      L.push("        pass");
    } else if (r.cls === "spi_display") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, spi, dc, cs, rst=None):");
      L.push("        self.spi, self.dc, self.cs, self.rst = spi, Pin(dc, Pin.OUT), Pin(cs, Pin.OUT), rst");
      L.push("        self.w, self.h = " + (r.w || 128) + ", " + (r.h || 160));
      L.push("        self._reset()");
      L.push("");
      L.push("    def _reset(self):");
      L.push("        if self.rst:");
      L.push("            Pin(self.rst, Pin.OUT, value=0)");
      L.push("            time.sleep_ms(20)");
      L.push("            Pin(self.rst, Pin.OUT, value=1)");
      L.push("            time.sleep_ms(120)");
      L.push("");
      L.push("    def _cmd(self, c):");
      L.push("        self.dc.value(0); self.cs.value(0)");
      L.push("        self.spi.write(bytes([c])); self.cs.value(1)");
      L.push("");
      L.push("    def _data(self, buf):");
      L.push("        self.dc.value(1); self.cs.value(0)");
      L.push("        self.spi.write(buf); self.cs.value(1)");
    } else if (r.cls === "encoder") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, a, b, sw=None):");
      L.push("        self.a = Pin(a, Pin.IN, Pin.PULL_UP)");
      L.push("        self.b = Pin(b, Pin.IN, Pin.PULL_UP)");
      L.push("        self.sw = Pin(sw, Pin.IN, Pin.PULL_UP) if sw is not None else None");
      L.push("        self.last = self.a.value()");
      L.push("        self.pos = 0");
      L.push("        self.a.irq(trigger=Pin.IRQ_RISING | Pin.IRQ_FALLING, handler=self._on_a)");
      L.push("");
      L.push("    def _on_a(self, pin):");
      L.push("        cur = self.a.value()");
      L.push("        if cur != self.last:");
      L.push("            self.pos += 1 if cur != self.b.value() else -1");
      L.push("            self.last = cur");
      L.push("");
      L.push("    def take(self):");
      L.push('        """返回 (delta, pressed) 并清零增量"""');
      L.push("        d, self.pos = self.pos, 0");
      L.push("        return d, (self.sw.value() == 0) if self.sw else False");
    } else if (r.cls === "keypad") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    KEYS = ['1','2','3','A','4','5','6','B','7','8','9','C','*','0','#','D']");
      L.push("");
      L.push("    def __init__(self, row_pins, col_pins):");
      L.push("        self.rows = [Pin(p, Pin.OUT, value=1) for p in row_pins]");
      L.push("        self.cols = [Pin(p, Pin.IN, Pin.PULL_UP) for p in col_pins]");
      L.push("");
      L.push("    def scan(self):");
      L.push("        for i, r in enumerate(self.rows):");
      L.push("            r.value(0)");
      L.push("            for j, c in enumerate(self.cols):");
      L.push("                if c.value() == 0:");
      L.push("                    r.value(1)");
      L.push("                    return self.KEYS[i * 4 + j]");
      L.push("            r.value(1)");
      L.push("        return None");
    } else if (r.cls === "spi_dev" || r.cls === "spi_radio" || r.cls === "spi_net" || r.cls === "spi_storage") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, spi, cs):");
      L.push("        self.spi, self.cs = spi, Pin(cs, Pin.OUT, value=1)");
      L.push("");
      L.push("    def xfer(self, buf):");
      L.push('        """全双工传输：拉低 CS → 收发 → 拉高 CS"""');
      L.push("        self.cs.value(0)");
      L.push("        out = bytearray(len(buf))");
      L.push("        self.spi.write_readinto(buf, out)");
      L.push("        self.cs.value(1)");
      L.push("        return out");
      if (r.cls === "spi_storage") {
        L.push("");
        L.push("    def mount(self):");
        L.push("        import os, sdcard");
        L.push("        sd = sdcard.SDCard(self.spi, self.cs)");
        L.push('        os.mount(sd, "/sd")');
      }
    } else if (r.cls === "uart_rx" || r.cls === "uart_at" || r.cls === "uart_half") {
      L.push("");
      L.push("class " + api.toUpperCase() + ":");
      L.push("    def __init__(self, uart):");
      L.push("        self.uart = uart");
      L.push("        self.buf = b\"\"");
      L.push("");
      L.push("    def poll(self):");
      L.push('        """非阻塞读：返回一帧完整数据或 None"""');
      L.push("        d = self.uart.read()");
      L.push("        if d:");
      L.push("            self.buf += d");
      L.push("        if len(self.buf) > 512:");
      L.push("            self.buf = self.buf[-512:]");
      L.push("        return None  # TODO 按帧头/长度解析");
      if (r.cls === "uart_at") {
        L.push("");
        L.push("    def cmd(self, s, wait_ms=500):");
        L.push('        """发 AT 指令并返回响应文本"""');
        L.push("        self.uart.write(s + \"\\r\\n\")");
        L.push("        time.sleep_ms(wait_ms)");
        L.push("        return self.uart.read() or b\"\"");
      }
    } else {
      L.push("");
      L.push("# 该模块不需要驱动代码（电源/无源配件）");
    }
    return L.join("\n") + "\n";
  }

  function pyMain(plan, b, links) {
    var L = [];
    L.push("# main.py — MODBAY 生成的主程序");
    L.push("# " + plan.board.name + " + " + (plan.items || []).length + " 个模块");
    L.push("import time");
    L.push("from machine import I2C, SPI, UART, Pin");
    L.push("import bsp_board as B");
    L.push("");
    var drv = (plan.alloc ? plan.alloc.rows : []).filter(function (r) { return recipeOf(r.mod).cls !== "none"; });
    drv.forEach(function (r) {
      L.push("from drivers." + r.mod.id + " import " + recipeOf(r.mod).api.toUpperCase() + " as " + camel(r.mod.id) + "Drv");
    });
    L.push("");
    L.push("def main():");
    if (b.i2c.length) {
      L.push("    i2c0 = I2C(0, sda=B.I2C0_SDA, scl=B.I2C0_SCL, freq=B.I2C0_FREQ)");
      L.push("    print('I2C0 scan:', [hex(a) for a in i2c0.scan()])");
    }
    if (b.spi.length) L.push("    spi0 = SPI(0, sck=B.SPI0_SCK, mosi=B.SPI0_MOSI, miso=B.SPI0_MISO, baudrate=B.SPI0_BAUD)");
    if (b.uart.length) L.push("    uart0 = UART(0, tx=B.UART0_TX, rx=B.UART0_RX, baudrate=B.UART0_BAUD)");
    L.push("");
    L.push("    # ---- 驱动实例化（引脚全部来自 BSP，改板不用改这里） ----");
    var seen = {};
    drv.forEach(function (r) {
      var R = recipeOf(r.mod), sig = r.signals, varName = camel(r.mod.id) + "Drv";
      if (seen[varName]) return;
      seen[varName] = 1;
      var pins = sig.map(function (s) { return "B." + pyConst(r.mod.id, s.name); });
      if (R.cls === "i2c_reg" || R.cls === "oled" || R.cls === "lcd") {
        L.push("    " + varName + " = " + R.api.toUpperCase() + "(i2c0, " + (r.mod.addr || "0x00") + ")");
      } else if (R.cls === "spi_dev" || R.cls === "spi_radio" || R.cls === "spi_net" || R.cls === "spi_storage") {
        L.push("    " + varName + " = " + R.api.toUpperCase() + "(spi0, " + (r.cs ? "B." + pyConst(r.mod.id, "CS") : pins[0] || "0") + ")");
      } else if (R.cls === "spi_display") {
        L.push("    " + varName + " = " + R.api.toUpperCase() + "(spi0, " + pins.slice(0, 3).join(", ") + ")");
      } else if (R.cls === "uart_rx" || R.cls === "uart_at" || R.cls === "uart_half") {
        L.push("    " + varName + " = " + R.api.toUpperCase() + "(uart0)");
      } else if (R.cls === "gpio_out" || R.cls === "motor_dc" || R.cls === "stepper") {
        L.push("    " + varName + " = " + R.api.toUpperCase() + "([" + pins.join(", ") + "])");
      } else if (R.cls === "servo" || R.cls === "ws2812" || R.cls === "onewire" || R.cls === "adc") {
        L.push("    " + varName + " = " + R.api.toUpperCase() + "(" + pins[0] + ")");
      } else if (R.cls === "pulse") {
        L.push("    " + varName + " = " + R.api.toUpperCase() + "(" + pins.slice(0, 2).join(", ") + ")");
      } else if (R.cls === "encoder") {
        L.push("    " + varName + " = " + R.api.toUpperCase() + "(" + pins.slice(0, 3).join(", ") + ")");
      }
    });
    L.push("");
    if (links.length) {
      L.push("    # ---- 联动逻辑（由方案自动推导，见 linkage.py） ----");
      links.forEach(function (k) {
        L.push("    # " + k.title);
      });
    }
    L.push("    while True:");
    L.push("        try:");
    var any = false;
    drv.forEach(function (r) {
      var R = recipeOf(r.mod), varName = camel(r.mod.id) + "Drv";
      if (R.cls === "i2c_reg" || R.cls === "adc" || R.cls === "pulse" || R.cls === "onewire" || R.cls === "encoder") {
        L.push("            v = " + varName + ".read()" + (R.cls === "encoder" ? "" : ""));
        L.push("            print('" + r.mod.id + ":', v)");
        any = true;
      }
    });
    if (!any) L.push("            pass");
    L.push("            time.sleep_ms(500)");
    L.push("        except Exception as e:");
    L.push("            print('loop error:', e)");
    L.push("            time.sleep_ms(1000)");
    L.push("");
    L.push("");
    L.push('if __name__ == "__main__":');
    L.push("    main()");
    return L.join("\n") + "\n";
  }

  function camel(id) {
    return id.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }

  /* ---------- C 版：BSP 头 + 总线初始化 + 驱动骨架 ---------- */
  function cBoard(plan, b) {
    var L = [];
    L.push("/* bsp_board.h — 板级支持包（MODBAY 自动生成）");
    L.push(" * 基座：" + plan.board.name);
    L.push(" * 逻辑电平：" + plan.board.logic + "  |  生成时间基线：方案 " + planSlug(plan).slice(0, 24));
    L.push(" */");
    L.push("#pragma once");
    L.push("#include <stdint.h>");
    L.push("");
    L.push('#define MB_BOARD_NAME   "' + plan.board.name + '"');
    L.push("#define MB_BOARD_ID     \"" + plan.board.id + "\"");
    L.push("#define MB_LOGIC_MV     " + (parseFloat(plan.board.logic) * 1000 || 3300));
    L.push("#define MB_RAIL_3V3_MA  " + (plan.board.supply3v3 || 0));
    L.push("#define MB_RAIL_5V_MA   " + (plan.board.supply5v || 0));
    L.push("");
    L.push("/* 非数字引脚名（如 PA9）由目标 HAL 提供同名宏；此处兜底为占位 */");
    var syms = {};
    (plan.alloc ? plan.alloc.rows : []).forEach(function (r) {
      r.signals.forEach(function (s) { if (cNum(s.pin) === null) syms[s.pin] = 1; });
    });
    b.i2c.forEach(function (x) { [x.sda, x.scl].forEach(function (p) { if (cNum(p) === null) syms[p] = 1; }); });
    b.spi.forEach(function (x) { [x.sck, x.mosi, x.miso].forEach(function (p) { if (cNum(p) === null) syms[p] = 1; }); });
    b.uart.forEach(function (x) { [x.tx, x.rx].forEach(function (p) { if (cNum(p) === null) syms[p] = 1; }); });
    Object.keys(syms).forEach(function (p) {
      L.push("#ifndef MB_SYM_" + p.replace(/[^A-Za-z0-9]/g, "_"));
      L.push("#define MB_SYM_" + p.replace(/[^A-Za-z0-9]/g, "_") + "  (0)  /* " + p + "：请替换为目标平台的引脚宏 */");
      L.push("#endif");
    });
    L.push("");
    b.i2c.forEach(function (x, i) {
      L.push("/* I2C" + i + "：" + x.devs.map(function (m) { return m.name; }).join(" / ") + " */");
      L.push("#define MB_I2C" + i + "_SDA  " + cPin(x.sda));
      L.push("#define MB_I2C" + i + "_SCL  " + cPin(x.scl));
      L.push("#define MB_I2C" + i + "_HZ   400000");
      L.push("");
    });
    b.spi.forEach(function (x, i) {
      L.push("/* SPI" + i + " */");
      L.push("#define MB_SPI" + i + "_SCK   " + cPin(x.sck));
      L.push("#define MB_SPI" + i + "_MOSI  " + cPin(x.mosi));
      L.push("#define MB_SPI" + i + "_MISO  " + cPin(x.miso));
      L.push("#define MB_SPI" + i + "_HZ    10000000");
      L.push("");
    });
    b.uart.forEach(function (x, i) {
      L.push("/* UART" + i + "：" + x.dev.name + " */");
      L.push("#define MB_UART" + i + "_TX    " + cPin(x.tx));
      L.push("#define MB_UART" + i + "_RX    " + cPin(x.rx));
      L.push("#define MB_UART" + i + "_BAUD  " + (/sim800l|esp01s/.test(x.dev.id) ? 115200 : 9600));
      L.push("");
    });
    L.push("/* ---- 模块引脚 ---- */");
    (plan.alloc ? plan.alloc.rows : []).forEach(function (r) {
      r.signals.forEach(function (s) {
        L.push("#define " + cConst(r.mod.id, s.name) + "  " + cPin(s.pin) + "  /* " + r.mod.name + " · " + s.name + " */");
      });
    });
    L.push("");
    L.push("/* ---- 初始化入口 ---- */");
    L.push("void mb_bsp_init(void);");
    return L.join("\n") + "\n";
  }

  function cBus(plan, b) {
    var L = [];
    L.push("/* bsp_bus.c — 总线初始化与自检（MODBAY 自动生成） */");
    L.push('#include "bsp_board.h"');
    L.push('#include "bsp_bus.h"');
    L.push("#include <stdio.h>");
    L.push("");
    L.push("static i2c_master_bus_handle_t s_i2c[" + Math.max(1, b.i2c.length) + "];");
    L.push("");
    L.push("void mb_bsp_init(void)");
    L.push("{");
    b.i2c.forEach(function (x, i) {
      L.push("    i2c_master_bus_config_t cfg" + i + " = {");
      L.push("        .i2c_port = " + i + ",");
      L.push("        .sda_io_num = MB_I2C" + i + "_SDA,");
      L.push("        .scl_io_num = MB_I2C" + i + "_SCL,");
      L.push("        .clk_source = I2C_CLK_SRC_DEFAULT,");
      L.push("        .glitch_ignore_cnt = 7,");
      L.push("        .flags.enable_internal_pullup = true,");
      L.push("    };");
      L.push("    ESP_ERROR_CHECK(i2c_new_master_bus(&cfg" + i + ", &s_i2c[" + i + "]));");
      L.push("");
    });
    b.spi.forEach(function (x, i) {
      L.push("    /* SPI" + i + "：" + x.devs.map(function (m) { return m.name; }).join(" / ") + " */");
      L.push("    spi_bus_config_t spi" + i + " = {");
      L.push("        .mosi_io_num = MB_SPI" + i + "_MOSI,");
      L.push("        .miso_io_num = MB_SPI" + i + "_MISO,");
      L.push("        .sclk_io_num = MB_SPI" + i + "_SCK,");
      L.push("        .quadwp_io_num = -1, .quadhd_io_num = -1,");
      L.push("        .max_transfer_sz = 4096,");
      L.push("    };");
      L.push("    ESP_ERROR_CHECK(spi_bus_initialize(SPI" + (i + 2) + "_HOST, &spi" + i + ", SPI_DMA_CH_AUTO));");
      L.push("");
    });
    b.uart.forEach(function (x, i) {
      L.push("    /* UART" + i + "：" + x.dev.name + " */");
      L.push("    uart_config_t u" + i + " = { .baud_rate = MB_UART" + i + "_BAUD, .data_bits = UART_DATA_8_BITS,");
      L.push("                             .parity = UART_PARITY_DISABLE, .stop_bits = UART_STOP_BITS_1 };");
      L.push("    uart_param_config(UART_NUM_" + i + ", &u" + i + ");");
      L.push("    uart_set_pin(UART_NUM_" + i + ", MB_UART" + i + "_TX, MB_UART" + i + "_RX, -1, -1);");
      L.push("    uart_driver_install(UART_NUM_" + i + ", 1024, 0, 0, NULL, 0);");
      L.push("");
    });
    L.push("}");
    L.push("");
    L.push("/* I2C 扫描：上电自检，缺件立刻发现 */");
    L.push("int mb_i2c_scan(int port, uint8_t *out, int max)");
    L.push("{");
    L.push("    int n = 0;");
    L.push("    for (uint8_t a = 0x08; a < 0x78; a++) {");
    L.push("        if (i2c_master_probe(s_i2c[port], a, 50) == ESP_OK && n < max) out[n++] = a;");
    L.push("    }");
    L.push("    return n;");
    L.push("}");
    return L.join("\n") + "\n";
  }

  function cDriver(mod, r, row) {
    var R = r, api = R.api, up = R.api.toUpperCase();
    var L = [];
    L.push("/* drv_" + mod.id + ".c — " + mod.name + "（" + (mod.brand || "通用") + "）");
    L.push(" * " + (R.note || ""));
    L.push(" */");
    L.push('#include "bsp_board.h"');
    L.push('#include "drv_' + mod.id + '.h"');
    L.push("");
    if (R.cls === "i2c_reg") {
      L.push("#define ADDR " + (mod.addr || "0x00"));
      L.push("");
      L.push("esp_err_t " + api + "_init(i2c_master_bus_handle_t bus, " + api + "_t *dev)");
      L.push("{");
      L.push("    i2c_device_config_t cfg = { .dev_addr_length = I2C_ADDR_BIT_LEN_7, .scl_speed_hz = 400000,");
      L.push("                               .device_address = ADDR };");
      L.push("    esp_err_t e = i2c_master_bus_add_device(bus, &cfg, &dev->handle);");
      L.push("    if (e != ESP_OK) return e;");
      if (R.who) {
        L.push("");
        L.push("    uint8_t who = 0;");
        L.push("    e = " + api + "_read_reg(dev, " + R.reg + ", &who, 1);");
        L.push("    if (e != ESP_OK || who != " + R.who + ") return ESP_ERR_NOT_FOUND;  /* 型号不符 */");
      }
      L.push("    return ESP_OK;");
      L.push("}");
      L.push("");
      L.push("esp_err_t " + api + "_read_reg(" + api + "_t *dev, uint8_t reg, uint8_t *buf, size_t n)");
      L.push("{");
      L.push("    return i2c_master_transmit_receive(dev->handle, &reg, 1, buf, n, 100);");
      L.push("}");
      L.push("");
      L.push("esp_err_t " + api + "_write_reg(" + api + "_t *dev, uint8_t reg, uint8_t val)");
      L.push("{");
      L.push("    uint8_t b[2] = { reg, val };");
      L.push("    return i2c_master_transmit(dev->handle, b, 2, 100);");
      L.push("}");
      L.push("");
      L.push("esp_err_t " + api + "_read(" + api + "_t *dev)");
      L.push("{");
      L.push("    /* 返回：" + R.ret + " */");
      L.push("    uint8_t raw[8] = {0};");
      L.push("    esp_err_t e = " + api + "_read_reg(dev, 0x00, raw, sizeof(raw));");
      L.push("    if (e != ESP_OK) return e;");
      L.push("    /* TODO 按寄存器表换算工程量 */");
      L.push("    return ESP_OK;");
      L.push("}");
    } else if (R.cls === "pulse") {
      L.push("esp_err_t " + api + "_init(" + api + "_t *dev)");
      L.push("{");
      L.push("    gpio_config_t io = { .pin_bit_mask = (1ULL << " + cPin(row.signals[0].pin) + ") | (1ULL << " + cPin(row.signals[1].pin) + "),");
      L.push("                         .mode = GPIO_MODE_INPUT_OUTPUT, .pull_up_en = 0, .pull_down_en = 0 };");
      L.push("    return gpio_config(&io);");
      L.push("}");
      L.push("");
      L.push("esp_err_t " + api + "_read(" + api + "_t *dev, float *cm)");
      L.push("{");
      L.push("    gpio_set_level(" + cPin(row.signals[0].pin) + ", 0);");
      L.push("    esp_rom_delay_us(2);");
      L.push("    gpio_set_level(" + cPin(row.signals[0].pin) + ", 1);");
      L.push("    esp_rom_delay_us(10);");
      L.push("    gpio_set_level(" + cPin(row.signals[0].pin) + ", 0);");
      L.push("    /* 用 RMT 或定时器测 Echo 高电平宽度；此处留接口 */");
      L.push("    return ESP_OK;");
      L.push("}");
    } else if (R.cls === "adc") {
      L.push("esp_err_t " + api + "_init(" + api + "_t *dev)");
      L.push("{");
      L.push("    adc_oneshot_unit_init_cfg_t u = { .unit_id = ADC_UNIT_1 };");
      L.push("    adc_oneshot_new_unit(&u, &dev->unit);");
      L.push("    adc_oneshot_chan_cfg_t c = { .atten = ADC_ATTEN_DB_12, .bitwidth = ADC_BITWIDTH_12 };");
      L.push("    return adc_oneshot_config_channel(dev->unit, " + cPin(row.signals[0].pin) + ", &c);");
      L.push("}");
      L.push("");
      L.push("esp_err_t " + api + "_read(" + api + "_t *dev, int *raw, int *mv)");
      L.push("{");
      L.push("    esp_err_t e = adc_oneshot_read(dev->unit, " + cPin(row.signals[0].pin) + ", raw);");
      L.push("    if (e == ESP_OK) *mv = *raw * 3300 / 4095;");
      L.push("    return e;");
      L.push("}");
    } else if (R.cls === "gpio_out") {
      L.push("esp_err_t " + api + "_init(" + api + "_t *dev)");
      L.push("{");
      L.push("    gpio_config_t io = { .mode = GPIO_MODE_OUTPUT,");
      L.push("                         .pin_bit_mask = 0");
      row.signals.forEach(function (s) { L.push("                         | (1ULL << " + cPin(s.pin) + ")"); });
      L.push("                       };");
      L.push("    esp_err_t e = gpio_config(&io);");
      L.push("    " + api + "_set(dev, 0, 0);");
      L.push("    return e;");
      L.push("}");
      L.push("");
      L.push("void " + api + "_set(" + api + "_t *dev, int ch, int on)");
      L.push("{");
      L.push("    static const int pins[] = { " + row.signals.map(function (s) { return cPin(s.pin); }).join(", ") + " };");
      L.push("    if (ch >= 0 && ch < (int)(sizeof(pins) / sizeof(pins[0])))");
      L.push("        gpio_set_level(pins[ch], on ? 1 : 0);");
      L.push("}");
    } else {
      L.push("/* " + (R.note || "") + " */");
      L.push("esp_err_t " + api + "_init(" + api + "_t *dev)");
      L.push("{");
      L.push("    /* TODO 按 " + mod.name + " 数据手册完成初始化 */");
      L.push("    return ESP_OK;");
      L.push("}");
      L.push("");
      L.push("esp_err_t " + api + "_read(" + api + "_t *dev)");
      L.push("{");
      L.push("    return ESP_OK;");
      L.push("}");
    }
    return L.join("\n") + "\n";
  }

  function cDriverHeader(mod, r) {
    var api = r.api;
    var L = [];
    L.push("/* drv_" + mod.id + ".h — " + mod.name + " */");
    L.push("#pragma once");
    L.push('#include "driver/i2c_master.h"');
    L.push('#include "driver/gpio.h"');
    L.push("#include <stddef.h>");
    L.push("");
    L.push("typedef struct { void *handle; } " + api + "_t;");
    L.push("");
    L.push("esp_err_t " + api + "_init(" + api + "_t *dev);");
    L.push("esp_err_t " + api + "_read(" + api + "_t *dev);  /* " + (r.ret || "raw") + " */");
    return L.join("\n") + "\n";
  }

  function platformio(plan, b) {
    var plat = /stm32/i.test(plan.board.id) ? "ststm32" : (/rp2040/i.test(plan.board.id) ? "raspberrypi" : (/esp8266|esp01/i.test(plan.board.id) ? "espressif8266" : "espressif32"));
    var L = [];
    L.push("; platformio.ini — MODBAY 自动生成");
    L.push("[env:modbay]");
    L.push("platform = " + plat);
    L.push("board = " + plan.board.id);
    L.push("framework = espidf");
    L.push("monitor_speed = 115200");
    L.push("build_flags =");
    L.push("    -Iinclude");
    L.push("    -Isrc");
    L.push("    -Wall");
    L.push("");
    L.push("; 依赖库（按选中的模块自动追加）");
    (plan.alloc ? plan.alloc.rows : []).forEach(function (r) {
      var lib = {
        oled096: "thingpulse/ESP8266 and ESP32 OLED driver for SSD1306@^4.5.1",
        oled13: "thingpulse/ESP8266 and ESP32 OLED driver for SSD1306@^4.5.1",
        tft18: "bodmer/TFT_eSPI@^2.5.34",
        ili9341: "bodmer/TFT_eSPI@^2.5.34",
        dht22: "adafruit/DHT sensor library@^1.4.6",
        bmp280: "boschsensortec/Bosch BMP280 Sensor@^1.0.0",
        mpu6050: "electroniccats/MPU6050@^0.5.1",
        nrf24: "nrf24/RF24@^1.4.11",
        lora: "sandeepmistry/LoRa@^0.8.0",
        rc522: "miguelbalboa/MFRC522@^1.4.10",
        ws2812: "adafruit/Adafruit NeoPixel@^1.12.0",
        gps: "mikalhart/TinyGPSPlus@^1.0.3"
      }[r.mod.id];
      if (lib) L.push("lib_deps = " + lib);
    });
    return L.join("\n") + "\n";
  }

  function readme(plan, b, files) {
    var L = [];
    L.push("# " + (plan.board ? plan.board.name : "MODBAY") + " 软件方案");
    L.push("");
    L.push("> 由 MODBAY 依据选型自动生成：引脚、总线、地址、驱动骨架全部来自真实分配结果。");
    L.push("");
    L.push("## 组成");
    L.push("");
    L.push("| 目录 | 内容 |");
    L.push("| --- | --- |");
    L.push("| `bsp/` | 板级支持包：引脚宏、总线初始化、I2C 自检 |");
    L.push("| `drivers/` | 每个模块一个驱动，含初始化与读取接口 |");
    L.push("| `app/` | 联动逻辑（传感器 → 执行器） |");
    L.push("| `proto/` | 对外协议：MQTT / HTTP / Modbus |");
    L.push("| `firmware/` | MicroPython 版（可直接跑，改完就能看到效果） |");
    L.push("");
    L.push("## 引脚分配");
    L.push("");
    L.push("| 模块 | 信号 | 引脚 |");
    L.push("| --- | --- | --- |");
    (plan.alloc ? plan.alloc.rows : []).forEach(function (r) {
      r.signals.forEach(function (s, i) {
        L.push("| " + (i === 0 ? r.mod.name : "") + " | " + s.name + " | `" + s.pin + "` |");
      });
    });
    L.push("");
    L.push("## 上电自检");
    L.push("");
    L.push("```bash");
    L.push("# MicroPython");
    L.push("mpremote connect auto fs cp -r firmware/ :");
    L.push("mpremote connect auto run firmware/main.py");
    L.push("");
    L.push("# C / ESP-IDF");
    L.push("idf.py set-target " + (/esp32s3/.test(plan.board.id) ? "esp32s3" : "esp32") + " && idf.py build flash monitor");
    L.push("```");
    L.push("");
    L.push("首屏应打印 I2C 扫描结果，与下表地址逐一对照，缺哪个就是哪根线没接好。");
    L.push("");
    L.push("| 地址 | 设备 |");
    L.push("| --- | --- |");
    var seenAddr = {};
    (plan.alloc ? plan.alloc.rows : []).forEach(function (r) {
      if (r.mod.addr && !seenAddr[r.mod.addr]) {
        seenAddr[r.mod.addr] = 1;
        L.push("| `" + r.mod.addr + "` | " + r.mod.name + " |");
      }
    });
    L.push("");
    L.push("## 文件清单（" + files.length + " 个）");
    L.push("");
    files.forEach(function (f) { L.push("- `" + f.path + "` — " + f.lines + " 行"); });
    return L.join("\n") + "\n";
  }

  /* ---------- 联动逻辑：传感器 → 执行器 ---------- */
  var RULES = [
    { sensors: ["hcsr04", "vl53l0x"], actors: ["sg90", "mg996r"], title: "避障/跟随：距离小于阈值时转动舵机",
      cond: "dist < 20cm", act: "servo.write(90)", topic: "sensor/distance" },
    { sensors: ["dht22", "sht30", "sht40", "mlx90614"], actors: ["relay", "relay4", "buzzer"], title: "温控：超阈值吸合继电器",
      cond: "temp > 30C", act: "relay.set(0, 1)", topic: "sensor/temp" },
    { sensors: ["soil"], actors: ["relay", "relay4"], title: "浇水：土壤偏干时开泵",
      cond: "moisture < 30%", act: "relay.set(0, 1)", topic: "sensor/soil" },
    { sensors: ["mq2", "pm25"], actors: ["buzzer", "relay", "ws2812"], title: "报警：气体/颗粒物超标声光提示",
      cond: "gas > threshold", act: "buzzer + led", topic: "sensor/air" },
    { sensors: ["bh1750"], actors: ["ws2812", "relay"], title: "光控：环境变暗自动开灯",
      cond: "lux < 50", act: "ws2812.fill()", topic: "sensor/lux" },
    { sensors: ["mpu6050"], actors: ["tt", "l298n", "tb6612", "drv8833"], title: "姿态反馈：倾角超限减速/回正",
      cond: "|pitch| > 15deg", act: "motor.drive()", topic: "sensor/imu" },
    { sensors: ["encoder"], actors: ["oled096", "oled13", "lcd1602"], title: "旋钮菜单：编码器增量驱动界面",
      cond: "delta != 0", act: "ui.move(delta)", topic: "ui/event" },
    { sensors: ["ina219"], actors: ["oled096", "oled13"], title: "电量显示：电压/电流实时上屏",
      cond: "always", act: "ui.show(v, i)", topic: "power/meter" },
    { sensors: ["gps"], actors: ["lora", "sim800l"], title: "位置上报：GPS 定位经 LoRa/GSM 回传",
      cond: "fix valid", act: "radio.send(lat, lon)", topic: "geo/fix" },
    { sensors: ["max30102"], actors: ["oled096", "oled13"], title: "生命体征：心率血氧上屏",
      cond: "finger detected", act: "ui.show(hr, spo2)", topic: "sensor/vital" },
    { sensors: ["rtc"], actors: ["oled096", "oled13", "lcd1602"], title: "时钟：RTC 时间驱动显示",
      cond: "every 1s", act: "ui.showTime()", topic: "time/now" }
  ];

  function linkages(plan) {
    var have = {};
    (plan.items || []).forEach(function (it) { have[it.mod.id] = 1; });
    var out = [];
    RULES.forEach(function (r) {
      var s = r.sensors.filter(function (x) { return have[x]; })[0];
      var a = r.actors.filter(function (x) { return have[x]; })[0];
      if (s && a) {
        out.push({
          sensor: s, actor: a, title: r.title, cond: r.cond, act: r.act, topic: r.topic,
          sensorName: nameOf(plan, s), actorName: nameOf(plan, a)
        });
      }
    });
    return out;
  }
  function nameOf(plan, id) {
    var hit = (plan.items || []).filter(function (it) { return it.mod.id === id; })[0];
    return hit ? hit.mod.name : id;
  }

  function pyLinkage(plan, links) {
    var L = [];
    L.push("# linkage.py — 联动逻辑（由选型自动推导）");
    L.push("# 规则：" + (links.length ? links.map(function (k) { return k.title; }).join("；") : "无（未同时选中传感器与执行器）"));
    L.push("");
    if (!links.length) {
      L.push("def tick(ctx):");
      L.push("    return None");
      return L.join("\n") + "\n";
    }
    L.push("import time");
    L.push("");
    L.push("def tick(ctx):");
    L.push('    """ctx 是 dict：{ 驱动名: 驱动实例 }；每轮主循环调用一次"""');
    links.forEach(function (k) {
      L.push("    # " + k.title);
      L.push("    # 条件：" + k.cond + "  →  动作：" + k.act);
      L.push("    # 上报主题：" + k.topic);
    });
    L.push("    return None");
    return L.join("\n") + "\n";
  }

  function mqttCode(plan, links) {
    var slug = planSlug(plan).replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "device";
    var L = [];
    L.push('# proto_mqtt.py — 外部通信协议（MQTT 3.1.1 over TCP）');
    L.push('"""');
    L.push("主题设计：");
    L.push("  上行  modbay/" + slug + "/telemetry    传感器数据（JSON）");
    L.push("  上行  modbay/" + slug + "/event        事件（阈值触发）");
    L.push("  上行  modbay/" + slug + "/status       在线状态 + 固件版本（retain）");
    L.push("  下行  modbay/" + slug + "/cmd          控制指令（JSON）");
    L.push("  下行  modbay/" + slug + "/ota          固件升级通知");
    L.push('"""');
    L.push("import json");
    L.push("import time");
    L.push("import network");
    L.push("");
    L.push('SSID = "your-wifi"');
    L.push('PASS = "your-password"');
    L.push('BROKER = "mqtt.modbay.local"');
    L.push("PORT = 1883");
    L.push('CLIENT_ID = "mb-' + slug + '"');
    L.push("");
    L.push("TOPIC_UP   = \"modbay/" + slug + "/telemetry\"");
    L.push("TOPIC_EVT  = \"modbay/" + slug + "/event\"");
    L.push("TOPIC_STAT = \"modbay/" + slug + "/status\"");
    L.push("TOPIC_CMD  = \"modbay/" + slug + "/cmd\"");
    L.push("");
    L.push("");
    L.push("def wifi_connect(timeout=15):");
    L.push("    wlan = network.WLAN(network.STA_IF)");
    L.push("    wlan.active(True)");
    L.push("    if not wlan.isconnected():");
    L.push("        wlan.connect(SSID, PASS)");
    L.push("        t0 = time.time()");
    L.push("        while not wlan.isconnected() and time.time() - t0 < timeout:");
    L.push("            time.sleep_ms(300)");
    L.push("    return wlan.isconnected()");
    L.push("");
    L.push("");
    L.push("def payload(samples, seq):");
    L.push('    """统一遥测格式：设备身份 + 时间戳 + 通道值"""');
    L.push("    return json.dumps({");
    L.push('        "device": "' + slug + '",');
    L.push('        "board": "' + plan.board.id + '",');
    L.push('        "fw": "1.0.0",');
    L.push('        "seq": seq,');
    L.push('        "ts": int(time.time()),');
    L.push('        "channels": samples,');
    L.push("    })");
    L.push("");
    L.push("");
    L.push("def on_cmd(topic, msg):");
    L.push("    try:");
    L.push("        cmd = json.loads(msg)");
    L.push("    except ValueError:");
    L.push("        return");
    L.push('    # {"act":"relay","ch":0,"on":1}  →  分发到对应驱动');
    L.push("    dispatch(cmd)");
    L.push("");
    L.push("");
    L.push("def dispatch(cmd):");
    L.push('    """把下行指令路由到驱动；未注册的动作静默忽略"""');
    L.push("    act = cmd.get(\"act\")");
    L.push("    handlers = globals().get(\"HANDLERS\", {})");
    L.push("    fn = handlers.get(act)");
    L.push("    if fn:");
    L.push("        fn(cmd)");
    L.push("");
    L.push("");
    L.push("# 通道清单：与方案里的传感器一一对应");
    L.push("CHANNELS = [");
    var rows = (plan.alloc ? plan.alloc.rows : []).filter(function (r) {
      return /i2c_reg|adc|pulse|onewire|uart_rx/.test(recipeOf(r.mod).cls);
    });
    rows.forEach(function (r, i) {
      L.push('    "' + r.mod.id + '",   # ' + r.mod.name + " → " + (recipeOf(r.mod).ret || "raw"));
    });
    L.push("]");
    return L.join("\n") + "\n";
  }

  function httpCode(plan) {
    var L = [];
    L.push("# proto_http.py — 外部通信协议（HTTPS 上报）");
    L.push("import json");
    L.push("import urequests");
    L.push("");
    L.push('ENDPOINT = "https://api.modbay.local/v1/telemetry"');
    L.push('TOKEN    = "device-token-here"');
    L.push("");
    L.push("");
    L.push("def post(samples):");
    L.push("    body = json.dumps({");
    L.push('        "device": "' + planSlug(plan).slice(0, 24) + '",');
    L.push('        "channels": samples,');
    L.push("    })");
    L.push("    r = urequests.post(ENDPOINT, data=body, headers={");
    L.push('        "Content-Type": "application/json",');
    L.push('        "Authorization": "Bearer " + TOKEN,');
    L.push("    })");
    L.push("    ok = r.status_code == 200");
    L.push("    r.close()");
    L.push("    return ok");
    return L.join("\n") + "\n";
  }

  function modbusCode(plan) {
    var rows = (plan.alloc ? plan.alloc.rows : []).filter(function (r) { return recipeOf(r.mod).cls === "i2c_reg" || recipeOf(r.mod).cls === "adc"; });
    var L = [];
    L.push("# proto_modbus.py — 工业协议（Modbus RTU 从站映射）");
    L.push("# 把传感器值映射到保持寄存器，PLC / 组态软件可直接读");
    L.push("from machine import UART");
    L.push("");
    L.push("SLAVE_ID = 1");
    L.push("BAUD = 9600");
    L.push("");
    L.push("# 寄存器表：地址 → (名称, 缩放倍数)");
    L.push("REGS = {");
    rows.forEach(function (r, i) {
      L.push("    " + (i) + ": (\"" + r.mod.id + "\", 10),   # " + r.mod.name + " → " + (recipeOf(r.mod).ret || "raw"));
    });
    L.push("}");
    L.push("");
    L.push("");
    L.push("def crc16(buf):");
    L.push("    crc = 0xFFFF");
    L.push("    for b in buf:");
    L.push("        crc ^= b");
    L.push("        for _ in range(8):");
    L.push("            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1");
    L.push("    return crc");
    L.push("");
    L.push("");
    L.push("def handle(frame, values):");
    L.push('    """功能码 0x03 读保持寄存器；返回应答帧"""');
    L.push("    addr, func = frame[0], frame[1]");
    L.push("    start = (frame[2] << 8) | frame[3]");
    L.push("    count = (frame[4] << 8) | frame[5]");
    L.push("    body = bytearray([addr, func, count * 2])");
    L.push("    for i in range(count):");
    L.push("        v = int(values.get(start + i, 0) * 10) & 0xFFFF");
    L.push("        body += bytes([v >> 8, v & 0xFF])");
    L.push("    c = crc16(body)");
    L.push("    return bytes(body) + bytes([c & 0xFF, c >> 8])");
    return L.join("\n") + "\n";
  }

  /* ---------- 协议清单 ---------- */
  function protocols(plan) {
    var out = [];
    (plan.alloc ? plan.alloc.rows : []).forEach(function (r) {
      var R = recipeOf(r.mod), m = r.mod;
      var sig = {};
      r.signals.forEach(function (s) { sig[s.name] = s.pin; });
      if (m.bus === "i2c") {
        out.push({ kind: "I2C", dev: m.name, detail: "地址 " + m.addr + (m.altAddr ? "（可改 " + m.altAddr + "）" : ""), speed: "400 kHz", pins: sig.SDA + " / " + sig.SCL, note: "上拉 4.7kΩ，总线共享靠地址区分" });
      } else if (m.bus === "spi") {
        out.push({ kind: "SPI", dev: m.name, detail: "模式 0（CPOL=0 CPHA=0）", speed: "10 MHz", pins: [sig.SCK, sig.MOSI, sig.MISO, sig.CS].filter(Boolean).join(" / "), note: "CS 独占，多设备共用 SCK/MOSI/MISO" });
      } else if (m.bus === "uart") {
        out.push({ kind: "UART", dev: m.name, detail: /sim800l|esp01s/.test(m.id) ? "AT 指令集" : "8N1 透传", speed: (/sim800l|esp01s/.test(m.id) ? "115200" : "9600") + " 8N1", pins: sig.TX + " / " + sig.RX, note: "TX 接 RX 交叉，共地必须可靠" });
      } else if (m.bus === "adc") {
        out.push({ kind: "ADC", dev: m.name, detail: "12bit / 0~3.3V", speed: "—", pins: sig.IO1 || "", note: "模拟量需软件滤波，长线加 100nF" });
      } else if (m.bus === "pwm") {
        out.push({ kind: "PWM", dev: m.name, detail: /ws2812/.test(m.id) ? "800kHz 归零码" : "50Hz 舵机", speed: "—", pins: sig.IO1 || "", note: /ws2812/.test(m.id) ? "时序敏感，禁中断" : "0.5~2.5ms 对应 0~180°" });
      } else if (m.bus === "gpio") {
        out.push({ kind: "GPIO", dev: m.name, detail: (m.pins || 0) + " 路数字", speed: "—", pins: r.signals.map(function (s) { return s.pin; }).join(" / "), note: (RECIPE[m.id] || {}).note || "推挽输出 / 上拉输入" });
      }
    });
    return out;
  }

  /* ---------- 软件包定价 ---------- */
  var TIERS = [
    { id: "basic", name: "BSP 基础包", price: (M.SW_PRICE && M.SW_PRICE.basic) || 0, lead: "随硬件免费",
      feats: ["板级支持包（引脚宏 + 总线初始化）", "每个模块的驱动骨架", "I2C 自检与串口日志", "引脚分配表 + 接线图"], days: "即时" },
    { id: "pro", name: "驱动完整包", price: (M.SW_PRICE && M.SW_PRICE.pro) || 68, lead: "推荐",
      feats: ["全部驱动补全到可读写工程量", "联动逻辑实现（含阈值与迟滞）", "MicroPython + C 双版本", "上电自检脚本 + 排障清单"], days: "1 天" },
    { id: "cloud", name: "云端对接包", price: (M.SW_PRICE && M.SW_PRICE.cloud) || 168, lead: "联网必备",
      feats: ["MQTT / HTTP / Modbus 三套协议", "设备影子 + 指令下发", "OTA 升级通道", "数据看板模板（可选）"], days: "2 天" },
    { id: "ent", name: "定制交付", price: (M.SW_PRICE && M.SW_PRICE.ent) || 980, lead: "量产客户",
      feats: ["私有协议逆向与实现", "实时性调优（中断 / DMA / 双核）", "产线烧录与测试工装脚本", "4 次远程联调 + 源码交付"], days: "5 天" }
  ];

  function quote(plan, tier) {
    var t = TIERS.filter(function (x) { return x.id === (tier || "pro"); })[0] || TIERS[1];
    var nDrv = (plan.alloc ? plan.alloc.rows : []).filter(function (r) { return recipeOf(r.mod).cls !== "none"; }).length;
    return { tier: t.id, name: t.name, price: t.price, days: t.days, drivers: nDrv,
      note: t.price === 0 ? "已含在硬件价内" : "按 " + nDrv + " 个驱动 + " + protocols(plan).length + " 条协议链路报价" };
  }

  /* ---------- 打包成文件树 ---------- */
  function files(plan) {
    var b = buses(plan);
    var links = linkages(plan);
    var list = [];
    function add(path, lang, body) {
      list.push({ path: path, lang: lang, body: body, lines: body.split("\n").length - 1 });
    }
    add("firmware/bsp_board.py", "python", pyBoard(plan, b));
    add("firmware/main.py", "python", pyMain(plan, b, links));
    add("firmware/linkage.py", "python", pyLinkage(plan, links));
    (plan.alloc ? plan.alloc.rows : []).forEach(function (r) {
      var R = recipeOf(r.mod);
      if (R.cls === "none") return;
      add("firmware/drivers/" + r.mod.id + ".py", "python", pyDriver(r.mod, R, r));
    });
    add("proto/proto_mqtt.py", "python", mqttCode(plan, links));
    add("proto/proto_http.py", "python", httpCode(plan));
    add("proto/proto_modbus.py", "python", modbusCode(plan));
    add("include/bsp_board.h", "c", cBoard(plan, b));
    add("src/bsp_bus.c", "c", cBus(plan, b));
    (plan.alloc ? plan.alloc.rows : []).forEach(function (r) {
      var R = recipeOf(r.mod);
      if (R.cls === "none" || R.cls === "oled" || R.cls === "lcd" || R.cls === "spi_display") return;
      add("src/drv_" + r.mod.id + ".c", "c", cDriver(r.mod, R, r));
      add("include/drv_" + r.mod.id + ".h", "c", cDriverHeader(r.mod, R));
    });
    add("platformio.ini", "ini", platformio(plan, b));
    list.unshift({ path: "README.md", lang: "md", body: readme(plan, b, list), lines: 0 });
    list[0].lines = list[0].body.split("\n").length - 1;
    return list;
  }

  /* ---------- 渲染 ---------- */
  var selFile = null;

  function codeViewHtml(f) {
    if (!f) return "";
    return '<div class="code-head"><span class="mono">' + esc(f.path) + '</span>' +
      '<span class="code-meta mono">' + f.lang.toUpperCase() + " · " + f.lines + ' 行</span>' +
      '<button class="btn btn-ghost btn-sm" data-act="code-copy" data-path="' + esc(f.path) + '">复制</button>' +
      '<button class="btn btn-line btn-sm" data-act="code-dl" data-path="' + esc(f.path) + '">下载</button></div>' +
      '<pre class="code-body" data-path="' + esc(f.path) + '"><code>' + esc(f.body) + "</code></pre>";
  }

  function view(plan) {
    if (!plan.board) {
      return '<section class="panel plan-span"><div class="panel-head"><h3>软件方案</h3></div>' +
        '<div class="panel-body"><p class="wiring-cap">选好基座后，这里会生成 BSP、驱动、联动与协议代码。</p></div></section>';
    }
    var fl = files(plan);
    var links = linkages(plan);
    var prots = protocols(plan);
    var q = quote(plan, M.ui.sw || "pro");
    var totalLines = fl.reduce(function (a, f) { return a + f.lines; }, 0);
    var drvCount = fl.filter(function (f) { return /drivers\/|drv_/.test(f.path) && /\.py$/.test(f.path); }).length;
    if (!selFile || !fl.some(function (f) { return f.path === selFile; })) selFile = fl[0].path;
    var cur = fl.filter(function (f) { return f.path === selFile; })[0] || fl[0];

    var tree = fl.map(function (f) {
      return '<button class="code-file' + (f.path === cur.path ? " is-on" : "") + '" data-act="code-file" data-path="' + esc(f.path) + '">' +
        '<i>' + (/\.py$/.test(f.path) ? "PY" : /\.(c|h)$/.test(f.path) ? "C" : /\.ini$/.test(f.path) ? "CFG" : "MD") + "</i>" +
        "<span>" + esc(f.path.replace(/^firmware\/|^src\/|^include\//, "")) + "</span>" +
        '<b class="mono">' + f.lines + "</b></button>";
    }).join("");

    var linkRows = links.length ? links.map(function (k) {
      return "<tr><td>" + esc(k.title) + "</td><td class=\"mono\">" + esc(k.sensorName) + " → " + esc(k.actorName) + "</td>" +
        '<td class="mono">' + esc(k.cond) + "</td><td class=\"mono\">" + esc(k.act) + "</td></tr>";
    }).join("") : '<tr><td colspan="4" class="code-empty">当前选型没有可配对的「传感器 + 执行器」，加一个传感器和执行器就会出现联动规则。</td></tr>';

    var protoRows = prots.map(function (p) {
      return "<tr><td><b>" + esc(p.kind) + "</b></td><td>" + esc(p.dev) + "</td><td>" + esc(p.detail) + "</td>" +
        '<td class="mono">' + esc(p.speed) + '</td><td class="mono">' + esc(p.pins) + "</td><td>" + esc(p.note) + "</td></tr>";
    }).join("");

    var tierCards = TIERS.map(function (t) {
      return '<button class="sw-card' + (t.id === q.tier ? " is-on" : "") + '" data-act="sw" data-id="' + t.id + '">' +
        '<div class="sw-top"><span class="sw-name">' + esc(t.name) + "</span>" +
        (t.lead ? '<span class="sw-lead">' + esc(t.lead) + "</span>" : "") + "</div>" +
        '<div class="sw-price">' + (t.price === 0 ? "¥0" : M.fmtMoney(t.price)) + "</div>" +
        '<ul class="sw-feats">' + t.feats.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>" +
        '<div class="sw-days mono">交付 ' + esc(t.days) + "</div></button>";
    }).join("");

    return '<section class="panel plan-span"><div class="panel-head"><h3>软件方案 · BSP / 驱动 / 联动 / 协议</h3>' +
      '<button class="btn btn-line btn-sm" data-act="code-dlall">导出全部</button>' +
      '<span class="mono">' + fl.length + " FILES · " + totalLines + " LOC</span></div>" +
      '<div class="panel-body">' +

      '<div class="kv-grid" style="margin-bottom:14px">' +
      '<div class="kv-cell"><span>生成文件</span><b>' + fl.length + "</b></div>" +
      '<div class="kv-cell"><span>代码行数</span><b>' + totalLines + "</b></div>" +
      '<div class="kv-cell"><span>驱动</span><b>' + drvCount + "</b></div>" +
      '<div class="kv-cell"><span>协议链路</span><b>' + prots.length + "</b></div>" +
      '<div class="kv-cell"><span>联动规则</span><b>' + links.length + "</b></div>" +
      "</div>" +

      '<div class="code-wrap"><div class="code-tree">' + tree + "</div>" +
      '<div class="code-pane" id="code-pane">' + codeViewHtml(cur) + "</div></div>" +

      '<p class="wiring-cap">代码不是模板占位：<b>引脚宏来自真实分配结果</b>，I2C 地址取自器件数据，联动规则由「传感器 × 执行器」自动配对。' +
      "MicroPython 版可直接烧录运行，C 版为 ESP-IDF 骨架。</p>" +

      '<h4 class="sub-h">联动规则</h4><div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      "<th>场景</th><th>数据流</th><th>触发条件</th><th>动作</th></tr></thead><tbody>" + linkRows + "</tbody></table></div>" +

      '<h4 class="sub-h">协议与总线</h4><div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      "<th>总线</th><th>设备</th><th>协议细节</th><th class=\"num\">速率</th><th>引脚</th><th>要点</th></tr></thead><tbody>" +
      protoRows + "</tbody></table></div>" +

      '<h4 class="sub-h">软件包 · 与硬件分开卖</h4>' +
      '<div class="sw-grid">' + tierCards + "</div>" +
      '<div class="sw-sum"><span>当前选择</span><b>' + esc(q.name) + "</b>" +
      '<span class="mono">' + q.note + "</span>" +
      '<b class="sw-total">' + (q.price === 0 ? "¥0" : M.fmtMoney(q.price)) + "</b></div>" +

      "</div></section>";
  }

  window.MODBAY_CODE = {
    files: files, protocols: protocols, linkages: linkages, quote: quote, view: view,
    paneHtml: codeViewHtml,
    tiers: TIERS, recipeOf: recipeOf, buses: buses,
    setFile: function (p) { selFile = p; },
    getFile: function () { return selFile; }
  };
})();
