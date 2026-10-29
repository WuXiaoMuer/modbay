/* ============ MODBAY 支付网关 + 静态站点服务（零依赖） ============
 * 启动：  node server/server.js   （默认 :8321，可用 PORT 覆盖）
 * 未配置商户密钥时支付自动为 mock 模式；配置后同一接口走真实通道。
 * 订单支付状态持久化在 server/data/orders.json。
 *
 * API：
 *   POST /api/pay/create            {orderId,payType,totalFen,subject} -> {ok,mode,codeUrl}
 *   GET  /api/pay/status/:orderId   -> {ok,status,paid}
 *   POST /api/pay/mock-pay          {orderId}                          -> mock 模式下标记已支付
 *   POST /api/pay/notify/wechat     微信异步回调
 *   POST /api/pay/notify/alipay     支付宝异步回调
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const gateway = require("./gateway.js");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "orders.json");
const PORT = parseInt(process.env.PORT || "8321", 10);

/* ---------- 订单存储 ---------- */
let store = {};
try { store = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) || {}; } catch (e) { store = {}; }
function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (e) { console.error("[store]", e.message); }
}
function markPaid(orderId, via) {
  if (store[orderId] && store[orderId].status !== "paid") {
    store[orderId].status = "paid";
    store[orderId].paidVia = via;
    store[orderId].paidAt = new Date().toISOString();
    persist();
    console.log("[pay] 订单已支付:", orderId, "(", via, ")");
    return true;
  }
  return false;
}

/* ---------- 方案广场存储（server/data/plans.json） ---------- */
const PLANS_FILE = path.join(DATA_DIR, "plans.json");
let plans = {};
try { plans = JSON.parse(fs.readFileSync(PLANS_FILE, "utf8")) || {}; } catch (e) { plans = {}; }
function persistPlans() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2));
  } catch (e) { console.error("[plaza]", e.message); }
}
function seedPlans() {
  if (Object.keys(plans).length) return;
  const presets = [
    { id: "WX001", name: "桌面气象站 · 三传感器版", author: "雾削木", tags: ["气象", "I2C"], note: "BMP280 + SHT30 + OLED，Wi-Fi 上报。", board: "esp32s3", items: { bmp280: 1, sht30: 1, oled096: 1 }, likes: 12 },
    { id: "ARM002", name: "双轴机械臂 · 编码器闭环", author: "MODBAY 官方", tags: ["机械臂", "舵机"], note: "RP2040 + 18650 独供 5V 轨，PIO 驱动灯效。", board: "rp2040", items: { sg90: 2, ws2812: 1, encoder: 1, oled096: 1, lipo: 1 }, likes: 27 },
    { id: "CAR003", name: "循迹避障小车 · 5V 全家桶", author: "校园电赛队长", tags: ["小车", "教学"], note: "UNO + TB6612 + 超声波，教学演示无雷区。", board: "uno", items: { tb6612: 1, tt: 1, hcsr04: 1, lcd1602: 1, lipo: 1 }, likes: 19 },
    { id: "LOR004", name: "LoRa 野外温湿度节点", author: "山上露营的老王", tags: ["LoRa", "低功耗"], note: "太阳能供电，本地 SD 记录 + LoRa 远传。", board: "picow", items: { dht22: 1, bmp280: 1, lora: 1, tfcard: 1 }, likes: 8 }
  ];
  presets.forEach(function (p) {
    plans[p.id] = Object.assign({}, p, {
      createdAt: new Date(Date.now() - (presets.indexOf(p) + 1) * 86400000).toISOString(),
      remixCount: 0, price: 0, count: 0
    });
  });
  persistPlans();
  console.log("[plaza] 已写入种子方案 ×" + presets.length);
}
seedPlans();

/* ---------- 静态文件 ---------- */
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain"
};
function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (p === "/" || p === "") p = "/index.html";
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, function (err, buf) {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("404 Not Found"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store" /* 开发服务器始终保持最新，生产部署由平台接管缓存 */
    });
    res.end(buf);
  });
}

/* ---------- 请求体 ---------- */
function readBody(req) {
  return new Promise(function (resolve) {
    let b = "";
    req.on("data", function (c) { b += c; if (b.length > 1e6) req.destroy(); });
    req.on("end", function () { resolve(b); });
  });
}
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function parseForm(body) {
  const out = {};
  new URLSearchParams(body).forEach(function (v, k) { out[k] = v; });
  return out;
}

