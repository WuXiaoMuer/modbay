/* ============ MODBAY 支付网关配置 ============
 * apiBase 留空  -> 同源网关（用 node server/server.js 本地起站时即同源）
 * apiBase 填写 -> 指向独立部署的支付网关（Railway / Render / VPS 等），
 *                 例如 "https://modbay-pay.example.com"
 * 网关不可达或未配置商户密钥时，自动降级为模拟支付（页面明确标注）。
 */
window.MODBAY_PAY_CONFIG = {
  apiBase: "",
  pollIntervalMs: 2500,
  pollTimeoutMs: 180000
};
