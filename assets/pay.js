/* ============ MODBAY 支付适配层 ============
 * Pay.create(order, payType) -> { mode:"real", codeUrl } | { mode:"mock" }
 * Pay.status(orderId)        -> { paid:boolean } | null（网关不可达）
 * Pay.renderQr(el, text)     -> 真二维码（CDN qrcode 库）或程序化模拟码
 * 真实通道由服务端网关决定：微信 Native / 支付宝当面付，见 server/ 目录。
 */
(function () {
  "use strict";
  var CFG = window.MODBAY_PAY_CONFIG || {};

  function base() { return (CFG.apiBase || "").replace(/\/$/, ""); }

  async function create(order, payType) {
    var body = {
      orderId: order.id,
      payType: payType,
      totalFen: Math.round(order.total * 100),
      subject: "MODBAY 硬件方案 " + order.id
    };
    try {
      var r = await fetch(base() + "/api/pay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error("http " + r.status);
      var d = await r.json();
      if (d && d.ok && d.codeUrl) return { mode: d.mode || "real", codeUrl: d.codeUrl };
      throw new Error("bad payload");
    } catch (e) {
      return { mode: "mock", reason: e && e.message };
    }
  }

  async function status(orderId) {
    try {
      var r = await fetch(base() + "/api/pay/status/" + encodeURIComponent(orderId));
      if (!r.ok) return null;
      var d = await r.json();
      return { paid: !!d.paid, status: d.status };
    } catch (e) {
      return null;
    }
  }

  async function mockPay(orderId) {
    try {
      await fetch(base() + "/api/pay/mock-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId })
      });
    } catch (e) { /* 离线模式：前端自行置为已支付 */ }
  }

  /* 程序化模拟码（无 CDN / 模拟模式时）：21×21 伪 QR，按文本哈希确定 */
  function pseudoQr(el, text) {
    var h = 0, i, x, y;
    for (i = 0; i < text.length; i++) h = (h * 131 + text.charCodeAt(i)) | 0;
    var n = 21, cell = 8, size = n * cell;
    var s = '<svg viewBox="0 0 ' + size + " " + size + '" width="180" height="180" style="background:#fff;border-radius:8px" aria-label="模拟支付二维码">';
    function dark(cx, cy) { s += '<rect x="' + cx * cell + '" y="' + cy * cell + '" width="' + cell + '" height="' + cell + '" fill="#101014"/>'; }
    function finder(ox, oy) {
      for (y = 0; y < 7; y++) for (x = 0; x < 7; x++) {
        var edge = x === 0 || y === 0 || x === 6 || y === 6;
        var core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || core) dark(ox + x, oy + y);
      }
    }
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) {
      var inFinder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      if (!inFinder && ((h = (h * 1103515245 + 12345) | 0) & 3) === 0) dark(x, y);
    }
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    s += '<text x="' + size / 2 + '" y="' + (size - 6) + '" font-size="9" text-anchor="middle" fill="#666" font-family="monospace">SIMULATED</text></svg>';
    el.innerHTML = s;
  }

  function renderQr(el, text) {
    if (window.QRCode && window.QRCode.toCanvas) {
      var cv = document.createElement("canvas");
      el.innerHTML = "";
      el.appendChild(cv);
      window.QRCode.toCanvas(cv, text, { width: 180, margin: 1, color: { dark: "#101014", light: "#ffffff" } }, function (err) {
        if (err) pseudoQr(el, text);
      });
    } else {
      pseudoQr(el, text);
    }
  }

  window.MODBAY_PAY = {
    create: create,
    status: status,
    mockPay: mockPay,
    renderQr: renderQr,
    isMockOnly: function () { return !CFG.apiBase; }
  };
})();
