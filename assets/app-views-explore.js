/* ============ MODBAY 视图：模块库 ============ */
(function () {
  "use strict";
  var M = window.M, U = window.MODBAY_UI;

  function metaKvs(m) {
    if (m.cat === "board") {
      return '<span class="kv">' + m.logic + " IO</span><span class=\"kv\">" + m.gpio + ' GPIO</span><span class="kv">' + (m.supply5v ? "5V 输出" : "仅 3.3V") + "</span>";
    }
    return '<span class="kv">' + U.BUS_LABEL[m.bus] + "</span>" +
      (m.addr ? '<span class="kv">' + m.addr + "</span>" : "") +
      '<span class="kv">' + U.RAIL_LABEL[m.rail] + '供电</span><span class="kv">' + fmtLv(m.level) + "</span>";
  }
  function fmtLv(lv) { return lv.join("/") + "V"; }

  function specRows(m) {
    return m.specs.slice(0, 4).map(function (s) {
      return "<div><span>" + M.esc(s[0]) + "</span><span>" + M.esc(s[1]) + "</span></div>";
    }).join("");
  }

  function card(m) {
    var added = M.state.items[m.id] > 0;
    var isBoard = m.cat === "board";
    var chosen = M.state.board === m.id;
    var btn = isBoard
      ? '<button class="btn ' + (chosen ? "btn-line" : "btn-ghost") + ' btn-sm" data-act="setboard" data-id="' + m.id + '">' + (chosen ? "✓ 当前基座" : "选为基座") + "</button>"
      : '<button class="btn ' + (added ? "btn-line" : "btn-ghost") + ' btn-sm" data-act="add" data-id="' + m.id + '">' + (added ? "✓ 已加入 ×" + M.state.items[m.id] : "+ 加入配置台") + "</button>";
    return '<article class="mcard' + (added || chosen ? " is-added" : "") + '">' +
      '<div class="mcard-art">' + U.modArt(m.id, m.cat) +
      '<span class="mcard-cat">' + U.catName(m.cat) + "</span>" +
      (added ? '<span class="qty-flag">×' + M.state.items[m.id] + "</span>" : "") +
      (chosen ? '<span class="qty-flag">基座</span>' : "") + "</div>" +
      '<div class="mcard-body">' +
      '<h3 class="mcard-name">' + M.esc(m.name) + "</h3>" +
      '<div class="mcard-meta">' + metaKvs(m) + "</div>" +
      '<p class="mcard-desc">' + M.esc(m.desc) + "</p>" +
      '<div class="mcard-specs">' + specRows(m) + "</div>" +
      '<div class="mcard-foot"><span class="price">' + M.fmtMoney(m.price) + " <small>/ 件</small></span>" + btn + "</div>" +
      "</div></article>";
  }

  function filtered() {
    var list = M.BOARDS.concat(M.MODULES).filter(function (m) {
      if (M.ui.cat !== "all" && m.cat !== M.ui.cat) return false;
      var q = M.ui.q.trim().toLowerCase();
      if (!q) return true;
      return (m.name + " " + (m.brand || "") + " " + m.desc + " " + (m.tags || []).join(" ")).toLowerCase().indexOf(q) > -1;
    });
    if (M.ui.sort === "price-asc") list.sort(function (a, b) { return a.price - b.price; });
    else if (M.ui.sort === "price-desc") list.sort(function (a, b) { return b.price - a.price; });
    else if (M.ui.sort === "ma-asc") list.sort(function (a, b) { return (a.ma || 0) - (b.ma || 0); });
    return list;
  }

  function viewExplore() {
    var chips = [{ id: "all", name: "全部" }].concat(M.CATS).map(function (c) {
      var dot = c.id === "all" ? "" : ' style="background:' + U.catCss(c.id) + '"';
      return '<button class="fchip' + (M.ui.cat === c.id ? " active" : "") + '" data-act="cat" data-id="' + c.id + '">' +
        (c.id === "all" ? "" : '<i' + (dot ? ' style="background:' + U.catCss(c.id) + '"' : "") + "></i>") + M.esc(c.name) + "</button>";
    }).join("");
    var list = filtered();
    var empty = '<div class="bay-empty" style="padding:48px"><b>没找到匹配的硬件</b>' +
      (M.ui.q ? "关键词「" + M.esc(M.ui.q) + "」" : "") +
      (M.ui.cat !== "all" ? "在「" + M.esc(U.catName(M.ui.cat)) + "」分类下无结果" : "") +
      '<div style="display:flex;gap:10px;justify-content:center;margin-top:14px">' +
      (M.ui.cat !== "all" ? '<button class="btn btn-ghost btn-sm" data-act="cat" data-id="all">清除分类筛选</button>' : "") +
      (M.ui.q ? '<button class="btn btn-line btn-sm" data-act="clearsearch">清空搜索</button>' : "") +
      "</div></div>";
    return '' +
      '<div class="sec-head" style="margin-bottom:18px"><span class="sec-label">MODULE LIBRARY</span>' +
      '<h2 class="sec-title">模块库 · ' + list.length + ' 件</h2>' +
      '<p class="sec-desc">每件商品的供电轨、逻辑电平、接口地址都写明白——选型先看参数，再谈价格。</p></div>' +
      '<div class="filterbar">' + chips +
      '<div class="searchbox"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
      '<input id="lib-search" type="search" placeholder="搜索模块 / 品牌 / 标签…" value="' + M.esc(M.ui.q) + '" autocomplete="off"></div>' +
      '<select class="select" id="lib-sort" aria-label="排序">' +
      '<option value="default"' + (M.ui.sort === "default" ? " selected" : "") + ">默认排序</option>" +
      '<option value="price-asc"' + (M.ui.sort === "price-asc" ? " selected" : "") + ">价格从低到高</option>" +
      '<option value="price-desc"' + (M.ui.sort === "price-desc" ? " selected" : "") + ">价格从高到低</option>" +
      '<option value="ma-asc"' + (M.ui.sort === "ma-asc" ? " selected" : "") + ">电流从低到高</option>" +
      "</select></div>" +
      '<div class="cards">' + (list.length ? list.map(card).join("") : empty) + "</div>";
  }

  window.MODBAY_VIEW_EXPLORE = viewExplore;
})();
