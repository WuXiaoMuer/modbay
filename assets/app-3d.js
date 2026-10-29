/* ============ MODBAY 3D 装配预览（自研 SVG 软渲染，零依赖） ============
 * 元语：box / cyl(n 棱柱) → 旋转矩阵 → 正交投影 → 背面剔除 → Lambert+高光着色 → 画家算法 → SVG
 * 交互：拖拽旋转 / 滚轮缩放 / 自动旋转 / 点击模块高亮 / 重置视角
 */
(function () {
  "use strict";
  var M = window.M, P = window.MODBAY_3D_PARTS, SC = window.MODBAY_3D_SCENE, C = P.C;
  var VW = 1340, VH = 560;
  var BOARD_H = 2.4, BOARD_TOP = BOARD_H / 2, GROUND = -1.8;   /* 底板厚度 / 顶面 / 地面（板长宽由内容决定） */
  var LIGHT = (function () { var v = [-0.38, 0.86, 0.5], n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; })();
  var HALF = (function () { var v = [LIGHT[0], LIGHT[1], LIGHT[2] + 1], n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; })();

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    var g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    var b = Math.min(255, Math.round((n & 255) * f));
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function rot(p, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var x1 = p[0] * cy - p[2] * sy, z1 = p[0] * sy + p[2] * cy, y1 = p[1];
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [x1, y1 * cp - z1 * sp, y1 * sp + z1 * cp];
  }
  function bright(nrm, gloss, rn) {
    var d = nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2];
    var spec = gloss ? Math.pow(Math.max(0, nrm[0] * HALF[0] + nrm[1] * HALF[1] + nrm[2] * HALF[2]), 18) * gloss * 0.9 : 0;
    return 0.3 + 0.82 * Math.max(0, d) + spec + rn[2] * 0.08;
  }
  function short(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  /* 零件库函数返回数组，push 会产生嵌套 → 统一递归扁平化 */
  function flatten(a) {
    var out = [];
    a.forEach(function (x) {
      if (Array.isArray(x)) out = out.concat(flatten(x));
      else if (x && x.t) out.push(x);
    });
    return out;
  }

  /* 模块整体缩放：让零件比例与基座协调（1 单位 ≈ 1mm，模块相对开发板本就小巧） */
  function scaleParts(list, px, py, pz, k) {
    return list.map(function (p) {
      return { t: p.t, c: p.c, mod: p.mod, g: p.g,
        x: px + (p.x - px) * k, y: py + (p.y - py) * k, z: pz + (p.z - pz) * k,
        w: (p.w || 0) * k, h: p.h * k, d: (p.d || 0) * k, r: (p.r || 0) * k, seg: p.seg };
    });
  }
  /* 半尺寸（考虑圆柱轴向） */
  function half(p) {
    if (p.t === "box") return [(p.w || 0) / 2, p.h / 2, (p.d || 0) / 2];
    var r = p.r || 0, h = p.h / 2, ax = p.ax || "y";
    return ax === "z" ? [r, r, h] : ax === "x" ? [h, r, r] : [r, h, r];
  }
  /* 量测模块真实包围盒（配方实际画出的范围，而非类目估算） */
  function measure(raw) {
    var b = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, minZ: 1e9, maxZ: -1e9 };
    raw.forEach(function (p) {
      var e = half(p);
      b.minX = Math.min(b.minX, p.x - e[0]); b.maxX = Math.max(b.maxX, p.x + e[0]);
      b.minY = Math.min(b.minY, p.y - e[1]); b.maxY = Math.max(b.maxY, p.y + e[1]);
      b.minZ = Math.min(b.minZ, p.z - e[2]); b.maxZ = Math.max(b.maxZ, p.z + e[2]);
    });
    return b;
  }
  /* 以包围盒中心为基准建模 → 缩放 → 平移落位（bbox 底面贴到 baseY） */
  function placeModule(mod, detail, k, px, baseY, pz) {
    var raw = SC.moduleParts(mod, 0, 0, 0, detail);
    var b = measure(raw);
    var mx = (b.minX + b.maxX) / 2, mz = (b.minZ + b.maxZ) / 2;   /* 配方未必居中，先归中 */
    var list = raw.map(function (p) {
      return { t: p.t, c: p.c, mod: p.mod, g: p.g, ax: p.ax,
        x: (p.x - mx) * k, y: p.y * k, z: (p.z - mz) * k,
        w: (p.w || 0) * k, h: p.h * k, d: (p.d || 0) * k, r: (p.r || 0) * k, seg: p.seg };
    });
    var dy = baseY - b.minY * k;
    list.forEach(function (p) { p.x += px; p.y += dy; p.z += pz; });
    return { parts: list, w: (b.maxX - b.minX) * k, d: (b.maxZ - b.minZ) * k, h: (b.maxY - b.minY) * k };
  }

  /* ---------- 场景 ---------- */
  /* 布局分区：左端叠装核心板（屏蔽罩/USB-C/排针/LED），右侧为模块插装区，两者绝不重叠 */
  var CORE_W = 34, CORE_D = 24;   /* 左端核心板（ESP32 等）尺寸，固定 */

  function buildScene(plan) {
    var parts = [], labels = [], cables = [];
    /* 图层（ly）：0 底板 / 1 核心板与电源件 / 2 核心板元件 / 2.5 模块阴影 / 3 模块。
       画家算法对“大面片”不可靠（大板面中心会排到近处、盖掉远处模块），
       所以先按图层保证“容器先画、内容后画”，层内再按深度排序。 */
    function tag(list, ly) { list.forEach(function (p) { p.ly = ly; }); return list; }

    var items = plan.items.slice(0, 9);
    var detail = true;
    var onBoard = items.filter(function (it) { return it.mod.cat !== "power"; });
    var offBoard = items.filter(function (it) { return it.mod.cat === "power"; });
    var nBoard = onBoard.length;
    /* 模块越多缩得越小（保证一块板装得下） */
    var MOD_K = nBoard <= 3 ? 0.58 : nBoard <= 5 ? 0.54 : nBoard <= 7 ? 0.5 : 0.42;
    var gapX = 5, gapZ = 5, MAXW = 54;

    /* ---- 1) 先量模块、分行（每行最多 3 个，且各行数量尽量均衡） ---- */
    var probes = onBoard.map(function (it) {
      var pr = placeModule(it.mod, detail, MOD_K, 0, 0, 0);
      return { it: it, w: pr.w, d: pr.d };
    });
    var perRow = Math.max(1, Math.ceil(nBoard / Math.max(1, Math.ceil(nBoard / 3))));
    var rows = [], cur = { list: [], w: 0, d: 0 };
    probes.forEach(function (pr) {
      if (cur.list.length && (cur.list.length >= perRow || cur.w + pr.w > MAXW)) { rows.push(cur); cur = { list: [], w: 0, d: 0 }; }
      cur.list.push(pr);
      cur.w += pr.w + (cur.list.length > 1 ? gapX : 0);
      cur.d = Math.max(cur.d, pr.d);
    });
    if (cur.list.length) rows.push(cur);

    /* ---- 2) 板子尺寸由内容决定：核心板 + 模块区，四周各留边距 ---- */
    var areaW = rows.length ? Math.max.apply(null, rows.map(function (r) { return r.w; })) : 24;
    var areaD = rows.reduce(function (a, r) { return a + r.d; }, 0) + gapZ * Math.max(0, rows.length - 1);
    var PAD = 6;
    var boardW = Math.max(60, PAD + CORE_W + PAD + areaW + PAD);
    var boardD = Math.max(30, areaD + PAD * 2);
    var CORE_X = -boardW / 2 + PAD + CORE_W / 2;          /* 核心板贴左端 */
    var areaX0 = CORE_X + CORE_W / 2 + PAD;               /* 模块区左边界 */
    var areaX1 = boardW / 2 - PAD;

    /* ---- 3) 底板 ---- */
    parts = parts.concat(tag(P.pcb(0, 0, 0, boardW, boardD, C.pcbGreen, null), 0));

    /* ---- 4) 左端核心板（叠在底板上，像 shield 插核心板） ---- */
    var CORE_Y = BOARD_TOP + 0.8, CT = CORE_Y + 0.8;   /* CT = 核心板顶面 */
    parts = parts.concat(tag(P.pcb(CORE_X, CORE_Y, 0, CORE_W, CORE_D, C.pcbBlack, null), 1));
    var core = [];
    core.push(P.box(CORE_X - 4, CT + 1.6, 0, 19, 3.2, 14, C.chip, null));           /* 主控屏蔽罩 */
    core.push(P.box(CORE_X - 4, CT + 3.3, 0, 18, 0.4, 13, C.silverDark, null, 0.45)); /* 罩顶 */
    for (var i = 0; i < 6; i++) core.push(P.box(CORE_X - 12 + i * 2.6, CT + 0.5, 9, 1.2, 0.8, 1.2, C.gold, null)); /* 天线焊盘 */
    core.push(P.ic(CORE_X + 9, CT + 1.1, -8, 8, 6, 1.8, null));                     /* 稳压 IC */
    core = core.concat(P.cap(CORE_X + 9, CT, 6, 3, 5.5, null));
    core = core.concat(P.cap(CORE_X + 14, CT, 6, 2.4, 4.4, null));
    core = core.concat(P.led(CORE_X + 13.2, CT, 9.4, null, C.ledGreen));
    core = core.concat(P.led(CORE_X + 15.6, CT, 9.4, null, C.ledRed));
    core = core.concat(P.usbC(CORE_X + 3, CT, -CORE_D / 2 - 1.4, -1, null));       /* USB-C */
    core = core.concat(P.button(CORE_X + 11, CT, -CORE_D / 2 + 2.6, null));         /* RESET / BOOT */
    core = core.concat(P.button(CORE_X + 15, CT, -CORE_D / 2 + 2.6, null));
    core = core.concat(P.header(CORE_X, CT, CORE_D / 2 - 2, 13, 0, 0, null));       /* 双排针 */
    core = core.concat(P.header(CORE_X, CT, -CORE_D / 2 + 2, 13, 0, 0, null));
    parts = parts.concat(tag(core, 2));

    labels.push({ x: CORE_X, y: -4.2, z: boardD / 2 + 6, text: plan.board ? short(plan.board.name, 18) : "BASE BOARD", size: 10, color: "var(--ink)" });
    labels.push({ x: CORE_X - 13, y: CT + 1.2, z: CORE_D / 2 - 1.6, text: "3V3 GND", size: 6.5, color: "#9fb0aa" });
    labels.push({ x: areaX1 - 4, y: BOARD_TOP + 1.2, z: boardD / 2 - 3, text: "GPIO", size: 7, color: "var(--muted)" });

    /* ---- 5) 模块落位：行内水平居中，整块区域在板面垂直居中 ---- */
    var midX = (areaX0 + areaX1) / 2;
    var rowZ = -areaD / 2;
    rows.forEach(function (row) {
      var x = midX - row.w / 2;
      row.list.forEach(function (m) {
        var px = x + m.w / 2, pz = rowZ + row.d / 2;
        /* 排母底座：模块插在板上的插座里，而不是凭空浮着 */
        parts.push({ t: "box", x: px, y: BOARD_TOP + 0.45, z: pz, w: m.w * 0.88, h: 0.6, d: m.d * 0.88,
          c: "#0c2320", mod: null, g: 0, ly: 2.4 });
        var placed = placeModule(m.it.mod, detail, MOD_K, px, BOARD_TOP + 1.15, pz);
        parts = parts.concat(tag(placed.parts, 3));
        /* 接触阴影：模块投在板面上的影子，立体感的关键 */
        parts.push({ t: "box", x: px + 0.9, y: BOARD_TOP + 0.07, z: pz + 1, w: m.w * 0.98, h: 0.1, d: m.d * 0.98, c: "#05090a", mod: null, g: 0, o: 0.42, ly: 2.5 });
        x += m.w + gapX;
      });
      rowZ += row.d + gapZ;
    });

    /* ---- 6) 电源件落在地面、板子右侧（真实外挂件的样子），琥珀线缆入板 ---- */
    offBoard.forEach(function (it, i) {
      var pr = placeModule(it.mod, detail, MOD_K, 0, 0, 0);
      var px = boardW / 2 + 2.5 + pr.w / 2, pz = 0 + i * (pr.d + 3);
      var placed = placeModule(it.mod, detail, MOD_K, px, GROUND + 0.1, pz);
      parts = parts.concat(tag(placed.parts, 1));
      cables.push({ from: [px - pr.w / 2, GROUND + 1.5, pz], to: [boardW / 2 - 3, BOARD_TOP, 2] });
    });

    var fp = flatten(parts);
    return { parts: fp, bounds: measure(fp), points: cloud(fp), labels: labels, cables: cables,
      board: { w: boardW, d: boardD },
      legend: items.map(function (it) { return { name: it.mod.name, cat: it.mod.cat }; }),
      n: items.length, total: plan.items.length };
  }

  /* ---------- 渲染 ---------- */
  /* 顶点云：每个零件的 8 个角，用于精确取景（AABB 角点会被远处零件撑大） */
  function cloud(parts) {
    var pts = [];
    parts.forEach(function (p) {
      var e = half(p);
      for (var i = 0; i < 8; i++) pts.push([p.x + (i & 1 ? e[0] : -e[0]), p.y + (i & 2 ? e[1] : -e[1]), p.z + (i & 4 ? e[2] : -e[2])]);
    });
    return pts;
  }
  /* 自动取景：把顶点云投影后算缩放，保证整机都在视口内 */
  function fitScale(pts, yaw, pitch, W, H, pad) {
    var xs = [], ys = [];
    pts.forEach(function (p) {
      var r = rot(p, yaw, pitch);
      xs.push(r[0]); ys.push(r[1]);
    });
    var dx = Math.max.apply(null, xs) - Math.min.apply(null, xs) || 1;
    var dy = Math.max.apply(null, ys) - Math.min.apply(null, ys) || 1;
    return Math.min((W - pad * 2) / dx, (H - pad * 2) / dy);
  }
  /* 全周最坏取景：自动旋转一整圈都不溢出，且比例稳定不抽动 */
  var HERO = -0.54, SWAY = 0.28, PITCH = 0.74;   /* 主视角 / 摆幅 / 俯角 */
  function fitWorst(pts, pitch, W, H, pad) {
    var best = 1e9;
    for (var a = 0; a <= 12; a++) {
      var yaw = HERO - SWAY + a / 12 * SWAY * 2;
      best = Math.min(best, fitScale(pts, yaw, pitch, W, H, pad));
    }
    return best;
  }
  function render(scene, cam, W, H, hitId) {
    var pts = scene.points;
    var s = cam.fit * cam.zoom;
    /* 每帧重算画面中心，旋转时整机始终居中 */
    var bx = 1e9, bX = -1e9, by = 1e9, bY = -1e9;
    for (var i0 = 0; i0 < pts.length; i0++) {
      var rr = rot(pts[i0], cam.yaw, cam.pitch);
      if (rr[0] < bx) bx = rr[0]; if (rr[0] > bX) bX = rr[0];
      if (rr[1] < by) by = rr[1]; if (rr[1] > bY) bY = rr[1];
    }
    var cx = W / 2 - (bx + bX) / 2 * s, cy = H / 2 + (by + bY) / 2 * s;
    function proj(p) {
      var r = rot(p, cam.yaw, cam.pitch);
      return [cx + r[0] * s, cy - r[1] * s, r[2]];
    }
    var out = "", g = "", gx, gz;
    for (gx = -60; gx <= 60; gx += 15) {
      var a1 = proj([gx, GROUND, -45]), b1 = proj([gx, GROUND, 45]);
      g += '<path d="M' + a1[0].toFixed(0) + " " + a1[1].toFixed(0) + "L" + b1[0].toFixed(0) + " " + b1[1].toFixed(0) + '" stroke="var(--v3-grid)" stroke-width=".6" opacity=".16"/>';
    }
    for (gz = -45; gz <= 45; gz += 15) {
      var a2 = proj([-60, GROUND, gz]), b2 = proj([60, GROUND, gz]);
      g += '<path d="M' + a2[0].toFixed(0) + " " + a2[1].toFixed(0) + "L" + b2[0].toFixed(0) + " " + b2[1].toFixed(0) + '" stroke="var(--v3-grid)" stroke-width=".6" opacity=".16"/>';
    }
    var sh = [];
    for (var t = 0; t < 22; t++) {
      var ang = t / 22 * Math.PI * 2;
      sh.push(proj([Math.cos(ang) * 44, GROUND + 0.05, Math.sin(ang) * 30]));
    }
    out += g + '<polygon points="' + sh.map(function (p) { return p[0].toFixed(0) + "," + p[1].toFixed(0); }).join(" ") + '" fill="var(--v3-ground)" opacity=".18"/>';

    var faces = [];
    scene.parts.forEach(function (p) {
      if (!p || !p.t || !p.c) return;   /* 防御：忽略非法零件 */
      var gloss = p.g || 0;
      if (p.t === "box") {
        var hw = p.w / 2, hh = p.h / 2, hd = p.d / 2, v = [], i;
        for (i = 0; i < 8; i++) v.push([p.x + (i & 1 ? hw : -hw), p.y + (i & 2 ? hh : -hh), p.z + (i & 4 ? hd : -hd)]);
        var q = v.map(proj);
        [[[1, 3, 7, 5], [1, 0, 0]], [[0, 4, 6, 2], [-1, 0, 0]], [[2, 3, 7, 6], [0, 1, 0]],
         [[0, 1, 5, 4], [0, -1, 0]], [[4, 5, 7, 6], [0, 0, 1]], [[0, 2, 3, 1], [0, 0, -1]]].forEach(function (f) {
          var rn = rot(f[1], cam.yaw, cam.pitch);
          if (rn[2] <= 0.02) return;
          var pts = f[0].map(function (k) { return q[k]; });
          faces.push({ z: (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4, c: p.c, f: bright(f[1], gloss, rn), pts: pts, mod: p.mod, op: p.o, ly: p.ly || 0 });
        });
      } else {
        /* 圆柱：支持 y / x / z 三种轴向（电池平躺、电机竖立、天线横置） */
        var seg = p.seg, ax = p.ax || "y", hh2 = p.h / 2, ring0 = [], ring1 = [], k2, ang2;
        var capN = ax === "x" ? [1, 0, 0] : ax === "z" ? [0, 0, 1] : [0, 1, 0];
        for (k2 = 0; k2 < seg; k2++) {
          ang2 = k2 / seg * Math.PI * 2;
          var ca = Math.cos(ang2) * p.r, sa = Math.sin(ang2) * p.r;
          if (ax === "y") {
            ring0.push([p.x + ca, p.y - hh2, p.z + sa]); ring1.push([p.x + ca, p.y + hh2, p.z + sa]);
          } else if (ax === "z") {
            ring0.push([p.x + ca, p.y + sa, p.z - hh2]); ring1.push([p.x + ca, p.y + sa, p.z + hh2]);
          } else {
            ring0.push([p.x - hh2, p.y + ca, p.z + sa]); ring1.push([p.x + hh2, p.y + ca, p.z + sa]);
          }
        }
        var p0 = ring0.map(proj), p1 = ring1.map(proj);
        for (k2 = 0; k2 < seg; k2++) {
          var s3 = (k2 + 1) % seg;
          var am = (k2 + 0.5) / seg * Math.PI * 2;
          var nm = ax === "x" ? [0, Math.cos(am), Math.sin(am)] : ax === "z" ? [Math.cos(am), Math.sin(am), 0] : [Math.cos(am), 0, Math.sin(am)];
          var rn2 = rot(nm, cam.yaw, cam.pitch);
          if (rn2[2] <= 0.02) continue;
          var quad = [p0[k2], p0[s3], p1[s3], p1[k2]];
          faces.push({ z: (quad[0][2] + quad[1][2] + quad[2][2] + quad[3][2]) / 4, c: p.c, f: bright(nm, gloss, rn2), pts: quad, mod: p.mod, op: p.o, ly: p.ly || 0 });
        }
        var rnTop = rot(capN, cam.yaw, cam.pitch);
        if (rnTop[2] > 0.02) faces.push({ z: p1.reduce(function (a, q2) { return a + q2[2]; }, 0) / seg, c: p.c, f: bright(capN, gloss + 0.2, rnTop), pts: p1, mod: p.mod, op: p.o, ly: p.ly || 0 });
      }
    });
    faces.sort(function (a, b) { return (a.ly - b.ly) || (a.z - b.z); });
    faces.forEach(function (f) {
      var isHi = f.mod && f.mod === hitId;
      out += '<polygon points="' + f.pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") +
        '" fill="' + shade(f.c, f.f) + '"' + (f.op ? ' fill-opacity="' + f.op + '"' : "") +
        (f.op ? "" : (isHi ? ' stroke="var(--accent)" stroke-width="1.8"' : (f.mod ? ' stroke="rgba(0,0,0,.3)" stroke-width=".5"' : ""))) +
        (f.mod && !f.op ? ' data-mod="' + f.mod + '"' : "") + "/>";
    });
    scene.cables.forEach(function (cb) {
      var a = proj(cb.from), b2 = proj(cb.to), mid = [(a[0] + b2[0]) / 2, Math.min(a[1], b2[1]) - 22];
      out += '<path d="M' + a[0].toFixed(1) + " " + a[1].toFixed(1) + " Q" + mid[0].toFixed(1) + " " + mid[1].toFixed(1) + " " + b2[0].toFixed(1) + " " + b2[1].toFixed(1) + '" fill="none" stroke="var(--cat-power)" stroke-width="2.6" stroke-opacity=".9"/>';
    });
    scene.labels.forEach(function (l) {
      var p = proj([l.x, l.y, l.z]);
      out += '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '" text-anchor="middle" font-size="' + l.size + '" font-family="Geist Mono, monospace" fill="' + l.color + '">' + M.esc(l.text) + "</text>";
    });
    if (scene.total > scene.n) out += '<text x="24" y="' + (H - 14) + '" font-size="10" font-family="Geist Mono, monospace" fill="var(--muted)">另有 ' + (scene.total - scene.n) + " 件未展开</text>";
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" height="100%">' + out + "</svg>";
  }

  /* ---------- 挂载与交互 ---------- */
  var cam = { yaw: -0.66, pitch: 0.46, zoom: 1, fit: 7.6 };
  var timer = null, host = null, scene = null, hitId = null;
  function paint() {
    if (!host || !document.body.contains(host)) { stop(); return; }
    host.querySelector(".v3-svg").innerHTML = render(scene, cam, VW, VH, hitId);
    var info = host.querySelector(".v3-info");
    if (info) {
      var m = hitId ? M.ALL[hitId] : null;
      info.textContent = m ? m.name + " · " + (m.specs && m.specs[0] ? m.specs[0][0] + " " + m.specs[0][1] : "") : "拖拽旋转 · 滚轮缩放 · 点击模块查看参数";
    }
  }
  var spin = 0;
  function start() {
    if (timer) return;
    timer = setInterval(function () { spin += 0.026; cam.yaw = HERO + Math.sin(spin) * SWAY; paint(); }, 60);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  function mount(el, plan) {
    stop();
    host = el; scene = buildScene(plan); hitId = null;
    spin = 0;
    cam = { yaw: HERO, pitch: PITCH, zoom: 1, fit: fitWorst(scene.points, PITCH, VW, VH, 18) };
    var lg = (scene.legend || []).map(function (m) {
      var UU = window.MODBAY_UI; return '<span class="v3-lg"><i style="background:' + (UU && UU.catCss ? UU.catCss(m.cat) : "var(--cat-board)") + '"></i>' + M.esc(m.name) + "</span>";
    }).join("");
    el.innerHTML = '<div class="v3-svg"></div><div class="v3-bar">' +
      '<button class="btn btn-line btn-sm" data-act="v3-auto">⏸ 暂停旋转</button>' +
      '<button class="btn btn-line btn-sm" data-act="v3-reset">重置视角</button>' +
      '<span class="v3-info mono"></span></div>';
    var side = document.getElementById("v3-side");
    if (side) {
      side.innerHTML = '<div class="v3-side-h">模块图例</div><div class="v3-legend">' + lg + "</div>" +
        '<div class="v3-side-h">操作</div><div class="v3-side-tips">拖拽旋转 · 滚轮缩放<br>点击模块查看参数</div>' +
        '<div class="v3-side-h">本场景</div><div class="v3-side-stats mono">' +
        scene.parts.length + " 个零件面 · " + (scene.n || 0) + " 个模块</div>";
    }
    paint();
    start();
  }

  document.addEventListener("pointerdown", function (e) {
    var hostEl = e.target.closest ? e.target.closest(".view3d") : null;
    if (!hostEl) return;
    if (timer) { stop(); var ab = hostEl.querySelector('[data-act="v3-auto"]'); if (ab) ab.textContent = "▶ 自动旋转"; }
    var drag = { x: e.clientX, y: e.clientY };
    var move = function (ev) {
      cam.yaw += (ev.clientX - drag.x) * 0.012;
      cam.pitch = Math.max(-0.15, Math.min(1.3, cam.pitch + (ev.clientY - drag.y) * 0.008));
      drag = { x: ev.clientX, y: ev.clientY };
      paint();
    };
    var up = function () { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-mod]") : null;
    if (t && t.closest(".view3d")) { hitId = t.getAttribute("data-mod"); paint(); }
  });
  document.addEventListener("wheel", function (e) {
    if (!e.target.closest || !e.target.closest(".view3d")) return;
    e.preventDefault();
    cam.zoom = Math.max(0.45, Math.min(4.5, cam.zoom * (1 - e.deltaY * 0.0012)));
    paint();
  }, { passive: false });
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!t) return;
    if (t.getAttribute("data-act") === "v3-auto") {
      if (timer) { stop(); t.textContent = "▶ 自动旋转"; } else { start(); t.textContent = "⏸ 暂停旋转"; }
    } else if (t.getAttribute("data-act") === "v3-reset") {
      spin = 0;
    cam = { yaw: HERO, pitch: PITCH, zoom: 1, fit: fitWorst(scene.points, PITCH, VW, VH, 18) };
      hitId = null; paint();
    }
  });

  window.MODBAY_3D = { mount: mount, scene: function () { return scene; }, cam: function () { return cam; } };
})();
