/* ============ MODBAY 图标系统 ============
 * 统一 24×24 线性图标，stroke 1.6，currentColor 继承。
 * 用法：U.icon("cart", { size: 18, cls: "x" })
 */
(function () {
  "use strict";

  var P = {
    /* 分类 */
    board: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/><path d="M7 4V2.5M12 4V2.5M17 4V2.5M7 21.5V20M12 21.5V20M17 21.5V20"/>',
    sensor: '<path d="M3 17l4-5 3 3 4-7 3 4 4-6"/><circle cx="7" cy="12" r="1.2"/><circle cx="17" cy="6" r="1.2"/>',
    actuator: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>',
    display: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M9 20.5h6M12 17v3.5"/>',
    comm: '<path d="M12 20.5v-2.2"/><path d="M8.2 15.6a5.3 5.3 0 0 1 0-7.4"/><path d="M15.8 8.2a5.3 5.3 0 0 1 0 7.4"/><path d="M5.3 12.2a9 9 0 0 1 0-1.9"/><path d="M5.3 12.2a9 9 0 0 0 0-1.9"/><path d="M18.7 10.3a9 9 0 0 1 0 1.9"/><circle cx="12" cy="12" r="1.6"/>',
    power: '<rect x="2.5" y="7" width="16" height="10" rx="2.5"/><path d="M21.5 10.5v3"/><path d="M6.5 10.5v3M10 10.5v3"/>',

    /* 状态 */
    check: '<path d="M4.5 12.5l4.6 4.6L19.5 6.7"/>',
    warn: '<path d="M12 3.6l9 15.6H3z"/><path d="M12 9.4v4.4M12 16.6v.6"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.4M12 7.8v.6"/>',
    spark: '<path d="M12 2.8l2.1 5.6 5.6 2.1-5.6 2.1L12 18.2l-2.1-5.6L4.3 10.5l5.6-2.1z"/>',

    /* 操作 */
    cart: '<path d="M3 4h2.2l2.3 11.2a1.8 1.8 0 0 0 1.8 1.4h8.4a1.8 1.8 0 0 0 1.8-1.4L21 7.5H6"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/>',
    download: '<path d="M12 3.5v11"/><path d="M7.6 10.2L12 14.6l4.4-4.4"/><path d="M4 18.5v1.2a1.3 1.3 0 0 0 1.3 1.3h13.4a1.3 1.3 0 0 0 1.3-1.3v-1.2"/>',
    share: '<circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="5.8" r="2.4"/><circle cx="17.5" cy="18.2" r="2.4"/><path d="M8.2 10.9l7.1-3.9M8.2 13.1l7.1 3.9"/>',
    print: '<path d="M7 9V3.8h10V9"/><rect x="3.5" y="9" width="17" height="7.5" rx="1.6"/><path d="M7 14.5h10v5.7H7z"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.9a2 2 0 0 0-2-2H5.9a2 2 0 0 0-2 2v7.6a2 2 0 0 0 2 2h2.6"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    minus: '<path d="M5.5 12h13"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.4 15.4L20.5 20.5"/>',
    arrow: '<path d="M4.5 12h14"/><path d="M13.5 6.6L19 12l-5.5 5.4"/>',
    back: '<path d="M19.5 12h-14"/><path d="M10.5 6.6L5 12l5.5 5.4"/>',
    edit: '<path d="M16.4 3.9l3.7 3.7-11 11H5.4v-3.7z"/><path d="M14 6.3l3.7 3.7"/>',
    trash: '<path d="M4.5 7h15"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l.9 12.2a1.4 1.4 0 0 0 1.4 1.3h6.4a1.4 1.4 0 0 0 1.4-1.3L17.5 7"/>',
    heart: '<path d="M12 20.2S3.8 15 3.8 9.4a4.4 4.4 0 0 1 8.2-2.3 4.4 4.4 0 0 1 8.2 2.3c0 5.6-8.2 10.8-8.2 10.8z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="1.6"/><path d="M10 3.5v3.5M14 3.5v3.5M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12l2.2 2.2 4.2-4.2"/>',
    bolt: '<path d="M13.2 2.5L5 13.6h5.4L9.8 21.5 18 10.4h-5.4z"/>'
  };

  function icon(name, opt) {
    opt = opt || {};
    var size = opt.size || 18;
    var d = P[name];
    if (!d) return "";
    return '<svg class="ico' + (opt.cls ? " " + opt.cls : "") + '" viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="' + (opt.w || 1.7) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  }

  /* 分类图标名映射 */
  var CAT_ICON = { board: "board", sensor: "sensor", actuator: "actuator", display: "display", comm: "comm", power: "power" };
  function catIcon(cat, size) { return icon(CAT_ICON[cat] || "chip", { size: size || 18 }); }

  /* 品牌标识（与参赛材料一致：底板 + 三个模块） */
  function brandMark(size) {
    size = size || 26;
    return '<svg class="brand-mark" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<defs><linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--cat-board)"/></linearGradient></defs>' +
      '<rect x="5" y="40" width="54" height="7" rx="3.5" fill="url(#bm-g)"/>' +
      '<rect x="8" y="24" width="14" height="16" rx="2.2" fill="var(--accent)"/>' +
      '<rect x="25" y="20" width="14" height="20" rx="2.2" fill="var(--cat-board)"/>' +
      '<rect x="42" y="27" width="14" height="13" rx="2.2" fill="var(--cat-comm)"/>' +
      '<g fill="var(--gold, #c9a86a)" fill-opacity=".85">' +
      '<rect x="11" y="39" width="2.6" height="2.6" rx="1"/><rect x="17" y="39" width="2.6" height="2.6" rx="1"/>' +
      '<rect x="28" y="39" width="2.6" height="2.6" rx="1"/><rect x="34" y="39" width="2.6" height="2.6" rx="1"/>' +
      '<rect x="45" y="39" width="2.6" height="2.6" rx="1"/><rect x="51" y="39" width="2.6" height="2.6" rx="1"/></g></svg>';
  }

  /* 空态插画（虚线框 + 加号，暗示"还没放东西"） */
  function emptyArt(kind) {
    var label = kind === "cart" ? "空" : kind === "order" ? "无订单" : "空";
    return '<div class="empty-art" aria-hidden="true">' +
      '<svg viewBox="0 0 120 90" width="120" height="90">' +
      '<rect x="10" y="14" width="100" height="62" rx="10" fill="none" stroke="var(--line-strong)" stroke-width="1.6" stroke-dasharray="6 6"/>' +
      '<g stroke="var(--line-strong)" stroke-width="1.6" stroke-linecap="round">' +
      '<path d="M60 34v22M49 45h22"/></g></svg>' +
      '<span class="empty-art-t mono">' + label + "</span></div>";
  }

  window.MODBAY_ICON = { icon: icon, catIcon: catIcon, brandMark: brandMark, emptyArt: emptyArt, has: function (n) { return !!P[n]; } };
})();
