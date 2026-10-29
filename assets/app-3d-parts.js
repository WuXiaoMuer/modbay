/* ============ MODBAY 3D 零件库：几何元语 + 电子元件建模 ============
 * 元语：box（长方体）/ cyl（正 n 棱柱，用于电容、电机、电池、天线、安装孔）
 * 每个零件：{t:'box'|'cyl', x,y,z, w,h,d 或 r,h, seg, c(颜色), g(高光), mod(归属模块 id)}
 */
(function () {
  "use strict";

  var C = {
    pcbBlack: "#1b1f26", pcbBlue: "#12365e", pcbGreen: "#12564b", pcbRed: "#6b2320",
    chip: "#23272e", chipTop: "#3a4048", silver: "#b9c0c8", silverDark: "#8b939c",
    gold: "#c9a86a", glass: "#0b1a2e", glassLit: "#1b3f6b", white: "#e8ecef",
    termGreen: "#2f7d4f", termBlue: "#26527d", ledRed: "#ff6b5e", ledGreen: "#6ee7a0",
    copper: "#a9713a", battery: "#2b6cb0", dark: "#14171c"
  };

  function box(x, y, z, w, h, d, c, mod, gloss) {
    return { t: "box", x: x, y: y, z: z, w: w, h: h, d: d, c: c, mod: mod, g: gloss || 0 };
  }
  function cyl(x, y, z, r, h, c, mod, seg, gloss, ax) {
    return { t: "cyl", x: x, y: y, z: z, r: r, h: h, c: c, mod: mod, seg: seg || 12, g: gloss || 0, ax: ax || "y" };
  }

  /* ---------- 通用件 ---------- */
  /* PCB 板：主体 + 四角安装孔 */
  function pcb(px, py, pz, w, d, c, mod, holes) {
    var h = 1.6, out = [box(px, py, pz, w, h, d, c || C.pcbBlack, mod)];
    if (holes !== false) {
      var ox = w / 2 - 1.6, oz = d / 2 - 1.6, i;
      for (i = 0; i < 4; i++) {
        out.push(cyl(px + (i % 2 ? ox : -ox), py + h / 2 - 0.2, pz + (i < 2 ? -oz : oz), 0.9, 0.7, C.dark, mod, 8));
      }
    }
    return out;
  }
  /* 排针：n 针，沿 X 排布在指定边 */
  function header(px, py, pz, n, w, side, mod, color) {
    var out = [], step = 2.54, x0 = px - (n - 1) * step / 2, z = pz + side * (w / 2 - 1.4);
    out.push(box(px, py + 0.6, z, (n - 1) * step + 2.4, 1.2, 2.6, "#1a1e24", mod));       /* 塑料基座 */
    for (var i = 0; i < n; i++) out.push(box(x0 + i * step, py + 1.5, z, 0.64, 2.6, 0.64, color || C.gold, mod));
    return out;
  }
  /* IC 芯片：本体 + 两侧引脚 + 一脚圆点 */
  function ic(px, py, pz, w, d, h, mod, seg) {
    var out = [box(px, py, pz, w, h, d, C.chip, mod, 0.25), box(px, py + h / 2 + 0.01, pz, w * 0.82, 0.2, d * 0.82, C.chipTop, mod, 0.2)];
    var n = Math.max(3, Math.round(w / 2.2)), step = w / (n + 1);
    for (var i = 0; i < n; i++) {
      out.push(box(px - w / 2 + step * (i + 1), py, pz - d / 2 - 0.5, 0.5, 0.25, 1, C.silver, mod));
      out.push(box(px - w / 2 + step * (i + 1), py, pz + d / 2 + 0.5, 0.5, 0.25, 1, C.silver, mod));
    }
    out.push(cyl(px - w / 2 + 1.4, py + h / 2 + 0.15, pz - d / 2 + 1.4, 0.42, 0.3, C.white, mod, 8));
    return out;
  }
  /* 电解电容（铝壳圆柱 + 顶部十字） */
  function cap(px, py, pz, r, h, mod) {
    return [cyl(px, py + h / 2, pz, r, h, C.silverDark, mod, 12, 0.15),
      cyl(px, py + h + 0.12, pz, r * 0.82, 0.25, C.silver, mod, 12, 0.5),
      box(px, py + h + 0.28, pz, r * 1.3, 0.12, 0.5, C.dark, mod),
      box(px, py + h + 0.28, pz, 0.5, 0.12, r * 1.3, C.dark, mod)];
  }
  /* 贴片阻容 */
  function smd(px, py, pz, mod, color) {
    return [box(px, py + 0.25, pz, 1.6, 0.5, 0.8, color || "#2c323a", mod), box(px, py + 0.52, pz, 1.2, 0.1, 0.6, "#4a5058", mod)];
  }
  /* 电感（方块 + 顶部线圈感） */
  function inductor(px, py, pz, mod) {
    return [box(px, py + 1.3, pz, 6.4, 2.6, 6.4, "#3a3f46", mod, 0.2), box(px, py + 2.7, pz, 5.4, 0.3, 5.4, C.copper, mod, 0.3)];
  }
  /* 接线端子（绿/蓝 + 银螺丝） */
  function terminal(px, py, pz, n, mod, color) {
    var out = [box(px, py + 2.2, pz, n * 5 + 2, 4.4, 6, color || C.termGreen, mod)];
    for (var i = 0; i < n; i++) out.push(cyl(px - (n - 1) * 2.5 + i * 5, py + 4.5, pz, 1.7, 0.7, C.silver, mod, 10, 0.6));
    return out;
  }
  /* 散热片：一排薄鳍 */
  function heatsink(px, py, pz, w, mod) {
    var n = Math.max(4, Math.round(w / 2.2)), out = [box(px, py + 0.8, pz, w, 1.6, 5, C.silverDark, mod, 0.2)], step = w / n;
    for (var i = 0; i < n; i++) out.push(box(px - w / 2 + step * (i + 0.5), py + 3.6, pz, step * 0.42, 5.2, 5, C.silver, mod, 0.35));
    return out;
  }
  /* 按键 */
  function button(px, py, pz, mod) {
    return [cyl(px, py + 0.9, pz, 1.6, 1.8, C.dark, mod, 10), cyl(px, py + 1.9, pz, 1.2, 0.4, C.silver, mod, 10, 0.5)];
  }
  /* LED */
  function led(px, py, pz, mod, color) {
    return [box(px, py + 0.5, pz, 1.4, 1, 1.4, color || C.ledGreen, mod, 0.6)];
  }
  /* USB-C 母座 */
  function usbC(px, py, pz, side, mod) {
    var z = pz + side * 1;
    return [box(px, py + 1.6, z, 9, 3.2, 7.4, C.silver, mod, 0.3),
      box(px, py + 1.6, z + side * 3.9, 7.4, 2.2, 0.4, "#4a5058", mod)];
  }
  /* 天线：立式线圈（叠环） */
  function coilAntenna(px, py, pz, mod) {
    var out = [cyl(px, py + 1.2, pz, 0.5, 2.4, C.gold, mod, 8)];
    for (var i = 0; i < 5; i++) out.push(cyl(px, py + 3 + i * 1.5, pz, 1.9, 0.5, C.copper, mod, 12, 0.3));
    out.push(cyl(px, py + 10.6, pz, 0.5, 1.4, C.gold, mod, 8));
    return out;
  }
  /* 陶瓷贴片天线 */
  function patchAntenna(px, py, pz, mod) {
    return [box(px, py + 0.8, pz, 16, 1.6, 16, C.white, mod, 0.15), box(px, py + 1.7, pz, 14.4, 0.3, 14.4, "#cfd6dc", mod, 0.25)];
  }
  /* 屏：黑边框 + 玻璃 + FPC 排线 */
  function screen(px, py, pz, w, d, mod) {
    var out = [box(px, py, pz, w + 2, 1.6, d + 2, C.pcbBlack, mod)];
    out.push(box(px, py + 1.1, pz, w, 1.2, d, C.glass, mod, 0.15));
    out.push(box(px, py + 1.75, pz, w * 0.96, 0.16, d * 0.96, C.glassLit, mod, 0.85));
    out.push(box(px, py + 0.6, pz + d / 2 + 2.2, w * 0.5, 0.3, 3.4, C.copper, mod));   /* FPC */
    return out;
  }
  /* 舵机：本体 + 输出轴 + 舵盘 + 出线 */
  function servo(px, py, pz, mod) {
    var out = [box(px, py + 10, pz, 23, 20, 12.2, "#2b3038", mod, 0.2),
      box(px, py + 20.2, pz - 3.5, 23, 0.6, 5, "#3a4048", mod),
      cyl(px + 6, py + 20.6, pz, 2.6, 3, C.silver, mod, 12, 0.5),
      box(px + 9, py + 23.4, pz, 8, 1.2, 3, C.white, mod),      /* 舵盘 */
      cyl(px + 15, py + 23.4, pz, 1, 1.6, C.silver, mod, 10, 0.4)];
    for (var i = 0; i < 3; i++) out.push(box(px - 8 + i * 1.4, py + 1.2, pz + 8.4, 0.9, 2.4, 6, i === 0 ? C.ledRed : (i === 1 ? C.dark : "#e0a13a"), mod));
    return out;
  }
  /* 圆柱电机：机身 + 转轴 + 端盖 */
  /* 直流减速电机（TT 马达）：齿轮箱 + 横卧电机筒 + 输出轴 + 车轮，像真实件 */
  function motor(px, py, pz, r, h, mod, shaft) {
    var cy = py + r * 0.72, out = [];
    out.push(box(px, cy - r * 0.06, pz - h / 2 + 3.4, r * 1.34, r * 1.34, 6.8, "#8a9099", mod, 0.3)); /* 齿轮箱 */
    out.push(cyl(px, cy, pz + 1.4, r * 0.74, h, "#9aa2ab", mod, 16, 0.42, "z"));                     /* 电机筒 */
    out.push(cyl(px, cy, pz + h / 2 + 0.7, r * 0.76, 1.4, "#6f7680", mod, 16, 0.3, "z"));            /* 尾盖 */
    if (shaft !== false) {
      out.push(cyl(px, cy, pz - h / 2 - 2, 0.85, 4.6, C.silver, mod, 10, 0.6, "z"));                 /* 输出轴 */
      out.push(cyl(px, cy, pz - h / 2 - 5.2, r * 0.95, 2.2, "#2b2f36", mod, 18, 0.15, "z"));         /* 车轮 */
      out.push(cyl(px, cy, pz - h / 2 - 6.5, r * 0.42, 0.9, C.gold, mod, 12, 0.5, "z"));
    }
    out.push(box(px - r * 0.52, cy + r * 0.78, pz + h / 2 - 3, 3.2, 1.2, 4.4, C.termBlue, mod));      /* 接线端子 */
    return out;
  }
  /* 18650 电芯（平躺在板面/地面，轴向沿 Z） */
  function battery(px, py, pz, mod) {
    var r = 9.2, len = 40, cy = py + r;
    return [cyl(px, cy, pz, r, len, C.battery, mod, 16, 0.3, "z"),
      cyl(px, cy, pz + len / 2, r, 0.8, "#1d4e80", mod, 16, 0.2, "z"),
      cyl(px, cy, pz - len / 2, r, 0.8, "#1d4e80", mod, 16, 0.2, "z"),
      cyl(px, cy, pz + len / 2 + 1.5, 3.4, 2.2, C.silver, mod, 12, 0.6, "z"),
      box(px, cy + r - 0.6, pz - len / 4, 13, 0.6, 9, "#2f6fb8", mod, 0.15)];
  }
  /* 太阳能板：玻璃面 + 电池片栅格 */
  function solarPanel(px, py, pz, mod) {
    var out = [box(px, py + 1.2, pz, 44, 2.4, 32, "#1a2b3d", mod, 0.2)];
    for (var i = 1; i < 4; i++) out.push(box(px - 22 + i * 11, py + 2.5, pz, 0.5, 0.1, 31, C.silver, mod));
    for (var j = 1; j < 3; j++) out.push(box(px, py + 2.5, pz - 16 + j * 10.6, 43, 0.1, 0.5, C.silver, mod));
    out.push(box(px, py + 2.5, pz, 43, 0.12, 31, "#24507a", mod, 0.55));
    return out;
  }

  window.MODBAY_3D_PARTS = {
    C: C, box: box, cyl: cyl, pcb: pcb, header: header, ic: ic, cap: cap, smd: smd,
    inductor: inductor, terminal: terminal, heatsink: heatsink, button: button, led: led,
    usbC: usbC, coilAntenna: coilAntenna, patchAntenna: patchAntenna, screen: screen,
    servo: servo, motor: motor, battery: battery, solarPanel: solarPanel
  };
})();
