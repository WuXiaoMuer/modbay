/* MODBAY - 基座（主控板）数据
 * supply3v3 / supply5v / supplyExt 单位 mA，指板载稳压可从相应轨提供的最大电流（经验值，用于预算估算）
 * logic: 主控 IO 电平
 * buses.i2c / spi / uart: 数量与固定引脚
 */
window.MODBAY_BOARDS = [
  {
    id: "esp32s3", cat: "board", name: "ESP32-S3 DevKitC-1", brand: "Espressif", price: 48,
    logic: "3.3V", gpio: 23, supply3v3: 600, supply5v: 500, supplyExt: 0,
    pins: ["GPIO2","GPIO3","GPIO4","GPIO5","GPIO6","GPIO7","GPIO8","GPIO9","GPIO10","GPIO11","GPIO12","GPIO13","GPIO14","GPIO21","GPIO38","GPIO39","GPIO40","GPIO41","GPIO42","GPIO45","GPIO46","GPIO47","GPIO48"],
    buses: {
      i2c: [{ sda: "GPIO41", scl: "GPIO42" }, { sda: "GPIO17", scl: "GPIO18" }],
      spi: [{ sck: "GPIO36", mosi: "GPIO35", miso: "GPIO37" }, { sck: "GPIO12", mosi: "GPIO11", miso: "GPIO13" }],
      uart: [{ tx: "GPIO17", rx: "GPIO16" }, { tx: "GPIO43", rx: "GPIO44" }]
    },
    desc: "双核 Xtensa LX7 + 向量/神经网络指令，Wi-Fi/BLE 5，AI 场景性价比之选。",
    specs: [["主频", "240 MHz 双核"], ["无线", "Wi-Fi 4 + BLE 5"], ["Flash/PSRAM", "512KB + 可扩展"], ["USB", "USB-OTG"]],
    tags: ["WiFi", "BLE", "AI"]
  },
  {
    id: "stm32f103", cat: "board", name: "STM32F103C8T6 蓝药丸", brand: "ST", price: 18,
    logic: "3.3V", gpio: 24, supply3v3: 300, supply5v: 0, supplyExt: 0,
    pins: ["PA0","PA1","PA2","PA3","PA4","PA5","PA6","PA7","PA8","PA9","PA10","PA15","PB0","PB1","PB2","PB3","PB4","PB5","PB6","PB7","PB8","PB9","PB10","PB11"],
    buses: {
      i2c: [{ sda: "PB7", scl: "PB6" }, { sda: "PB11", scl: "PB10" }],
      spi: [{ sck: "PA5", mosi: "PA7", miso: "PA6" }, { sck: "PB13", mosi: "PB15", miso: "PB14" }],
      uart: [{ tx: "PA9", rx: "PA10" }]
    },
    desc: "72MHz Cortex-M3，工业常青树。注意：板载仅 3.3V LDO，无 5V 引脚供电。",
    specs: [["主频", "72 MHz Cortex-M3"], ["Flash", "64KB"], ["IO 电平", "3.3V"], ["供电", "3.3V 输出，无 5V 轨"]],
    tags: ["工业", "低功耗", "便宜"]
  },
  {
    id: "rp2040", cat: "board", name: "RP2040 Zero", brand: "Raspberry Pi", price: 25,
    logic: "3.3V", gpio: 20, supply3v3: 500, supply5v: 0, supplyExt: 0,
    pins: ["GP0","GP1","GP2","GP3","GP4","GP5","GP6","GP7","GP8","GP9","GP10","GP11","GP12","GP13","GP14","GP15","GP16","GP26","GP27","GP28"],
    buses: {
      i2c: [{ sda: "GP4", scl: "GP5" }, { sda: "GP6", scl: "GP7" }],
      spi: [{ sck: "GP18", mosi: "GP19", miso: "GP16" }, { sck: "GP14", mosi: "GP15", miso: "GP12" }],
      uart: [{ tx: "GP0", rx: "GP1" }, { tx: "GP8", rx: "GP9" }]
    },
    desc: "双核 M0+ + PIO 可编程 IO，状态机驱动各种怪协议，极客快乐板。",
    specs: [["主频", "133 MHz 双核 M0+"], ["特色", "PIO×2"], ["ADC", "12bit × 4"], ["Flash", "可外接 W25Q"]],
    tags: ["PIO", "双核", "极客"]
  },
  {
    id: "uno", cat: "board", name: "Arduino UNO R3", brand: "Arduino", price: 65,
    logic: "5V", gpio: 18, supply3v3: 50, supply5v: 400, supplyExt: 0,
    pins: ["D2","D3","D4","D5","D6","D7","D8","D9","D10","D11","D12","D13","A0","A1","A2","A3","A4","A5"],
    buses: {
      i2c: [{ sda: "A4", scl: "A5" }],
      spi: [{ sck: "D13", mosi: "D11", miso: "D12" }],
      uart: [{ tx: "D0", rx: "D1" }]
    },
    desc: "16MHz AVR，生态教科书。IO 原生 5V，老传感器朋友多，接 3.3V 独供模块要当心电平。",
    specs: [["主频", "16 MHz AVR"], ["IO 电平", "5V"], ["IO 数", "14 数字 + 6 模拟"], ["生态", "最大教程量"]],
    tags: ["5V", "生态", "教学"]
  },
  {
    id: "picow", cat: "board", name: "树莓派 Pico W", brand: "Raspberry Pi", price: 55,
    logic: "3.3V", gpio: 20, supply3v3: 300, supply5v: 0, supplyExt: 0,
    pins: ["GP0","GP1","GP2","GP3","GP4","GP5","GP6","GP7","GP8","GP9","GP10","GP11","GP12","GP13","GP14","GP15","GP16","GP26","GP27","GP28"],
    buses: {
      i2c: [{ sda: "GP4", scl: "GP5" }, { sda: "GP6", scl: "GP7" }],
      spi: [{ sck: "GP18", mosi: "GP19", miso: "GP16" }, { sck: "GP14", mosi: "GP15", miso: "GP12" }],
      uart: [{ tx: "GP0", rx: "GP1" }, { tx: "GP8", rx: "GP9" }]
    },
    desc: "RP2040 + Infineon CYW43439 无线，官方 SDK/MicroPython 双修，文档全。",
    specs: [["主频", "133 MHz 双核 M0+"], ["无线", "Wi-Fi 4 + BLE 5.2"], ["特色", "PIO×2"], ["社区", "官方 SDK 活跃"]],
    tags: ["WiFi", "PIO", "文档全"]
  },
  {
    id: "nrf52840", cat: "board", name: "Seeed XIAO nRF52840", brand: "Seeed", price: 78,
    logic: "3.3V", gpio: 11, supply3v3: 200, supply5v: 0, supplyExt: 0,
    pins: ["P0.02","P0.03","P0.04","P0.05","P0.09","P0.10","P0.11","P0.12","P0.13","P0.14","P0.15"],
    buses: {
      i2c: [{ sda: "P0.05", scl: "P0.04" }],
      spi: [{ sck: "P0.15", mosi: "P0.13", miso: "P0.14" }],
      uart: [{ tx: "P0.12", rx: "P0.11" }]
    },
    desc: "BLE 5.0 NFC，邮票尺寸。引脚少而精，适合蓝牙传感器节点。",
    specs: [["无线", "BLE 5.0 + NFC"], ["尺寸", "21×17.5mm"], ["IO", "11 个可用"], ["功耗", "μA 级休眠"]],
    tags: ["BLE", "NFC", "小巧"]
  },
  {
    id: "k210", cat: "board", name: "嘉楠 K210 MAIX Dock", brand: "Canaan", price: 39,
    logic: "3.3V", gpio: 22, supply3v3: 400, supply5v: 300, supplyExt: 0,
    pins: ["IO6","IO7","IO8","IO9","IO10","IO11","IO12","IO13","IO14","IO15","IO16","IO17","IO18","IO19","IO20","IO21","IO22","IO23","IO24","IO25","IO26","IO27"],
    buses: {
      i2c: [{ sda: "IO28", scl: "IO29" }, { sda: "IO30", scl: "IO31" }],
      spi: [{ sck: "IO25", mosi: "IO27", miso: "IO26" }],
      uart: [{ tx: "IO6", rx: "IO7" }]
    },
    desc: "带 KPU 的 RISC-V 双核，0.8TOPS 算力跑端侧视觉，国产 AI 老将。",
    specs: [["主频", "400 MHz 双核 RISC-V"], ["算力", "KPU 0.8TOPS"], ["IO", "22 个可用"], ["定位", "端侧视觉 AI"]],
    tags: ["KPU", "视觉AI", "国产"]
  }
];
