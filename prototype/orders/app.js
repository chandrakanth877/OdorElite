/* OdorElite order history, spec 8.15 (TRD 16).
   One page serves both views: no params -> list, ?id= -> detail.
   All order data flows through OEStore.orders; statuses render only
   via OEUI.statusChip. Re-renders whenever oe.orders.v1 changes. */
(function () {
  "use strict";

  // keep ?id= deep links through the sign-in round-trip
  var user = OEUI.requireAuth("../orders/" + window.location.search);
  if (!user) return;

  el("acct-nav").innerHTML = OEUI.accountShell("orders");

  var main = el("orders-main");
  var crumb = el("crumb-current");
  var orderId = new URLSearchParams(window.location.search).get("id");

  var PAGE_SIZE = 10;
  var RETURN_WINDOW_MS = 30 * 86400000;

  var FILTERS = [
    { key: "all", label: "All", statuses: null },
    { key: "progress", label: "In progress", statuses: ["processing", "shipped", "out_for_delivery"] },
    { key: "delivered", label: "Delivered", statuses: ["delivered"] },
    { key: "returns", label: "Returns", statuses: null, hasReturns: true },
    { key: "canceled", label: "Canceled", statuses: ["canceled", "refunded"] }
  ];

  var state = { filter: "all", page: 1 };

  function fmtFull(ts) {
    return new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  function matches(order, f) {
    if (f.hasReturns) return !!(order.returns && order.returns.length);
    return !f.statuses || f.statuses.indexOf(order.status) !== -1;
  }

  function networkLabel(n) {
    return n === "visa" ? "Visa" : n === "mastercard" ? "Mastercard" : n === "amex" ? "Amex" : n;
  }

  /* ---------------- list view ---------------- */

  function orderCard(o) {
    var thumbs = o.lines.slice(0, 3).map(function (l) {
      return imgTag(l.img, l.brand + " " + l.name);
    }).join("");
    var extra = o.lines.length - 3;
    return (
      '<article class="ord-card">' +
        "<div>" +
          '<div class="ord-top">' +
            '<span class="ord-no"><a href="?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + "</a></span>" +
            '<span class="ord-date">Placed ' + esc(fmtFull(o.placedAt)) + "</span>" +
            OEUI.statusChip(o.status) +
          "</div>" +
          '<div class="ord-thumbs">' + thumbs +
            (extra > 0 ? '<span class="ord-more">+' + extra + " more</span>" : "") +
          "</div>" +
        "</div>" +
        '<div class="ord-side">' +
          '<span class="ord-total">' + money(o.total) + "</span>" +
          '<a class="btn btn-quiet btn-view" href="?id=' + encodeURIComponent(o.id) + '" aria-label="View order ' + esc(o.id) + '">View</a>' +
        "</div>" +
      "</article>"
    );
  }

  function renderList() {
    document.title = "Your orders | OdorElite";
    crumb.textContent = "Orders";

    var orders = OEStore.orders.get();
    var active = FILTERS.filter(function (f) { return f.key === state.filter; })[0] || FILTERS[0];
    var filtered = orders.filter(function (o) { return matches(o, active); });

    var pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    var slice = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    var tabs = FILTERS.map(function (f) {
      var n = orders.filter(function (o) { return matches(o, f); }).length;
      return (
        '<button type="button" class="ord-tab" data-filter="' + f.key + '" aria-pressed="' +
          (f.key === active.key ? "true" : "false") + '">' +
          esc(f.label) + '<span class="ord-tab-n">' + n + "</span>" +
        "</button>"
      );
    }).join("");

    var body;
    if (!slice.length) {
      body =
        '<div class="ord-empty">' +
          '<span class="ord-empty-mark" aria-hidden="true"></span>' +
          "<h2>No orders here yet</h2>" +
          "<p>When you place an order that fits this view, it shows up here.</p>" +
          '<a class="btn btn-gold" href="../list/">Browse all fragrances</a>' +
        "</div>";
    } else {
      body = slice.map(orderCard).join("");
      if (filtered.length > PAGE_SIZE) {
        body +=
          '<nav class="ord-pager" aria-label="Order pages">' +
            '<button type="button" class="btn btn-quiet" data-page-dir="-1"' + (state.page <= 1 ? " disabled" : "") + ">Prev</button>" +
            '<span class="ord-pager-info">Page ' + state.page + " of " + pages + "</span>" +
            '<button type="button" class="btn btn-quiet" data-page-dir="1"' + (state.page >= pages ? " disabled" : "") + ">Next</button>" +
          "</nav>";
      }
    }

    main.innerHTML =
      '<h1 class="orders-h1">Your orders</h1>' +
      '<div class="ord-tabs" role="group" aria-label="Filter orders">' + tabs + "</div>" +
      body;
  }

  /* ---------------- detail view ---------------- */

  function lineRow(l, i, delivered) {
    return (
      '<div class="od-line">' +
        imgTag(l.img, l.brand + " " + l.name) +
        "<div>" +
          '<p class="od-line-brand">' + esc(l.brand) + "</p>" +
          '<p class="od-line-name"><a href="../pdp/?id=' + encodeURIComponent(l.id) + '">' + esc(l.name) + "</a></p>" +
          '<p class="od-line-meta">' + esc([l.conc, l.size].filter(Boolean).join(" · ")) + "</p>" +
          '<p class="od-line-meta">Qty ' + l.qty + "</p>" +
        "</div>" +
        '<div class="od-line-right">' +
          '<span class="od-line-price">' + money(l.price * l.qty) + "</span>" +
          '<span class="od-line-actions">' +
            (delivered ? '<a class="od-review" href="../pdp/?id=' + encodeURIComponent(l.id) + '">Review</a>' : "") +
            '<button type="button" class="btn-buyagain" data-buy="' + i + '">Buy again</button>' +
          "</span>" +
        "</div>" +
      "</div>"
    );
  }

  function renderDetail() {
    document.title = "Order " + orderId + " | OdorElite";
    var order = OEStore.orders.byId(orderId);
    if (!order) {
      crumb.textContent = "Orders";
      main.innerHTML = OEUI.notFound(
        "We couldn't find that order",
        "It may belong to a different account, or the link is incomplete."
      );
      return;
    }
    crumb.textContent = order.id;

    var delivered = order.status === "delivered";
    var canceledOrRefunded = order.status === "canceled" || order.status === "refunded";
    var a = order.address || {};

    var trackingHtml = "";
    if (!canceledOrRefunded && order.fulfillments && order.fulfillments.length) {
      trackingHtml =
        '<section class="card-panel od-panel"><h2>Tracking</h2>' +
          '<div class="od-track-list">' +
            order.fulfillments.map(OEUI.trackingCard).join("") +
          "</div>" +
        "</section>";
    }

    var returnsHtml = "";
    if (order.returns && order.returns.length) {
      returnsHtml =
        '<section class="card-panel od-panel"><h2>Returns</h2>' +
          order.returns.map(function (ret) {
            return (
              '<div class="od-return' + (ret.status === "canceled" ? " od-return-canceled" : "") + '">' +
                '<div class="od-return-head">' +
                  '<a href="../returns/?order=' + encodeURIComponent(order.id) + "&rma=" + encodeURIComponent(ret.id) + '">' + esc(ret.id) + "</a>" +
                  '<span class="od-return-date">Started ' + esc(fmtFull(ret.createdAt)) + "</span>" +
                  OEUI.returnChip(ret) +
                "</div>" +
                (ret.refundNote ? '<p class="tl-refund">' + esc(ret.refundNote) + "</p>" : "") +
                (ret.status === "started"
                  ? '<button type="button" class="btn btn-quiet btn-cancel-return" data-cancel-return="' + esc(ret.id) + '">Cancel return</button>'
                  : "") +
              "</div>"
            );
          }).join("") +
        "</section>";
    }

    var totalsHtml =
      '<section class="card-panel od-totals"><h2>Order total</h2>' +
        "<div><span>Subtotal</span><span>" + money(order.subtotal) + "</span></div>" +
        (order.discount ? "<div><span>Discount</span><span>-" + money(order.discount) + "</span></div>" : "") +
        "<div><span>Shipping</span><span>" + (order.shipping ? money(order.shipping) : "Free") + "</span></div>" +
        "<div><span>Tax</span><span>" + money(order.tax) + "</span></div>" +
        '<div class="od-grand"><span>Total</span><span>' + money(order.total) + "</span></div>" +
        (order.payment
          ? '<p class="od-pay">Paid with ' + esc(networkLabel(order.payment.network)) + " ••••" + esc(order.payment.last4) + "</p>"
          : "") +
      "</section>";

    var addrHtml =
      '<section class="card-panel od-addr"><h2>Shipping address</h2>' +
        "<p>" +
          esc((a.firstName || "") + " " + (a.lastName || "")) + "<br>" +
          esc(a.line1 || "") + (a.line2 ? "<br>" + esc(a.line2) : "") + "<br>" +
          esc((a.city || "") + ", " + (a.state || "") + " " + (a.postal || "")) + "<br>" +
          esc(a.country || "") + (a.phone ? "<br>" + esc(a.phone) : "") +
        "</p>" +
        '<p class="od-addr-note">Billing address matches the shipping address.</p>' +
      "</section>";

    // the 30-day return window runs from delivery, not from order placement
    var deliveredEntry = (order.timeline || []).filter(function (t) { return t.status === "delivered"; })[0];
    var deliveredAt = deliveredEntry ? deliveredEntry.at : order.placedAt;
    var returnOpen = delivered && (Date.now() - deliveredAt <= RETURN_WINDOW_MS);
    var actions = ['<button type="button" class="btn btn-gold" id="od-reorder">Reorder all</button>'];
    if (order.status === "processing") {
      actions.push('<button type="button" class="btn btn-danger" id="od-cancel">Cancel order</button>');
    }
    if (delivered) {
      var anyReturnable = order.lines.some(function (l) {
        return OEStore.orders.returnableQty(order, l.id) > 0;
      });
      if (returnOpen && anyReturnable) {
        actions.push('<a class="btn btn-quiet" href="../returns/?order=' + encodeURIComponent(order.id) + '">Start return</a>');
      } else if (!returnOpen) {
        actions.push(
          '<button type="button" class="btn btn-quiet" disabled title="Return window closed (30 days)" aria-label="Return window closed (30 days)">Start return</button>'
        );
      }
      // window open but nothing left to return: no button at all
    }

    main.innerHTML =
      '<a class="od-back" href="../orders/">&#8592; All orders</a>' +
      '<div class="od-head">' +
        '<h1 class="od-no">' + esc(order.id) + "</h1>" +
        '<span class="od-date">Placed ' + esc(fmtFull(order.placedAt)) + "</span>" +
        OEUI.statusChip(order.status) +
      "</div>" +
      '<section class="card-panel od-panel" aria-label="Order progress">' + OEUI.orderTimeline(order) + "</section>" +
      trackingHtml +
      returnsHtml +
      '<section class="card-panel od-panel"><h2>Items</h2>' +
        order.lines.map(function (l, i) { return lineRow(l, i, delivered); }).join("") +
      "</section>" +
      '<div class="od-cols">' + totalsHtml + addrHtml + "</div>" +
      '<div class="od-actions">' + actions.join("") + "</div>";
  }

  /* ---------------- confirm dialog (a11y: Escape, overlay, focus) ---------------- */

  function openConfirm(opts) {
    var prevFocus = document.activeElement;
    var ov = document.createElement("div");
    ov.className = "confirm-dialog-overlay";
    ov.innerHTML =
      '<div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="cd-title">' +
        '<h2 id="cd-title">' + esc(opts.title) + "</h2>" +
        "<p>" + esc(opts.body) + "</p>" +
        '<div class="confirm-dialog-actions">' +
          '<button type="button" class="btn btn-quiet" data-cd="keep">' + esc(opts.keepLabel) + "</button>" +
          '<button type="button" class="btn btn-danger" data-cd="confirm">' + esc(opts.confirmLabel) + "</button>" +
        "</div>" +
      "</div>";
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";

    function close() {
      document.removeEventListener("keydown", onKey, true);
      ov.remove();
      document.body.style.overflow = "";
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      } else if (e.key === "Tab") {
        var f = ov.querySelectorAll("button");
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    ov.addEventListener("click", function (e) {
      if (e.target === ov) { close(); return; }
      var b = e.target.closest("[data-cd]");
      if (!b) return;
      close();
      if (b.dataset.cd === "confirm") opts.onConfirm();
    });
    document.addEventListener("keydown", onKey, true);
    ov.querySelector('[data-cd="keep"]').focus();
  }

  /* ---------------- interactions ---------------- */

  main.addEventListener("click", function (e) {
    var tab = e.target.closest("[data-filter]");
    if (tab) {
      state.filter = tab.dataset.filter;
      state.page = 1;
      renderList();
      return;
    }
    var pager = e.target.closest("[data-page-dir]");
    if (pager && !pager.disabled) {
      state.page += Number(pager.dataset.pageDir);
      renderList();
      main.scrollIntoView({ behavior: OEUI.reducedMotion ? "auto" : "smooth", block: "start" });
      return;
    }
    var buy = e.target.closest("[data-buy]");
    if (buy) {
      var order = OEStore.orders.byId(orderId);
      var l = order && order.lines[Number(buy.dataset.buy)];
      if (!l) return;
      // Add at the snapshot price from the order line; the live listing is not
      // loaded here, so be honest that today's price may differ.
      OEStore.cart.add({ id: l.id, brand: l.brand, name: l.name, price: l.price, compareAt: l.compareAt, img: l.img, conc: l.conc, size: l.size }, 1);
      toast("Added. Note: current price may differ.");
      return;
    }
    if (e.target.closest("#od-reorder")) {
      var o = OEStore.orders.byId(orderId);
      if (!o) return;
      var count = 0;
      o.lines.forEach(function (ln) {
        OEStore.cart.add({ id: ln.id, brand: ln.brand, name: ln.name, price: ln.price, compareAt: ln.compareAt, img: ln.img, conc: ln.conc, size: ln.size }, ln.qty);
        count += ln.qty;
      });
      toast("Added " + count + (count === 1 ? " item" : " items") + " to your cart. Prices may have changed.");
      return;
    }
    var cr = e.target.closest("[data-cancel-return]");
    if (cr) {
      var rmaId = cr.dataset.cancelReturn;
      openConfirm({
        title: "Cancel this return?",
        body: "Return " + rmaId + " has not been dropped off yet. Canceling keeps the items and voids the label.",
        keepLabel: "Keep return",
        confirmLabel: "Cancel return",
        onConfirm: function () {
          if (OEStore.returns.cancel(orderId, rmaId)) toast("Return canceled");
        }
      });
      return;
    }
    if (e.target.closest("#od-cancel")) {
      var ord = OEStore.orders.byId(orderId);
      if (!ord || ord.status !== "processing") return;
      openConfirm({
        title: "Cancel this order?",
        body: "Order " + ord.id + " has not shipped yet. Canceling refunds " + money(ord.total) + " to your original payment method.",
        keepLabel: "Keep order",
        confirmLabel: "Cancel order",
        onConfirm: function () {
          OEStore.orders.updateStatus(ord.id, "canceled");
          toast("Order canceled. Your refund is on the way.");
        }
      });
    }
  });

  /* ---------------- render + live updates ---------------- */

  function render() {
    if (orderId) renderDetail();
    else renderList();
  }

  document.addEventListener("oe:state", function (e) {
    if (e.detail && e.detail.key === OEStore.KEYS.orders) render();
  });

  OEShip.reconcileAll(); // fires any due shipment events; emits oe:state on change
  render();
})();
