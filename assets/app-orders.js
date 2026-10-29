/* ============ MODBAY 订单域：下单 / 模拟支付 / 我的订单 / 演示后台 ============ */
(function () {
  "use strict";
  var M = window.M, U = window.MODBAY_UI;
  var KEY = "modbay.orders.v1";

  var STATUS = {
    pending: { label: "待支付", color: "var(--warn)", act: "去支付" },
    paid: { label: "已支付", color: "var(--ok)", act: "进入生产" },
    design: { label: "底板设计", color: "#7c5cff", act: "设计确认" },
    fab: { label: "打样中", color: "#7c5cff", act: "打样完成" },
    solder: { label: "焊接中", color: "var(--warn)", act: "焊接完成" },
    test: { label: "测试中", color: "var(--warn)", act: "测试通过" },
    stocking: { label: "备货打包", color: "var(--accent-ink)", act: "完成打包" },
    shipped: { label: "已发货", color: "var(--accent)", act: "模拟发货" },
    done: { label: "已完成", color: "var(--muted)", act: "确认收货" },
    cancelled: { label: "已取消", color: "var(--danger)", act: "" }
  };

  /* 履约序列：焊接成品多走「设计 → 打样 → 焊接 → 测试」四步 */
  var SEQ = {
    kit: ["pending", "paid", "stocking", "shipped", "done"],
    built: ["pending", "paid", "design", "fab", "solder", "test", "stocking", "shipped", "done"]
  };
  function seqOf(o) { return SEQ[o.delivery === "built" ? "built" : "kit"]; }
  function nextStatus(o) {
    var seq = seqOf(o);
    var i = seq.indexOf(o.status);
    return i >= 0 && i < seq.length - 1 ? seq[i + 1] : null;
  }
  var NEXT = { paid: "stocking", stocking: "shipped", shipped: "done" };
  var PAY = { alipay: "模拟支付宝", wechat: "模拟微信支付", bank: "对公转账（模拟）" };

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
  }
  function getOrder(id) {
    return load().filter(function (o) { return o.id === id; })[0] || null;
  }
  function setStatus(id, st, note) {
    var list = load();
    list.forEach(function (o) {
      if (o.id === id) {
        o.status = st;
        o.timeline.push({ st: st, at: new Date().toISOString(), note: note || "" });
      }
    });
    save(list);
  }
  function newId() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return "MB" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) +
      "-" + Math.random().toString(36).slice(2, 4).toUpperCase();
  }
  function createOrder(info) {
    var plan = M.check();
    var order = {
      id: newId(),
      createdAt: new Date().toISOString(),
      status: "pending",
      customer: { name: info.name, phone: info.phone, addr: info.addr, note: info.note, pay: info.pay },
      source: M.remixFrom ? { type: "plaza", planId: M.remixFrom.id, author: M.remixFrom.author } : null,
      delivery: M.ui.delivery || "kit",
      total: M.serviceQuote(null, M.ui.delivery || "kit").total,
      count: M.totalCount(),
      items: plan.items.map(function (it) { return { id: it.mod.id, name: it.mod.name, qty: it.qty, price: it.mod.price }; }),
      board: plan.board ? { id: plan.board.id, name: plan.board.name, price: plan.board.price } : null,
      timeline: [{ st: "pending", at: new Date().toISOString(), note: "订单创建" }]
    };
    var list = load();
    list.unshift(order);
    save(list);
    M.track(3);
    return order;
  }
  /* 模拟后台：付款后自动推进（页面打开期间） */
  function autoProcess(id) {
    setTimeout(function () {
      var o = getOrder(id);
      if (o && o.status === "paid") {
        setStatus(id, "stocking", "后台自动：拣货备货中");
        U.toast("后台：订单 " + id + " 已进入备货");
        if (W.location.hash.indexOf("/orders") > -1 || W.location.hash.indexOf("/admin") > -1) window.MODBAY_RERENDER();
        setTimeout(function () {
          var o2 = getOrder(id);
          if (o2 && o2.status === "stocking") {
            setStatus(id, "shipped", "后台自动：已交顺丰（模拟单号 SF" + Math.random().toString(36).slice(2, 10).toUpperCase() + "）");
            U.toast("后台：订单 " + id + " 已发货");
            if (W.location.hash.indexOf("/orders") > -1 || W.location.hash.indexOf("/admin") > -1) window.MODBAY_RERENDER();
          }
        }, 9000);
      }
    }, 5000);
  }
  var W = window;

  /* ---------- 下单页 ---------- */
  function viewCheckout() {
    var plan = M.check();
    if (!plan.board && !plan.items.length) {
      return '<div class="sec-head"><span class="sec-label">CHECKOUT</span><h2 class="sec-title">提交订单</h2></div>' +
        '<div class="bay-empty" style="padding:40px 24px">' + window.MODBAY_ICON.emptyArt("cart") + '<b>没有可下单的方案</b><span class="bay-empty-sub">先去配置台选型，生成方案后再来。</span></div>' +
        '<div style="display:flex;gap:12px;justify-content:center;margin-top:18px">' +
        '<button class="btn btn-primary" data-act="goto" data-hash="#/build">进入配置台</button></div>';
    }
    var q = M.serviceQuote(plan, M.ui.delivery || "kit");
    var rows = plan.items.map(function (it) {
      return '<tr><td>' + M.esc(it.mod.name) + '</td><td class="num">' + it.qty + '</td><td class="num">' + M.fmtMoney(it.mod.price * it.qty) + "</td></tr>";
    }).join("");
    if (plan.board) {
      rows += '<tr><td>' + M.esc(plan.board.name) + '</td><td class="num">1</td><td class="num">' + M.fmtMoney(plan.board.price) + "</td></tr>";
    }
    return '' +
      '<div class="sec-head"><span class="sec-label">CHECKOUT</span><h2 class="sec-title">提交订单</h2>' +
      '<p class="sec-desc">演示环境：不产生真实扣款，支付与物流均为模拟。</p></div>' +
      '<div class="plan-grid">' +
      '<section class="panel"><div class="panel-head"><h3>收货信息</h3></div><div class="panel-body">' +
      '<div style="display:flex;flex-direction:column;gap:12px">' +
      '<label class="mono" style="font-size:11px;color:var(--muted);letter-spacing:.08em">姓名 *<input id="co-name" class="select" style="width:100%;margin-top:4px" placeholder="收货人姓名"></label>' +
      '<label class="mono" style="font-size:11px;color:var(--muted);letter-spacing:.08em">手机号 *<input id="co-phone" class="select" style="width:100%;margin-top:4px" placeholder="11 位手机号" inputmode="numeric"></label>' +
      '<label class="mono" style="font-size:11px;color:var(--muted);letter-spacing:.08em">收货地址 *<textarea id="co-addr" class="select" rows="2" style="width:100%;margin-top:4px;resize:vertical" placeholder="省 / 市 / 区 + 详细地址"></textarea></label>' +
      '<label class="mono" style="font-size:11px;color:var(--muted);letter-spacing:.08em">订单备注<textarea id="co-note" class="select" rows="2" style="width:100%;margin-top:4px;resize:vertical" placeholder="选填"></textarea></label>' +
      '<div><div class="mono" style="font-size:11px;color:var(--muted);letter-spacing:.08em;margin-bottom:6px">支付方式 *</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<label class="check check-ok" style="cursor:pointer"><input type="radio" name="co-pay" value="alipay" checked style="accent-color:var(--accent)"><div><div class="check-title">模拟支付宝</div><div class="check-hint">演示环境，不会真实扣款</div></div></label>' +
      '<label class="check check-ok" style="cursor:pointer"><input type="radio" name="co-pay" value="wechat" style="accent-color:var(--accent)"><div><div class="check-title">模拟微信支付</div><div class="check-hint">演示环境，不会真实扣款</div></div></label>' +
      '<label class="check check-ok" style="cursor:pointer"><input type="radio" name="co-pay" value="bank" style="accent-color:var(--accent)"><div><div class="check-title">对公转账（模拟）</div><div class="check-hint">后台人工确认到账</div></div></label>' +
      "</div></div></div></div></section>" +
      '<section class="panel"><div class="panel-head"><h3>订单摘要</h3><span class="mono">' + M.totalCount() + " 件</span></div>" +
      '<div class="panel-body" style="padding:0">' +
      '<div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl"><thead><tr><th>物料</th><th class="num">数量</th><th class="num">小计</th></tr></thead><tbody>' + rows +
      '<tr><td>配套件（电池盒 / 开关 / 杜邦线 / 底板…）</td><td class="num">' + M.accessories(plan).reduce(function (a, x) { return a + x.qty; }, 0) + '</td><td class="num">' + M.fmtMoney(q.acc) + "</td></tr>" +
      (q.sw > 0
        ? '<tr><td>软件方案 · ' + M.esc(q.swName) + '（BSP / 驱动 / 联动 / 协议）</td><td class="num">1</td><td class="num">' + M.fmtMoney(q.sw) + "</td></tr>"
        : "") +
      (q.mode === "built"
        ? '<tr><td>底板设计 + 打样</td><td class="num">1</td><td class="num">' + M.fmtMoney(q.fab) + "</td></tr>" +
          '<tr><td>焊接工时（' + q.pads + ' 个焊点）</td><td class="num">1</td><td class="num">' + M.fmtMoney(q.solder) + "</td></tr>" +
          '<tr><td>通电测试 + 烧录示例</td><td class="num">1</td><td class="num">' + M.fmtMoney(q.test) + "</td></tr>"
        : "") +
      "</tbody>" +
      '<tfoot><tr><td>合计（' + (q.mode === "built" ? "焊接成品 · 约 " + q.days + " 天" : "散件包 · 约 " + q.days + " 天") + '）</td><td class="num">' + M.totalCount() + '</td><td class="num">' + M.fmtMoney(q.total) + "</td></tr></tfoot></table></div>" +
      '<div style="padding:14px"><button class="btn btn-primary btn-block" data-act="submit-order">提交订单 →</button>' +
      '<p class="sec-desc" style="font-size:12px;margin-top:10px">提交后在「我的订单」里完成模拟支付，后台将自动推进备货 / 发货。</p></div>' +
      "</div></section></div>";
  }

  /* ---------- 我的订单 ---------- */
  function badge(st) {
    return '<span class="plan-badge" style="color:' + STATUS[st].color + ";border-color:" + STATUS[st].color + '">' + STATUS[st].label + "</span>";
  }
  function orderCard(o, hl) {
    var rows = o.items.map(function (it) {
      return '<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:2px 0"><span>' + M.esc(it.name) + " ×" + it.qty + '</span><span class="mono">' + M.fmtMoney(it.price * it.qty) + "</span></div>";
    }).join("");
    if (o.board) rows += '<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:2px 0"><span>' + M.esc(o.board.name) + ' ×1</span><span class="mono">' + M.fmtMoney(o.board.price) + "</span></div>";
    var acts = "";
    if (o.status === "pending") {
      acts += '<button class="btn btn-primary btn-sm" data-act="pay-order" data-id="' + o.id + '">立即支付</button>' +
        '<button class="btn btn-line btn-sm" data-act="cancel-order" data-id="' + o.id + '">取消</button>';
    } else {
      var nx = nextStatus(o);
      if (nx) {
        acts += '<button class="btn btn-ghost btn-sm" data-act="admin-act" data-id="' + o.id + '" data-st="' + nx + '">' +
          (STATUS[nx] ? STATUS[nx].act : "推进") + " →</button>";
      }
    }
    var tl = o.timeline.map(function (t) {
      return "<div>" + (STATUS[t.st] ? STATUS[t.st].label : t.st) + " · " + new Date(t.at).toLocaleString("zh-CN", { hour12: false }) + (t.note ? " · " + M.esc(t.note) : "") + "</div>";
    }).join("");
    return '<section class="panel' + (hl ? '" style="border-color:var(--accent)' : "") + '"><div class="panel-head">' +
      '<h3 class="mono" style="font-size:13px">' + o.id + "</h3>" + badge(o.status) +
      '<span class="mono" style="margin-left:auto">' + M.fmtMoney(o.total) + " · " + o.count + " 件 · " +
        (o.delivery === "built" ? "焊接成品" : "散件包") + "</span></div>" +
      '<div class="panel-body"><div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px">' +
      "<div>" + rows +       '<div style="border-top:1px dashed var(--line);margin-top:8px;padding-top:8px;font-size:12px;color:var(--muted)">' +
      (o.delivery === "built"
        ? '<div style="margin-bottom:6px;color:var(--accent-ink)">履约：' +
          seqOf(o).filter(function (x) { return x !== "pending" && x !== "cancelled"; }).map(function (x) {
            return '<span class="' + (seqOf(o).indexOf(o.status) >= seqOf(o).indexOf(x) ? "is-done" : "") + '">' + (STATUS[x] ? STATUS[x].label : x) + "</span>";
          }).join(' <i style="opacity:.4">·</i> ') + "</div>"
        : "") +
      "收货：&nbsp;" + M.esc(o.customer.name) + "　" + M.esc(o.customer.phone) + "<br>" + M.esc(o.customer.addr) +
      (o.customer.note ? "<br>备注：" + M.esc(o.customer.note) : "") + "<br>支付：" + (PAY[o.customer.pay] || o.customer.pay) +
      (o.source ? '<br><span style="color:var(--accent-ink)">来源：广场方案 ' + M.esc(o.source.planId) + " · 作者 " + M.esc(o.source.author) + "（带货分成结算用）</span>" : "") + "</div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' + acts +
      '<button class="btn btn-line btn-sm" data-act="export-one" data-id="' + o.id + '">导出 JSON</button></div></div>' +
      '<div><div class="mono" style="font-size:11px;color:var(--muted);letter-spacing:.08em;margin-bottom:8px">订单轨迹</div>' +
      '<div style="font-size:12px;color:var(--muted);display:flex;flex-direction:column;gap:5px">' + tl + "</div></div>" +
      "</div></div></section>";
  }
  function viewOrders() {
    var list = load();
    var hlId = new URLSearchParams((location.hash.split("?")[1] || "")).get("hl");
    return '<div class="sec-head"><span class="sec-label">MY ORDERS</span><h2 class="sec-title">我的订单</h2>' +
      '<p class="sec-desc">演示环境：支付 / 备货 / 发货均为模拟流程，数据保存在本机。</p></div>' +
      (list.length ? list.map(function (o) { return orderCard(o, o.id === hlId); }).join("") :
        '<div class="bay-empty" style="padding:40px 24px">' + window.MODBAY_ICON.emptyArt("order") + '<b>还没有订单</b><span class="bay-empty-sub">去配置台选型，生成方案后提交订单。</span></div>' +
        '<div style="display:flex;justify-content:center;margin-top:18px"><button class="btn btn-primary" data-act="goto" data-hash="#/build">进入配置台</button></div>');
  }

  /* ---------- 演示后台 ---------- */
  function viewAdmin() {
    var all = load();
    var f = M.ui.orderFilter || "all";
    var list = f === "all" ? all : all.filter(function (o) { return o.status === f; });
    var revenue = all.filter(function (o) { return o.status !== "cancelled" && o.status !== "pending"; })
      .reduce(function (s, o) { return s + o.total; }, 0);
    var pendingN = all.filter(function (o) { return o.status === "pending" || o.status === "paid" || o.status === "stocking"; }).length;
    var opts = '<option value="all"' + (f === "all" ? " selected" : "") + ">全部 (" + all.length + ")</option>" +
      Object.keys(STATUS).map(function (k) {
        var n = all.filter(function (o) { return o.status === k; }).length;
        return '<option value="' + k + '"' + (f === k ? " selected" : "") + ">" + STATUS[k].label + " (" + n + ")</option>";
      }).join("");
    return '<div class="sec-head"><span class="sec-label">ADMIN CONSOLE</span><h2 class="sec-title">演示后台</h2>' +
      '<p class="sec-desc">订单处理控制台（本机数据）。自动推进：付款后 5s 备货、再 9s 发货。</p>' +
      '<div style="margin-left:auto;display:flex;gap:10px">' +
      '<button class="btn btn-ghost btn-sm" data-act="admin-auto">模拟后台自动推进</button>' +
      '<button class="btn btn-line btn-sm" data-act="export-orders">导出全部 JSON</button></div></div>' +
      '<div class="kv-grid" style="margin-bottom:18px">' +
      '<div class="kv-cell"><span>订单总数</span><b>' + all.length + "</b></div>" +
      '<div class="kv-cell"><span>有效销售额</span><b>' + M.fmtMoney(revenue) + "</b></div>" +
      '<div class="kv-cell"><span>待处理</span><b style="color:' + (pendingN ? "var(--warn)" : "var(--ok)") + '">' + pendingN + "</b></div>" +
      '<div class="kv-cell"><span>已发货/完成</span><b>' + all.filter(function (o) { return o.status === "shipped" || o.status === "done"; }).length + "</b></div>" +
      "</div>" +
      '<div class="filterbar"><select class="select" id="admin-filter">' + opts + "</select></div>" +
      (list.length ? list.map(function (o) { return orderCard(o, false); }).join("") :
        '<div class="bay-empty" style="padding:48px"><b>没有符合条件的订单</b></div>');
  }

  /* ---------- 事件 ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!t) return;
    var act = t.getAttribute("data-act");
    var id = t.getAttribute("data-id");
    function rerender() { if (window.MODBAY_RERENDER) window.MODBAY_RERENDER(); }
    switch (act) {
      case "submit-order": {
        var name = (document.getElementById("co-name") || {}).value || "";
        var phone = (document.getElementById("co-phone") || {}).value || "";
        var addr = (document.getElementById("co-addr") || {}).value || "";
        var note = (document.getElementById("co-note") || {}).value || "";
        var payEl = document.querySelector('input[name="co-pay"]:checked');
        if (!name.trim() || !addr.trim()) { U.toast("请填写姓名和收货地址", "error"); break; }
        if (!/^1\d{10}$/.test(phone.trim())) { U.toast("手机号格式不对（11 位数字）", "error"); break; }
        var o = createOrder({ name: name.trim(), phone: phone.trim(), addr: addr.trim(), note: note.trim(), pay: payEl ? payEl.value : "alipay" });
        U.toast("订单已创建：" + o.id);
        location.hash = "#/orders?hl=" + o.id;
        break;
      }
      case "pay-order": {
        var op = getOrder(id);
        if (op && op.status === "pending") openPayModal(id);
        break;
      }
      case "pay-mock-confirm": {
        var om = getOrder(id);
        if (om && om.status === "pending") {
          window.MODBAY_PAY.mockPay(id);
          setStatus(id, "paid", PAY[om.customer.pay] + " 支付成功（模拟）");
          M.track(2);
          U.toast("支付成功（模拟）：" + id);
          autoProcess(id);
          closePayModal();
          rerender();
        }
        break;
      }
      case "pay-modal-close": {
        closePayModal();
        break;
      }
      case "cancel-order": {
        var oc = getOrder(id);
        if (oc && oc.status === "pending") {
          setStatus(id, "cancelled", "用户取消");
          U.toast("订单已取消");
          rerender();
        }
        break;
      }
      case "admin-act": {
        var st = t.getAttribute("data-st");
        if (NEXT[getOrder(id).status] === st || st === "stocking" || st === "shipped" || st === "done") {
          setStatus(id, st, "后台手动操作");
          U.toast("订单 " + id + " → " + STATUS[st].label);
          rerender();
        }
        break;
      }
      case "admin-auto": {
        var list = load();
        var n = 0;
        list.forEach(function (o) {
          if (o.status === "paid" || o.status === "stocking") {
            setStatus(o.id, NEXT[o.status], "后台批量推进");
            n++;
          }
        });
        U.toast(n ? "已推进 " + n + " 个订单" : "没有可推进的订单");
        rerender();
        break;
      }
      case "export-orders": {
        var blob = new Blob([JSON.stringify(load(), null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "modbay-orders.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        U.toast("订单数据已导出");
        break;
      }
      case "export-one": {
        var one = getOrder(id);
        if (!one) break;
        var b2 = new Blob([JSON.stringify(one, null, 2)], { type: "application/json" });
        var a2 = document.createElement("a");
        a2.href = URL.createObjectURL(b2);
        a2.download = one.id + ".json";
        document.body.appendChild(a2);
        a2.click();
        a2.remove();
        setTimeout(function () { URL.revokeObjectURL(a2.href); }, 5000);
        U.toast("订单 JSON 已导出");
        break;
      }
    }
  });
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "admin-filter") {
      M.ui.orderFilter = e.target.value;
      if (window.MODBAY_RERENDER) window.MODBAY_RERENDER();
      var s = document.getElementById("admin-filter");
      if (s) s.value = e.target.value;
    }
  });

  /* ---------- 支付弹窗（真实扫码 / 模拟） ---------- */
  var payTimer = null;
  function closePayModal() {
    if (payTimer) { clearInterval(payTimer); payTimer = null; }
    var m = document.getElementById("pay-modal");
    if (m) m.remove();
  }
  function onPaid(id, label) {
    setStatus(id, "paid", label + " 支付成功");
    M.track(2);
    U.toast("支付成功：" + id);
    autoProcess(id);
    closePayModal();
    if (window.MODBAY_RERENDER) window.MODBAY_RERENDER();
  }
  async function openPayModal(id) {
    var o = getOrder(id);
    if (!o || o.status !== "pending") return;
    var payType = o.customer.pay === "wechat" ? "wechat" : "alipay";
    var title = payType === "wechat" ? "微信扫码支付" : "支付宝扫码支付";
    closePayModal();
    var wrap = document.createElement("div");
    wrap.id = "pay-modal";
    wrap.style.cssText = "position:fixed;inset:0;z-index:2000;background:#000000b3;display:flex;align-items:center;justify-content:center;padding:20px";
    wrap.innerHTML =
      '<div style="background:var(--bg-raised);border:1px solid var(--line-strong);border-radius:16px;max-width:340px;width:100%;padding:24px;text-align:center;box-shadow:var(--shadow)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
      '<b style="font-size:15px">' + title + "</b>" +
      '<button data-act="pay-modal-close" aria-label="关闭" style="color:var(--muted);font-size:18px;padding:2px 8px">✕</button></div>' +
      '<div class="mono" style="font-size:26px;font-weight:700;margin-bottom:4px">' + M.fmtMoney(o.total) + "</div>" +
      '<div class="mono" style="font-size:11px;color:var(--muted);margin-bottom:14px">' + o.id + "</div>" +
      '<div id="pay-qr" style="display:flex;justify-content:center;min-height:180px;align-items:center">' +
      '<span class="mono" style="font-size:12px;color:var(--muted)">正在生成支付码…</span></div>' +
      '<div id="pay-status" class="mono" style="font-size:12px;color:var(--muted);margin-top:12px;min-height:18px"></div>' +
      '<div id="pay-actions" style="display:flex;flex-direction:column;gap:8px;margin-top:12px"></div>' +
      "</div>";
    document.body.appendChild(wrap);

    var res = await window.MODBAY_PAY.create(o, payType);
    var qrEl = document.getElementById("pay-qr");
    var stEl = document.getElementById("pay-status");
    var actEl = document.getElementById("pay-actions");
    if (!qrEl) return; /* 弹窗已被关闭 */
    if (res.mode === "real") {
      window.MODBAY_PAY.renderQr(qrEl, res.codeUrl);
      stEl.textContent = "请扫码支付，正在等待到账…";
      var PCFG = window.MODBAY_PAY_CONFIG || {};
      var started = Date.now();
      payTimer = setInterval(async function () {
        if (!document.getElementById("pay-modal")) { clearInterval(payTimer); payTimer = null; return; } /* Esc/关闭后停止轮询 */
        var st = await window.MODBAY_PAY.status(id);
        if (!st) { stEl.textContent = "网关查询失败，稍后重试…"; return; }
        if (st.paid) { onPaid(id, PAY[payType]); return; }
        if (Date.now() - started > (PCFG.pollTimeoutMs || 180000)) {
          stEl.textContent = "查询超时，请稍后在订单页重新支付";
          clearInterval(payTimer);
          payTimer = null;
        }
      }, PCFG.pollIntervalMs || 2500);
    } else {
      window.MODBAY_PAY.renderQr(qrEl, "mock://" + id);
      stEl.textContent = "模拟模式：未配置支付网关或网关不可达";
      actEl.innerHTML = '<button class="btn btn-primary btn-block" data-act="pay-mock-confirm" data-id="' + id + '">模拟支付成功</button>' +
        '<span style="font-size:11px;color:var(--muted)">配置商户密钥后此按钮消失，改为真实扫码</span>';
    }
  }

  window.addEventListener("hashchange", closePayModal);
  window.addEventListener("beforeunload", closePayModal);

  window.MODBAY_VIEW_CHECKOUT = viewCheckout;
  window.MODBAY_VIEW_ORDERS = viewOrders;
  window.MODBAY_VIEW_ADMIN = viewAdmin;
})();