const server = http.createServer(async function (req, res) {
  const u = req.url || "/";
  const p = u.split("?")[0];

  /* ---- 回归测试结果落盘（headless 截图不可靠，改为服务端留档） ---- */
  if (p === "/api/test-log") {
    try {
      const q = new URLSearchParams(u.split("?")[1] || "");
      const data = q.get("d") || "";
      fs.writeFileSync(path.join(__dirname, "_test-result.json"), decodeURIComponent(data), "utf8");
    } catch (e) { /* noop */ }
    return json(res, 200, { ok: true });
  }

  /* ---- 支付 API ---- */
  if (p === "/api/pay/create" && req.method === "POST") {
    const body = await readBody(req);
    let o;
    try { o = JSON.parse(body); } catch (e) { return json(res, 400, { ok: false, error: "bad json" }); }
    if (!o.orderId || !o.totalFen) return json(res, 400, { ok: false, error: "missing fields" });
    store[o.orderId] = Object.assign({ status: "pending", createdAt: new Date().toISOString() }, store[o.orderId], o);
    const result = await gateway.create(o);
    store[o.orderId].mode = result.mode;
    store[o.orderId].codeUrl = result.codeUrl || gateway.mockCodeUrl(o);
    persist();
    console.log("[pay] create:", o.orderId, o.payType, o.totalFen + "fen", "mode=" + result.mode);
    return json(res, 200, { ok: true, mode: result.mode, codeUrl: store[o.orderId].codeUrl });
  }

  if (p.startsWith("/api/pay/status/") && req.method === "GET") {
    const id = decodeURIComponent(p.slice("/api/pay/status/".length));
    const rec = store[id];
    return json(res, 200, { ok: true, status: rec ? rec.status : "unknown", paid: !!(rec && rec.status === "paid") });
  }

  if (p === "/api/pay/mock-pay" && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    const done = markPaid(body.orderId, "mock");
    return json(res, 200, { ok: true, paid: done });
  }

  if (p === "/api/pay/notify/wechat" && req.method === "POST") {
    const body = await readBody(req);
    const r = gateway.wechatDecryptNotify(body);
    if (r && r.orderId) markPaid(r.orderId, "wechat" + (r.paid ? "" : ":state=" + "unknown"));
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end('{"code":"SUCCESS","message":"OK"}');
  }

  if (p === "/api/pay/notify/alipay" && req.method === "POST") {
    const params = parseForm(await readBody(req));
    const r = gateway.alipayVerifyNotify(params);
    if (r && r.orderId) {
      if (r.verified === false && process.env.ALIPAY_STRICT_VERIFY === "1") {
        res.writeHead(200); return res.end("verify failed");
      }
      if (r.paid) markPaid(r.orderId, "alipay" + (r.verified ? ":verified" : ":unverified"));
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("success");
  }

  /* ---- 方案广场 API ---- */
  if (p === "/api/plans/publish" && req.method === "POST") {
    let b;
    try { b = JSON.parse(await readBody(req)); } catch (e) { return json(res, 400, { ok: false, error: "bad json" }); }
    if (!b.name || !b.board) return json(res, 400, { ok: false, error: "missing fields" });
    var id = b.id || ("P" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase());
    plans[id] = {
      id: id,
      name: String(b.name).slice(0, 60),
      author: String(b.author || "匿名玩家").slice(0, 30),
      tags: Array.isArray(b.tags) ? b.tags.map(function (t) { return String(t).slice(0, 12); }).slice(0, 5) : [],
      note: String(b.note || "").slice(0, 300),
      board: b.board,
      items: b.items || {},
      remixFrom: b.remixFrom || null,
      createdAt: new Date().toISOString(),
      likes: 0,
      remixCount: 0
    };
    persistPlans();
    console.log("[plaza] 发布方案:", id, plans[id].name);
    return json(res, 200, { ok: true, id: id, url: "/index.html#/plan/" + id });
  }

  if (p === "/api/plans" && req.method === "GET") {
    var sort = new URLSearchParams(u.split("?")[1] || "").get("sort") || "hot";
    var list = Object.keys(plans).map(function (k) { return plans[k]; });
    if (sort === "new") list.sort(function (a, b) { return b.createdAt < a.createdAt ? -1 : 1; });
    else list.sort(function (a, b) { return (b.likes || 0) - (a.likes || 0); });
    return json(res, 200, { ok: true, plans: list.slice(0, 100) });
  }

  if (p.startsWith("/api/plans/") && req.method === "GET") {
    var pid = decodeURIComponent(p.slice("/api/plans/".length));
    var rec = plans[pid];
    if (!rec) return json(res, 404, { ok: false, error: "not found" });
    return json(res, 200, { ok: true, plan: rec });
  }

  if (p.endsWith("/like") && p.startsWith("/api/plans/") && req.method === "POST") {
    var lid = decodeURIComponent(p.slice("/api/plans/".length, -"/like".length));
    if (!plans[lid]) return json(res, 404, { ok: false, error: "not found" });
    plans[lid].likes = (plans[lid].likes || 0) + 1;
    persistPlans();
    return json(res, 200, { ok: true, likes: plans[lid].likes });
  }

  if (p.endsWith("/remix") && p.startsWith("/api/plans/") && req.method === "POST") {
    var rid = decodeURIComponent(p.slice("/api/plans/".length, -"/remix".length));
    if (plans[rid]) { plans[rid].remixCount = (plans[rid].remixCount || 0) + 1; persistPlans(); }
    return json(res, 200, { ok: true, remixCount: plans[rid] ? plans[rid].remixCount : 0 });
  }

  /* ---- 测试结果回传（_domtest.html 用，仅打印） ---- */
  if (p.startsWith("/api/test-log") && req.method === "GET") {
    console.log("[domtest]", decodeURIComponent(new URLSearchParams(u.split("?")[1] || "").get("d") || ""));
    res.writeHead(204);
    return res.end();
  }

  /* ---- 静态站点 ---- */
  serveStatic(req, res, u);
});

server.listen(PORT, function () {
  console.log("MODBAY server → http://127.0.0.1:" + PORT);
  console.log("  微信通道:", gateway.wechatConfigured() ? "已配置" : "未配置（mock）");
  console.log("  支付宝通道:", gateway.alipayConfigured() ? "已配置" : "未配置（mock）");
});
