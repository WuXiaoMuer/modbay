/* MODBAY - 预设方案（一键载入配置台） */
window.MODBAY_PRESETS = [
  { id: "wx", name: "桌面气象站", icon: "cloud", board: "esp32s3",
    items: { bmp280: 1, sht30: 1, oled096: 1 },
    story: "Wi-Fi 上报气压/温湿度，OLED 本地显示。I2C 一条总线挂三兄弟，最经典的入门组合。" },
  { id: "bot", name: "双轴桌面机械臂", icon: "arm", board: "rp2040",
    items: { sg90: 2, ws2812: 1, encoder: 1, oled096: 1, lipo: 1 },
    story: "编码器 + 舵机闭环控制，PIO 跑 WS2812 灯效。5V 电机轨由 18650 升压板提供，RP2040 只出逻辑。" },
  { id: "car", name: "循迹避障小车", icon: "car", board: "uno",
    items: { tb6612: 1, tt: 1, hcsr04: 1, lcd1602: 1, lipo: 1 },
    story: "UNO 原生 5V 带 TB6612，超声波测距 + 字符屏显示；电机由 18650 升压板独供，USB 只供逻辑。" },
  { id: "lora", name: "LoRa 野外监测节点", icon: "signal", board: "picow",
    items: { dht22: 1, bmp280: 1, lora: 1, tfcard: 1 },
    story: "太阳能供电，本地 TF 卡记录 + LoRa 远传。低功耗节点周期性唤醒上报。" }
];
