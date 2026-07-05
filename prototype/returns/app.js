/* OdorElite returns wizard + return status (spec 2026-07-05 section 5.5).
   ?order=<id>            -> 4-step wizard (auth required)
   ?order=<id>&rma=<id>   -> status view for an existing return
   Guests may view an existing return read-only via &token= (guestToken). */
(function () {
  "use strict";

  var root = el("returns-root");
  var crumbs = el("crumbs");
  if (!root) return;

  var params = new URLSearchParams(window.location.search);
  var orderId = params.get("order");
  var rmaId = params.get("rma");
  var token = params.get("token");

  var REASONS = [
    { key: "no_longer_needed", label: "No longer needed" },
    { key: "bought_by_mistake", label: "Bought by mistake" },
    { key: "defective", label: "Item defective or does not work" },
    { key: "damaged", label: "Damaged in shipping" },
    { key: "wrong_item", label: "Wrong item was sent" },
    { key: "not_as_described", label: "Not as described" },
    { key: "too_late", label: "Arrived too late" },
    { key: "better_price", label: "Better price available" }
  ];
  var COMMENTS_REQUIRED = { defective: true, damaged: true };
  var TAX = 1.0825;
  var DAY = 86400000;
  var RETURN_WINDOW_MS = 30 * DAY;

  if (crumbs) {
    crumbs.innerHTML =
      '<a href="../home/">Home</a>' +
      '<span class="crumb-sep" aria-hidden="true">/</span>' +
      '<a href="../orders/">Orders</a>' +
      '<span class="crumb-sep" aria-hidden="true">/</span>' +
      '<span class="crumb-here" aria-current="page">Return</span>';
  }

  var auth = OEStore.auth.get();
  var guestReadOnly = false;

  // guests may view an existing return via token; everything else needs auth
  if (!auth) {
    var tokenOrder = token ? OEStore.orders.byToken(token) : null;
    if (rmaId && tokenOrder && tokenOrder.id === orderId) {
      guestReadOnly = true;
    } else {
      var next = "../returns/" + window.location.search;
      window.location.replace("../sign-in/?next=" + encodeURIComponent(next));
      return;
    }
  }

  var order = orderId ? OEStore.orders.byId(orderId) : null;
  if (!order) {
    root.innerHTML = OEUI.notFound(
      "We couldn't find that order",
      "It may belong to a different account, or the link is incomplete."
    );
    return;
  }
  if (window.OEShip && OEShip.reconcile(order)) OEStore.orders.update(order.id, order);

  function fmtFull(ts) {
    return new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  function fmtTime(ts) {
    return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function networkLabel(n) {
    return n === "visa" ? "Visa" : n === "mastercard" ? "Mastercard" : n === "amex" ? "Amex" : n;
  }

  var deliveredEntry = (order.timeline || []).filter(function (t) { return t.status === "delivered"; })[0];
  var deliveredAt = deliveredEntry ? deliveredEntry.at : order.placedAt;

  function ineligiblePanel(title, body) {
    root.innerHTML =
      '<section class="ret-block card-panel">' +
        "<h1>" + esc(title) + "</h1>" +
        "<p>" + esc(body) + "</p>" +
        '<a class="btn btn-gold" href="../orders/?id=' + encodeURIComponent(order.id) + '">Back to order</a>' +
      "</section>";
  }

  /* ================= wizard ================= */

  var state = { step: 1, lines: {}, reason: null, comments: "", method: null };

  function eligibleLines() {
    return order.lines.map(function (l) {
      return { line: l, avail: OEStore.orders.returnableQty(order, l.id) };
    });
  }

  function refundAmount() {
    var sum = 0;
    Object.keys(state.lines).forEach(function (id) {
      var l = order.lines.filter(function (x) { return String(x.id) === String(id); })[0];
      if (l) sum += l.price * state.lines[id];
    });
    return Math.round(sum * TAX * 100) / 100;
  }

  function selectedCount() {
    return Object.keys(state.lines).length;
  }

  function stepHead(n, title, summary) {
    var stateCls = state.step === n ? "" : state.step > n ? " done" : " locked";
    return (
      '<div class="ret-step-head">' +
        '<span class="ret-step-num" aria-hidden="true">' + n + "</span>" +
        "<h2>" + esc(title) + "</h2>" +
        (state.step > n ? '<button type="button" class="ret-step-edit" data-edit="' + n + '">Edit</button>' : "") +
      "</div>" +
      (state.step > n && summary ? '<p class="ret-step-summary">' + summary + "</p>" : "")
    );
  }

  function itemsBody() {
    var rows = eligibleLines().map(function (e) {
      var l = e.line;
      if (!e.avail) {
        return (
          '<div class="ret-item exhausted">' +
            '<span></span>' + imgTag(l.img, l.brand + " " + l.name) +
            '<div><p class="ret-item-name">' + esc(l.brand) + " " + esc(l.name) + "</p>" +
            '<p class="ret-item-meta">Already returned</p></div><span></span>' +
          "</div>"
        );
      }
      var qty = state.lines[l.id] || 0;
      var checked = qty > 0;
      return (
        '<div class="ret-item">' +
          '<input type="checkbox" id="ri-' + l.id + '" data-ret-check="' + l.id + '"' + (checked ? " checked" : "") +
            ' aria-label="Return ' + esc(l.brand + " " + l.name) + '">' +
          imgTag(l.img, l.brand + " " + l.name) +
          "<div>" +
            '<p class="ret-item-name"><label for="ri-' + l.id + '">' + esc(l.brand) + " " + esc(l.name) + "</label></p>" +
            '<p class="ret-item-meta">' + esc([l.conc, l.size].filter(Boolean).join(" · ")) + " · " + money(l.price) + "</p>" +
          "</div>" +
          '<span class="ret-qty"' + (checked ? "" : " hidden") + ">" +
            '<button type="button" data-qty="-1" data-line="' + l.id + '" aria-label="Decrease quantity"' + (qty <= 1 ? " disabled" : "") + ">&minus;</button>" +
            '<span aria-live="polite">' + qty + "</span>" +
            '<button type="button" data-qty="1" data-line="' + l.id + '" aria-label="Increase quantity"' + (qty >= e.avail ? " disabled" : "") + ">+</button>" +
          "</span>" +
        "</div>"
      );
    }).join("");
    return (
      '<div class="ret-step-body">' + rows +
        '<button type="button" class="btn btn-gold ret-continue" data-next="2"' + (selectedCount() ? "" : " disabled") + ">Continue</button>" +
      "</div>"
    );
  }

  function reasonBody() {
    var radios = REASONS.map(function (r) {
      var checked = state.reason && state.reason.key === r.key;
      return (
        '<label class="ret-reason">' +
          '<input type="radio" name="ret-reason" value="' + r.key + '"' + (checked ? " checked" : "") + ">" +
          "<span>" + esc(r.label) + "</span>" +
        "</label>"
      );
    }).join("");
    return (
      '<div class="ret-step-body">' +
        '<div role="radiogroup" aria-label="Reason for return">' + radios + "</div>" +
        '<div class="field">' +
          '<label for="ret-comments">Tell us more</label>' +
          '<textarea id="ret-comments" rows="3">' + esc(state.comments) + "</textarea>" +
          '<p class="field-hint">Required for defective or damaged items (at least 20 characters).</p>' +
          '<p class="field-error" id="ret-reason-err" hidden></p>' +
        "</div>" +
        '<button type="button" class="btn btn-gold ret-continue" data-next="3">Continue</button>' +
      "</div>"
    );
  }

  function methodBody() {
    function card(key, title, body) {
      var sel = state.method === key;
      return (
        '<button type="button" class="ret-method-card" role="radio" aria-checked="' + (sel ? "true" : "false") + '" data-method="' + key + '">' +
          "<h3>" + esc(title) + "</h3><p>" + esc(body) + "</p>" +
        "</button>"
      );
    }
    return (
      '<div class="ret-step-body">' +
        '<div class="ret-method" role="radiogroup" aria-label="Return method">' +
          card("dropoff", "Drop off with QR code", "No box, no label, no tape. Show the QR at any drop-off point. Refund issued when your drop-off is scanned.") +
          card("mail", "Return by mail", "Prepaid UPS label to print. Refund issued when we receive your item.") +
        "</div>" +
        '<button type="button" class="btn btn-gold ret-continue" data-next="4"' + (state.method ? "" : " disabled") + ">Continue</button>" +
      "</div>"
    );
  }

  function reviewBody() {
    var items = Object.keys(state.lines).map(function (id) {
      var l = order.lines.filter(function (x) { return String(x.id) === String(id); })[0];
      return esc(l.brand + " " + l.name) + " × " + state.lines[id];
    }).join("<br>");
    var pay = order.payment || { network: "visa", last4: "4242" };
    return (
      '<div class="ret-step-body">' +
        '<dl class="ret-review">' +
          "<dt>Items</dt><dd>" + items + "</dd>" +
          "<dt>Reason</dt><dd>" + esc(state.reason.label) +
            (state.comments.trim() ? '<br><span class="ret-item-meta">' + esc(state.comments.trim()) + "</span>" : "") + "</dd>" +
          "<dt>Method</dt><dd>" + (state.method === "dropoff" ? "Drop off with QR code" : "Return by mail (prepaid UPS label)") + "</dd>" +
          "<dt>Refund</dt><dd>" + money(refundAmount()) + " to " + esc(networkLabel(pay.network)) + " ••••" + esc(pay.last4) +
            ", 5-10 business days after refund is issued</dd>" +
          "<dt>Deadline</dt><dd>Return by " + esc(fmtFull(deliveredAt + RETURN_WINDOW_MS)) + "</dd>" +
        "</dl>" +
        '<button type="button" class="btn btn-gold ret-continue" id="ret-submit">Submit return</button>' +
      "</div>"
    );
  }

  function stepSummary(n) {
    if (n === 1) {
      var c = 0;
      Object.keys(state.lines).forEach(function (id) { c += state.lines[id]; });
      return c + (c === 1 ? " item" : " items") + " selected";
    }
    if (n === 2) return state.reason ? esc(state.reason.label) : "";
    if (n === 3) return state.method === "dropoff" ? "Drop off with QR code" : "Return by mail";
    return "";
  }

  function renderWizard() {
    document.title = "Start a return | OdorElite";
    var steps = [
      { n: 1, title: "What are you returning?", body: itemsBody },
      { n: 2, title: "Why are you returning it?", body: reasonBody },
      { n: 3, title: "How do you want to return it?", body: methodBody },
      { n: 4, title: "Review and submit", body: reviewBody }
    ];
    root.innerHTML =
      '<header class="ret-head">' +
        '<p class="ret-eyebrow">Order ' + esc(order.id) + "</p>" +
        "<h1>Start a return</h1>" +
        '<p class="ret-sub">Return by ' + esc(fmtFull(deliveredAt + RETURN_WINDOW_MS)) + ". Refunds go back to your original payment method.</p>" +
      "</header>" +
      steps.map(function (s) {
        return (
          '<section class="ret-step card-panel' + (state.step === s.n ? " active" : state.step > s.n ? " done" : " locked") + '">' +
            stepHead(s.n, s.title, stepSummary(s.n)) +
            (state.step === s.n ? s.body() : "") +
          "</section>"
        );
      }).join("");
    wireWizard();
  }

  function wireWizard() {
    root.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.step = Number(btn.dataset.edit);
        renderWizard();
      });
    });
    root.querySelectorAll("[data-ret-check]").forEach(function (box) {
      box.addEventListener("change", function () {
        var id = box.dataset.retCheck;
        if (box.checked) state.lines[id] = 1;
        else delete state.lines[id];
        renderWizard();
      });
    });
    root.querySelectorAll("[data-qty]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.line;
        var lineAvail = OEStore.orders.returnableQty(order, isNaN(Number(id)) ? id : Number(id));
        var next = (state.lines[id] || 1) + Number(btn.dataset.qty);
        state.lines[id] = Math.max(1, Math.min(lineAvail, next));
        renderWizard();
      });
    });
    root.querySelectorAll('input[name="ret-reason"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        state.reason = REASONS.filter(function (r) { return r.key === radio.value; })[0];
      });
    });
    var comments = el("ret-comments");
    if (comments) {
      comments.addEventListener("input", function () { state.comments = comments.value; });
    }
    root.querySelectorAll("[data-method]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.method = btn.dataset.method;
        renderWizard();
      });
    });
    root.querySelectorAll("[data-next]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = Number(btn.dataset.next);
        if (next === 2 && !selectedCount()) return;
        if (next === 3) {
          var err = el("ret-reason-err");
          if (!state.reason) {
            err.textContent = "Pick a reason for your return.";
            err.hidden = false;
            return;
          }
          if (COMMENTS_REQUIRED[state.reason.key] && state.comments.trim().length < 20) {
            err.textContent = "Tell us a bit more (at least 20 characters) so we can make it right.";
            err.hidden = false;
            return;
          }
        }
        if (next === 4 && !state.method) return;
        state.step = next;
        renderWizard();
      });
    });
    var submit = el("ret-submit");
    if (submit) submit.addEventListener("click", submitReturn);
  }

  function submitReturn() {
    var rma = "RMA-" + String(10000 + Math.floor(Math.random() * 90000));
    var now = Date.now();
    var retLines = Object.keys(state.lines).map(function (id) {
      return { id: isNaN(Number(id)) ? id : Number(id), qty: state.lines[id] };
    });
    var pay = order.payment || { network: "visa", last4: "4242" };
    var ret = {
      id: rma,
      createdAt: now,
      returnBy: deliveredAt + RETURN_WINDOW_MS,
      lines: retLines,
      reason: state.reason,
      comments: state.comments.trim(),
      method: state.method,
      resolution: "refund",
      refund: { amount: refundAmount(), network: pay.network, last4: pay.last4, issuedAt: null },
      shipment: OEShip.buyLabel({
        orderId: order.id, isReturn: true,
        qrRequested: state.method === "dropoff", rmaId: rma,
        dest: order.address ? order.address.city + ", " + order.address.state : "New York, NY"
      }),
      status: "started",
      timeline: [{ status: "started", at: now }]
    };
    OEStore.returns.create(order.id, ret);
    order = OEStore.orders.byId(order.id);
    renderSubmitted(ret);
  }

  function renderSubmitted(ret) {
    document.title = "Return started | OdorElite";
    var dropoff = ret.method === "dropoff";
    root.innerHTML =
      '<section class="ret-done card-panel">' +
        '<p class="ret-eyebrow">Return ' + esc(ret.id) + "</p>" +
        "<h1>Return started</h1>" +
        "<p>" +
          (dropoff
            ? "No box, no label, no tape - just show the QR code at any drop-off point."
            : "Pack the items and attach the prepaid UPS label.") +
          " Your refund of " + money(ret.refund.amount) + " goes back to " +
          esc(networkLabel(ret.refund.network)) + " ••••" + esc(ret.refund.last4) + "." +
        "</p>" +
        '<p class="ret-sub">Return by ' + esc(fmtFull(ret.returnBy)) + "</p>" +
        '<a class="btn btn-gold" href="' + esc(ret.shipment.labelUrl) + '">' +
          (dropoff ? "View QR code" : "Print return label") + "</a>" +
        '<a class="btn btn-quiet" href="../returns/?order=' + encodeURIComponent(order.id) + "&rma=" + encodeURIComponent(ret.id) + '">View this return</a>' +
        '<a class="btn btn-quiet" href="../orders/?id=' + encodeURIComponent(order.id) + '">Back to order</a>' +
      "</section>";
  }

  /* ================= status view ================= */

  function shipmentDone(sh) {
    if (!sh || !sh.schedule) return true;
    return (sh.events || []).length >= sh.schedule.length;
  }

  function renderStatus() {
    var ret = (order.returns || []).filter(function (r) { return r.id === rmaId; })[0];
    if (!ret) {
      root.innerHTML = OEUI.notFound(
        "We couldn't find that return",
        "It may have been removed, or the link is incomplete."
      );
      return;
    }
    document.title = "Return " + ret.id + " | OdorElite";

    var itemsHtml = (ret.lines || []).map(function (rl) {
      var l = order.lines.filter(function (x) { return String(x.id) === String(rl.id); })[0];
      if (!l) return "";
      return (
        '<div class="ret-item">' +
          "<span></span>" + imgTag(l.img, l.brand + " " + l.name) +
          '<div><p class="ret-item-name">' + esc(l.brand) + " " + esc(l.name) + "</p>" +
          '<p class="ret-item-meta">Qty ' + rl.qty + "</p></div><span></span>" +
        "</div>"
      );
    }).join("");

    var eventsHtml = "";
    if (ret.shipment && ret.shipment.events && ret.shipment.events.length) {
      eventsHtml =
        '<h2 class="ret-h2">Carrier updates</h2><div class="ship-events">' +
          ret.shipment.events.slice().reverse().map(function (ev) {
            return (
              '<div class="ship-event">' +
                '<span class="ship-event-dot" aria-hidden="true"></span>' +
                '<p class="ship-event-detail">' + esc(ev.detail) +
                  '<span class="ship-event-loc"> · ' + esc(ev.location) + "</span></p>" +
                '<span class="ship-event-time">' + esc(fmtTime(ev.at)) + "</span>" +
              "</div>"
            );
          }).join("") +
        "</div>";
    }

    var actions = [];
    if (ret.status !== "canceled") {
      actions.push('<a class="btn btn-quiet" href="' + esc(ret.shipment.labelUrl) + '">' +
        (ret.shipment.qrCode ? "View QR code" : "View return label") + "</a>");
    }
    if (ret.status === "started" && !guestReadOnly) {
      actions.push('<button type="button" class="btn btn-danger" id="ret-cancel">Cancel return</button>');
    }

    var demoHtml = "";
    if (!guestReadOnly && ret.status !== "canceled" && ret.status !== "refunded" && !shipmentDone(ret.shipment)) {
      demoHtml =
        '<section class="demo-controls" aria-label="Demo controls">' +
          "<h2>Demo controls (prototype only)</h2>" +
          '<div class="demo-controls-row"><button type="button" class="btn btn-quiet" id="ret-advance">Advance return</button></div>' +
        "</section>";
    }

    root.innerHTML =
      '<header class="ret-head">' +
        '<p class="ret-eyebrow">Order <a href="../orders/?id=' + encodeURIComponent(order.id) + '">' + esc(order.id) + "</a></p>" +
        '<div class="ret-head-row"><h1>' + esc(ret.id) + "</h1>" + OEUI.returnChip(ret) + "</div>" +
        '<p class="ret-sub">Started ' + esc(fmtFull(ret.createdAt)) + " · Return by " + esc(fmtFull(ret.returnBy)) + "</p>" +
      "</header>" +
      '<section class="card-panel ret-block">' +
        '<h2 class="ret-h2">Items</h2>' + itemsHtml +
        '<h2 class="ret-h2">Reason</h2>' +
        "<p>" + esc(ret.reason.label) +
          (ret.comments ? '<br><span class="ret-item-meta">' + esc(ret.comments) + "</span>" : "") + "</p>" +
        '<h2 class="ret-h2">Progress</h2>' +
        OEUI.returnTimeline(ret) +
        eventsHtml +
        '<div class="ret-actions">' + actions.join("") + "</div>" +
      "</section>" +
      demoHtml;

    var cancelBtn = el("ret-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        if (OEStore.returns.cancel(order.id, ret.id)) {
          toast("Return canceled");
          order = OEStore.orders.byId(order.id);
          renderStatus();
        }
      });
    }
    var advBtn = el("ret-advance");
    if (advBtn) {
      advBtn.addEventListener("click", function () {
        var o = OEStore.orders.byId(order.id);
        var r = (o.returns || []).filter(function (x) { return x.id === ret.id; })[0];
        if (!r) return;
        OEShip.advance(r.shipment, 1);
        OEShip.reconcile(o);
        OEStore.orders.update(o.id, o);
        order = OEStore.orders.byId(order.id);
        renderStatus();
      });
    }
  }

  /* ================= boot ================= */

  if (rmaId) {
    renderStatus();
    return;
  }

  // wizard guards (spec 6)
  if (order.status !== "delivered") {
    ineligiblePanel("This order is not eligible for a return", "Returns open once an order is delivered.");
    return;
  }
  if (Date.now() - deliveredAt > RETURN_WINDOW_MS) {
    ineligiblePanel("The return window has closed", "Returns are accepted for 30 days after delivery.");
    return;
  }
  if (!order.lines.some(function (l) { return OEStore.orders.returnableQty(order, l.id) > 0; })) {
    ineligiblePanel("Everything here has already been returned", "There is nothing left to return on this order.");
    return;
  }
  renderWizard();
})();
