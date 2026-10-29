/* ============ MODBAY 方案广场：发布 / 浏览 / 点赞 / Remix ============ */
(function () {
  "use strict";
  var M = window.M, U = window.MODBAY_UI;

  function base() {
    return (window.MODBAY_PAY_CONFIG && window.MODBAY_PAY_CONFIG.apiBase || "").replace(/\/$/, "");
  }
  async function api(path, opts) {
    var r = await fetch(base() + path, opts || {});
    return r.ok ? await r.json() : null;
  }
  function planPrice(p) {
    var t = M.ALL[p.board] ? M.ALL[p.board].price : 0;
    Object.keys(p.items || {}).forEach(function (k) { if (M.ALL[k]) t += M.ALL[k].price * p.items[k]; });
    return t;
  }
  function planCount(p) {
    var n = p.board ? 1 : 0;
    Object.keys(p.items || {}).forEach(function (k) { n += p.items[k]; });
    return n;
  }
  function esc(s) { return M.esc(s); }

  /* ---------- 广场列表 ---------- */
  var UI = { q: "", sort: "hot" };
  function viewPlaza() {
    return '<div class="sec-head"><span class="sec-label">PLAZA</span>' +
      '<h2 class="sec-title">方案广场</h2>' +
      '<p class="sec-desc">玩家把自己的搭配发上来，看中就直接下单，或者点「改一改」变成你自己的版本。</p>' +
      '<div style="margin-left:auto;display:flex;gap:10px">' +
      '<button class="btn btn-ghost btn-sm" data-act="goto" data-hash="#/build">发布我的方案 →</button></div></div>' +
      '<div class="filterbar">' +
      '<button class="fchip' + (UI.sort === "hot" ? " active" : "") + '" data-act="plaza-sort" data-id="hot">最热</button>' +
      '<button class="fchip' + (UI.sort === "new" ? " active" : "") + '" data-act="plaza-sort" data-id="new">最新</button>' +
      '<div class="searchbox"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
      '<input id="plaza-search" type="search" placeholder="搜方案 / 作者 / 标签…" value="' + esc(M.ui.plazaQ || "") + '" autocomplete="off"></div></div>' +
      '<div id="plaza-grid" class="cards"><div class="bay-empty" style="padding:48px">加载中…</div></div>';
  }

  function planCard(p) {
    var q = (M.ui.plazaQ || "").trim().toLowerCase();
    if (q && (p.name + p.author + (p.tags || []).join(" ")).toLowerCase().indexOf(q) === -1) return "";
    var tags = (p.tags || []).map(function (t) { return '<span class="kv">#' + esc(t) + "</span>"; }).join("");
    return '<article class="mcard"><div class="mcard-art" style="height:96px">' + U.modArt(p.board || "esp32s3", "board") +
      '<span class="qty-flag">♥ ' + (p.likes || 0) + "</span></div>" +
      '<div class="mcard-body">' +
      '<h3 class="mcard-name">' + esc(p.name) + "</h3>" +
      '<div class="mcard-meta"><span class="kv">' + esc(p.author) + "</span><span class=\"kv\">" + planCount(p) + " 件</span><span class=\"kv\">" + M.fmtMoney(planPrice(p)) + "</span></div>" +
      '<p class="mcard-desc">' + esc(p.note || "") + "</p>" +
      '<div class="mcard-meta">' + tags + "</div>" +
      '<div class="mcard-foot"><span class="mono" style="font-size:12px;color:var(--muted)">' + esc(p.id) + "</span>" +
      '<button class="btn btn-ghost btn-sm" data-act="goto" data-hash="#/plan/' + encodeURIComponent(p.id) + '">查看 / 下单</button></div>' +
      "</div></article>";
  }

  async function mountPlaza() {
    var grid = document.getElementById("plaza-grid");
    if (!grid) return;
    var d = await api("/api/plans?sort=" + UI.sort);
    if (!d || !d.ok) {
      grid.innerHTML = '<div class="bay-empty" style="padding:48px"><b>广场服务未连接</b>' +
        "方案广场需要配合 node 网关运行（node server/server.js）或部署到带网关的域名；" +
        "现在你依然可以用方案页「分享链接」把方案发给别人。</div>";
      return;
    }
    if (!d.plans.length) { grid.innerHTML = '<div class="bay-empty" style="padding:48px">还没有人发布方案，来当第一个。</div>'; return; }
    var html = "";
    if (UI.sort === "hot" && d.plans.length > 3) {
      html += '<div class="kv-grid plan-span" style="margin-bottom:18px">' +
        d.plans.slice(0, 3).map(function (p, i) {
          return '<div class="kv-cell"><span>TOP ' + (i + 1) + " · ♥ " + (p.likes || 0) + '</span><b style="font-size:14px">' + esc(p.name) + "</b></div>";
        }).join("") + "</div>";
    }
    html += d.plans.map(planCard).join("");
    grid.innerHTML = html;
  }

  /* ---------- 分享方案页 #/plan/:pid ---------- */
  async function viewSharedPlan(pid) {
    var d = await api("/api/plans/" + encodeURIComponent(pid));
    if (!d || !d.ok || !d.plan) {
      return '<div class="sec-head"><span class="sec-label">NOT FOUND</span><h2 class="sec-title">方案不存在</h2></div>' +
        '<div class="bay-empty" style="padding:56px 24px"><b>链接 ' + esc(pid) + " 没找到</b>可能已被删除，或广场服务未连接。</div>" +
        '<div style="display:flex;gap:12px;justify-content:center;margin-top:18px">' +
        '<button class="btn btn-ghost" data-act="goto" data-hash="#/plaza">去方案广场逛逛</button></div>';
    }
    var p = d.plan;
    /* 载入本地状态，后续下单 / 改一改都基于它 */
    M.setBoard(p.board);
    M.state.items = {};
    Object.keys(p.items || {}).forEach(function (k) { if (M.ALL[k]) M.state.items[k] = p.items[k]; });
    M.save();
    M.remixFrom = { id: p.id, name: p.name, author: p.author };

    var liked = false;
    try { liked = JSON.parse(localStorage.getItem("modbay.liked") || "[]").indexOf(p.id) > -1; } catch (e) { /* noop */ }
    var banner = '<div class="panel plan-span" style="margin-bottom:18px;border-color:var(--accent)"><div class="panel-body" style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">' +
      '<span class="sec-label">FROM PLAZA</span>' +
      '<b style="font-size:16px">' + esc(p.name) + "</b>" +
      '<span class="mono" style="font-size:12.5px;color:var(--muted)">作者 ' + esc(p.author) + " · " + M.fmtMoney(planPrice(p)) + " · " + planCount(p) + " 件 · " + (p.remixCount || 0) + " 次被改</span>" +
      '<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn ' + (liked ? "btn-line" : "btn-primary") + ' btn-sm" data-act="plaza-like" data-id="' + esc(p.id) + '">' + (liked ? "♥ 已赞 " + (p.likes || 0) : "♥ 点赞 " + (p.likes || 0)) + "</button>" +
      '<button class="btn btn-ghost btn-sm" data-act="plaza-remix" data-id="' + esc(p.id) + '">改一改（Remix）</button>' +
      '<button class="btn btn-line btn-sm" data-act="share">复制链接</button>' +
      "</div></div></div>";
    return banner + window.MODBAY_VIEW_PLAN("");
  }

  /* ---------- 发布弹窗 ---------- */
  function openPublish() {
    var plan = M.check();
    if (!plan.board && !plan.items.length) { U.toast("配置台是空的，先选点模块", "error"); return; }
    var old = document.getElementById("plaza-publish");
    if (old) old.remove();
    var wrap = document.createElement("div");
    wrap.id = "plaza-publish";
    wrap.style.cssText = "position:fixed;inset:0;z-index:2000;background:#000000b3;display:flex;align-items:center;justify-content:center;padding:20px";
    wrap.innerHTML = '<div style="background:var(--bg-raised);border:1px solid var(--line-strong);border-radius:16px;max-width:420px;width:100%;padding:22px;box-shadow:var(--shadow)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><b style="font-size:15px">发布到方案广场</b>' +
      '<button data-act="plaza-publish-close" style="color:var(--muted);font-size:18px;padding:2px 8px">✕</button></div>' +
      '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<label class="mono" style="font-size:11px;color:var(--muted);letter-spacing:.08em">方案名称 *<input id="pp-name" class="select" style="width:100%;margin-top:4px" placeholder="例：阳台气象站 2.0"></label>' +
      '<label class="mono" style="font-size:11px;color:var(--muted);letter-spacing:.08em">署名<input id="pp-author" class="select" style="width:100%;margin-top:4px" placeholder="匿名玩家"></label>' +
      '<label class="mono" style="font-size:11px;color:var(--muted);letter-spacing:.08em">标签（逗号分隔）<input id="pp-tags" class="select" style="width:100%;margin-top:4px" placeholder="气象, I2C, 低功耗"></label>' +
      '<label class="mono" style="font-size:11px;color:var(--muted);letter-spacing:.08em">简介<textarea id="pp-note" class="select" rows="2" style="width:100%;margin-top:4px;resize:vertical" placeholder="这块方案的玩法 / 注意事项"></textarea></label>' +
      '<button class="btn btn-primary btn-block" data-act="plaza-publish-submit">发布</button>' +
      '<span id="pp-result" style="font-size:12px;color:var(--muted)"></span>' +
      "</div></div>";
    document.body.appendChild(wrap);
  }
  function closePublish() { var m = document.getElementById("plaza-publish"); if (m) m.remove(); }

  /* ---------- 首页热门注入 ---------- */
  async function mountHomeHot() {
    var slot = document.getElementById("plaza-hot-slot");
    if (!slot) return;
    var d = await api("/api/plans?sort=hot");
    if (!d || !d.ok || !d.plans.length) { slot.remove(); return; }
    var cards = d.plans.slice(0, 4).map(function (p) {
      return '<div class="feat"><div class="feat-num" style="color:var(--accent-ink)">♥ ' + (p.likes || 0) + " · " + esc(p.author) + "</div>" +
        '<div class="feat-name">' + esc(p.name) + "</div>" +
        '<p>' + esc(p.note || "") + "</p>" +
        '<div class="mcard-meta"><span class="kv">' + planCount(p) + ' 件</span><span class="kv">' + M.fmtMoney(planPrice(p)) + "</span></div>" +
        '<div class="feat-art"><button class="btn btn-ghost btn-sm" data-act="goto" data-hash="#/plan/' + encodeURIComponent(p.id) + '">看看怎么搭 →</button></div></div>';
    }).join("");
    slot.innerHTML = '<div class="sec-head"><span class="sec-label">03 / PLAZA HOT</span>' +
      '<h2 class="sec-title">广场在搭什么</h2>' +
      '<p class="sec-desc">其他玩家的公开方案，看中可直接下单或改一改。</p>' +
      '<div style="margin-left:auto"><button class="btn btn-line btn-sm" data-act="goto" data-hash="#/plaza">进入方案广场 →</button></div></div>' +
      '<div class="feat-grid">' + cards + "</div>";
  }

  /* ---------- 事件 ---------- */
  document.addEventListener("click", async function (e) {
    var t = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!t) return;
    var act = t.getAttribute("data-act"), id = t.getAttribute("data-id");
    function rerender() { if (window.MODBAY_RERENDER) window.MODBAY_RERENDER(); }
    switch (act) {
      case "plaza-sort": UI.sort = id; rerender(); break;
      case "plaza-like": {
        var liked;
        try { liked = JSON.parse(localStorage.getItem("modbay.liked") || "[]"); } catch (er) { liked = []; }
        if (liked.indexOf(id) > -1) { U.toast("已经点过赞了"); break; }
        var d = await api("/api/plans/" + encodeURIComponent(id) + "/like", { method: "POST", headers: { "Content-Type": "application/json" } });
        if (!d || !d.ok) { U.toast("广场服务未连接，点赞失败", "error"); break; }
        liked.push(id);
        try { localStorage.setItem("modbay.liked", JSON.stringify(liked)); } catch (er) { /* noop */ }
        U.toast("点赞成功 ♥");
        rerender();
        break;
      }
      case "plaza-remix": {
        var rd = await api("/api/plans/" + encodeURIComponent(id));
        if (!rd || !rd.ok) { U.toast("方案不存在", "error"); break; }
        M.setBoard(rd.plan.board);
        M.state.items = {};
        Object.keys(rd.plan.items || {}).forEach(function (k) { if (M.ALL[k]) M.state.items[k] = rd.plan.items[k]; });
        M.save();
        M.remixFrom = { id: rd.plan.id, name: rd.plan.name, author: rd.plan.author };
        api("/api/plans/" + encodeURIComponent(id) + "/remix", { method: "POST", headers: { "Content-Type": "application/json" } });
        U.toast("已载入「" + rd.plan.name + "」，随便改");
        location.hash = "#/build";
        break;
      }
      case "plaza-publish": openPublish(); break;
      case "plaza-publish-close": closePublish(); break;
      case "plaza-publish-submit": {
        var name = (document.getElementById("pp-name") || {}).value || "";
        var author = (document.getElementById("pp-author") || {}).value || "匿名玩家";
        var tags = ((document.getElementById("pp-tags") || {}).value || "").split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
        var note = (document.getElementById("pp-note") || {}).value || "";
        if (!name.trim()) { U.toast("先给方案起个名", "error"); break; }
        var d2 = await api("/api/plans/publish", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(), author: author.trim() || "匿名玩家", tags: tags, note: note.trim(),
            board: M.state.board, items: M.state.items, remixFrom: M.remixFrom || null
          })
        });
        if (!d2 || !d2.ok) { U.toast("发布失败：广场服务未连接", "error"); break; }
        var r = document.getElementById("pp-result");
        var url = location.href.split("#")[0] + "#" + d2.url;
        if (r) r.innerHTML = "已发布！链接：<span class='mono'>" + esc(d2.url) + "</span>";
        /* 先即时确认，剪贴板异步补（无权限环境不会挂住提示） */
        U.toast("已发布到广场");
        M.track(3);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { U.toast("链接已复制，发给队友"); }, function () { U.toast("复制失败，链接：" + d2.url); });
        } else {
          U.toast("链接：" + d2.url);
        }
        break;
      }
    }
  });
  document.addEventListener("input", function (e) {
    if (e.target && e.target.id === "plaza-search") {
      M.ui.plazaQ = e.target.value;
      var grid = document.getElementById("plaza-grid");
      if (grid) mountPlaza();
    }
  });
  window.addEventListener("hashchange", function () { closePublish(); });

  window.MODBAY_VIEW_PLAZA = viewPlaza;
  window.MODBAY_VIEW_PLAN_SHARED = viewSharedPlan;
  window.MODBAY_MOUNT_PLAZA = mountPlaza;
  window.MODBAY_MOUNT_HOME_HOT = mountHomeHot;
})();
