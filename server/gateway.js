/* ============ MODBAY 支付网关适配层（服务端） ============
 * 微信支付 v3 Native（扫码）与支付宝当面付（预创建）的真实实现。
 * 未配置商户密钥时返回 mock 模式。
 *
 * 微信所需环境变量：
 *   WECHAT_MCHID       商户号
 *   WECHAT_APPID       应用 appid（公众号/小程序/APP）
 *   WECHAT_SERIAL_NO   商户 API 证书序列号
 *   WECHAT_KEY_PATH    商户私钥 apiclient_key.pem 路径
 *   WECHAT_APIV3_KEY   APIv3 密钥（回调解密用）
 *   PUBLIC_BASE        对外可达域名，如 https://pay.example.com（回调地址用）
 * 支付宝所需环境变量：
 *   ALIPAY_APP_ID          应用 appid（需签约当面付）
 *   ALIPAY_PRIVATE_KEY_PATH 应用私钥 PKCS#8 路径
 *   ALIPAY_PUBLIC_KEY_PATH 支付宝公钥路径（回调验签用）
 */
"use strict";
const crypto = require("crypto");
const fs = require("fs");

const env = (k) => process.env[k];
function pad(n) { return (n < 10 ? "0" : "") + n; }
function alipayTs() {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " +
    pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

const wechatConfigured = () => !!(env("WECHAT_MCHID") && env("WECHAT_APPID") && env("WECHAT_SERIAL_NO") && env("WECHAT_KEY_PATH") && env("PUBLIC_BASE"));
const alipayConfigured = () => !!(env("ALIPAY_APP_ID") && env("ALIPAY_PRIVATE_KEY_PATH"));

/* ---------- 微信支付 v3：Native 下单 ---------- */
async function wechatNative(order) {
  const mchid = env("WECHAT_MCHID"), appid = env("WECHAT_APPID");
  const urlPath = "/v3/pay/transactions/native";
  const body = JSON.stringify({
    appid: appid,
    mchid: mchid,
    description: order.subject,
    out_trade_no: order.orderId,
    notify_url: env("PUBLIC_BASE").replace(/\/$/, "") + "/api/pay/notify/wechat",
    amount: { total: order.totalFen, currency: "CNY" }
  });
  const ts = Math.floor(Date.now() / 1000) + "";
  const nonce = crypto.randomBytes(16).toString("hex");
  const msg = "POST\n" + urlPath + "\n" + ts + "\n" + nonce + "\n" + body + "\n";
  const keyPem = fs.readFileSync(env("WECHAT_KEY_PATH"));
  const signature = crypto.createSign("RSA-SHA256").update(msg).sign(keyPem, "base64");
  const auth = 'WECHATPAY2-SHA256-RSA2048 mchid="' + mchid + '",nonce_str="' + nonce +
    '",signature="' + signature + '",timestamp="' + ts + '",serial_no="' + env("WECHAT_SERIAL_NO") + '"';
  const r = await fetch("https://api.mch.weixin.qq.com" + urlPath, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": auth }
  });
  const d = await r.json();
  if (!d.code_url) throw new Error("微信下单失败: " + JSON.stringify(d).slice(0, 200));
  return d.code_url;
}

/* ---------- 支付宝当面付：预创建 ---------- */
function alipaySign(params) {
  const content = Object.keys(params).filter(function (k) { return k !== "sign" && k !== "sign_type" && params[k] !== ""; })
    .sort().map(function (k) { return k + "=" + params[k]; }).join("&");
  return crypto.createSign("RSA-SHA256").update(content).sign(fs.readFileSync(env("ALIPAY_PRIVATE_KEY_PATH")), "base64");
}
async function alipayPrecreate(order) {
  const biz = JSON.stringify({
    out_trade_no: order.orderId,
    total_amount: (order.totalFen / 100).toFixed(2),
    subject: order.subject
  });
  const params = {
    app_id: env("ALIPAY_APP_ID"),
    method: "alipay.trade.precreate",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: alipayTs(),
    version: "1.0",
    biz_content: biz
  };
  params.sign = alipaySign(params);
  const r = await fetch("https://openapi.alipay.com/gateway.do", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString()
  });
  const d = await r.json();
  const resp = d.alipay_trade_precreate_response;
  if (!resp || !resp.qr_code) throw new Error("支付宝预创建失败: " + JSON.stringify(d).slice(0, 200));
  return resp.qr_code;
}

/* ---------- 统一下单入口 ---------- */
async function create(order) {
  try {
    if (order.payType === "wechat" && wechatConfigured()) {
      return { mode: "real", codeUrl: await wechatNative(order) };
    }
    if (order.payType === "alipay" && alipayConfigured()) {
      return { mode: "real", codeUrl: await alipayPrecreate(order) };
    }
  } catch (e) {
    console.error("[gateway] 真实通道失败，降级 mock:", e.message);
    return { mode: "mock", error: e.message };
  }
  return { mode: "mock" };
}

function mockCodeUrl(order) {
  return order.payType === "wechat"
    ? "weixin://wxpay/bizpayurl?pr=MOCK" + order.orderId
    : "https://qr.alipay.com/mock_" + order.orderId;
}

/* ---------- 回调处理 ---------- */
/* 微信回调 resource 为 AES-256-GCM 加密，用 APIv3 密钥解出 out_trade_no */
function wechatDecryptNotify(body) {
  try {
    const j = JSON.parse(body);
    if (j.event_type && j.resource) {
      const key = Buffer.from(env("WECHAT_APIV3_KEY") || "", "utf8");
      if (key.length !== 32) throw new Error("缺少 WECHAT_APIV3_KEY");
      const buf = Buffer.from(j.resource.ciphertext, "base64");
      const authTag = buf.subarray(buf.length - 16);
      const data = buf.subarray(0, buf.length - 16);
      const dv = crypto.createDecipheriv("aes-256-gcm", key, j.resource.nonce);
      dv.setAuthTag(authTag);
      if (j.resource.associated_data) dv.setAAD(Buffer.from(j.resource.associated_data));
      const plain = JSON.parse(Buffer.concat([dv.update(data), dv.final()]).toString("utf8"));
      return { orderId: plain.out_trade_no, paid: plain.trade_state === "SUCCESS" };
    }
    return null;
  } catch (e) {
    console.error("[gateway] 微信回调解密失败:", e.message);
    return null;
  }
}
/* 支付宝回调：RSA2 验签后取 out_trade_no / trade_status */
function alipayVerifyNotify(params) {
  try {
    const sign = params.sign;
    if (!sign || !env("ALIPAY_PUBLIC_KEY_PATH")) return { orderId: params.out_trade_no, paid: params.trade_status === "TRADE_SUCCESS", verified: false };
    const content = Object.keys(params).filter(function (k) { return k !== "sign" && k !== "sign_type" && params[k] !== ""; })
      .sort().map(function (k) { return k + "=" + params[k]; }).join("&");
    const ok = crypto.createVerify("RSA-SHA256").update(content).verify(fs.readFileSync(env("ALIPAY_PUBLIC_KEY_PATH")), sign, "base64");
    return { orderId: params.out_trade_no, paid: params.trade_status === "TRADE_SUCCESS", verified: ok };
  } catch (e) {
    console.error("[gateway] 支付宝验签失败:", e.message);
    return null;
  }
}

module.exports = {
  create: create,
  mockCodeUrl: mockCodeUrl,
  wechatConfigured: wechatConfigured,
  alipayConfigured: alipayConfigured,
  wechatDecryptNotify: wechatDecryptNotify,
  alipayVerifyNotify: alipayVerifyNotify
};
