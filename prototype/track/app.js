/* OdorElite order status / tracking page (spec section 8.10).
   No param: lookup form with a neutral response. ?token= / ?id=:
   full status view. Unknown token/id: expired panel + lookup form. */
(function () {
  "use strict";

  var root = el("track-root");
  var crumbs = el("crumbs");
  if (!root) return;

  if (crumbs) {
    crumbs.innerHTML =
      '<a href="../home/">Home</a>' +
      '<span class="crumb-sep" aria-hidden="true">/</span>' +
      '<span class="crumb-here" aria-current="page">Track your order</span>';
  }

  var params = new URLSearchParams(window.location.search);
  var token = params.get("token");
  var orderId = params.get("id");

  /* ================= lookup form ================= */

  function lookupHtml() {
    return (
      '<section class="track-lookup" aria-labelledby="lookup-title">' +
        '<div class="page-head">' +
          '<h1 class="page-title" id="lookup-title">Track your order</h1>' +
          '<p class="page-sub">Enter your order number and the email you used at checkout.</p>' +
        "</div>" +
        '<div class="card-panel">' +
          '<form class="track-lookup-form" id="lookup-form" novalidate>' +
            '<div class="field">' +
              '<label for="lookup-order">Order number</label>' +
              '<input id="lookup-order" name="order" type="text" inputmode="text" autocomplete="off" placeholder="OE-2026-00341" required>' +
            "</div>" +
            '<div class="field">' +
              '<label for="lookup-email">Email address</label>' +
              '<input id="lookup-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>' +
            "</div>" +
            '<button class="btn btn-gold" type="submit">Email me a status link</button>' +
          "</form>" +
          '<div class="track-result" id="lookup-result" aria-live="polite" hidden></div>' +
        "</div>" +
      "</section>"
    );
  }

  function wireLookup() {
    var form = el("lookup-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var num = el("lookup-order").value.trim();
      var email = el("lookup-email").value.trim();
      var result = el("lookup-result");
      var html =
        '<p class="track-result-msg">If that order exists, we\'ve emailed a status link.</p>';

      // Demo affordance (labeled): surface a direct link when the pair matches.
      var match = num ? OEStore.orders.byId(num) : null;
      if (match && email && String(match.email).toLowerCase() === email.toLowerCase()) {
        var href = match.guestToken
          ? "../track/?token=" + encodeURIComponent(match.guestToken)
          : "../track/?id=" + encodeURIComponent(match.id);
        html +=
          '<p class="track-demo">' +
            '<span class="track-demo-badge">Demo</span>' +
            '<a href="' + esc(href) + '">Demo shortcut: view order status</a>' +
          "</p>";
      }
      result.innerHTML = html;
      result.hidden = false;
    });
  }

  /* ================= expired panel ================= */

  function renderExpired() {
    root.innerHTML =
      '<section class="track-expired">' +
        '<span class="track-expired-mark" aria-hidden="true"></span>' +
        "<h1>This link has expired</h1>" +
        "<p>Status links are time-limited for your privacy. Request a fresh one below.</p>" +
      "</section>" +
      lookupHtml();
    wireLookup();
  }

  /* ================= status view ================= */

  function trackingSection(order) {
    // no tracking section for canceled/refunded orders: an ETA card under a
    // canceled timeline would contradict the status
    if (order.status === "canceled" || order.status === "refunded") return "";
    var inner;
    if (order.fulfillments && order.fulfillments.length) {
      inner = order.fulfillments.map(function (f) { return OEUI.trackingCard(f); }).join("");
    } else {
      inner =
        '<div class="eta-card">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8Z"/>' +
            '<circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' +
          "</svg>" +
          "<div>" +
            '<p class="eta-title">Estimated delivery in 3-5 business days</p>' +
            '<p class="eta-sub">Carrier tracking appears here once your order ships.</p>' +
          "</div>" +
        "</div>";
    }
    return '<section class="track-section" aria-label="Tracking"><h2>Tracking</h2>' + inner + "</section>";
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function eventsFeed(sh, label) {
    if (!sh || !sh.events || !sh.events.length) return "";
    var rows = sh.events.slice().reverse().map(function (ev) {
      return (
        '<div class="ship-event">' +
          '<span class="ship-event-dot" aria-hidden="true"></span>' +
          '<p class="ship-event-detail">' + esc(ev.detail) +
            '<span class="ship-event-loc"> · ' + esc(ev.location) + "</span></p>" +
          '<span class="ship-event-time">' + esc(fmtTime(ev.at)) + "</span>" +
        "</div>"
      );
    }).join("");
    return (
      '<section class="track-section" aria-label="' + esc(label) + '">' +
        "<h2>" + esc(label) + "</h2>" +
        '<div class="card-panel"><div class="ship-events">' + rows + "</div></div>" +
      "</section>"
    );
  }

  function returnsSection(order) {
    var rets = order.returns || [];
    if (!rets.length) return "";
    var cards = rets.map(function (ret) {
      var labelLink = ret.status === "canceled" ? "" :
        ret.shipment.qrCode
          ? '<a class="track-link" href="' + esc(ret.shipment.labelUrl) + '">View QR code</a>'
          : '<a class="track-link" href="' + esc(ret.shipment.labelUrl) + '">View return label</a>';
      return (
        '<div class="card-panel ret-card' + (ret.status === "canceled" ? " ret-card-canceled" : "") + '">' +
          '<div class="ret-card-head">' +
            '<span class="ret-card-id">' + esc(ret.id) + "</span>" +
            OEUI.returnChip(ret) +
          "</div>" +
          OEUI.returnTimeline(ret) +
          labelLink +
        "</div>"
      );
    }).join("");
    return '<section class="track-section" aria-label="Returns"><h2>Returns</h2>' + cards + "</section>";
  }

  function shipmentDone(sh) {
    if (!sh || !sh.schedule) return true;
    return (sh.events || []).length >= sh.schedule.length;
  }

  function demoControls(order) {
    var btns = [];
    if (order.shipment && !shipmentDone(order.shipment) &&
        order.status !== "canceled" && order.status !== "refunded") {
      btns.push('<button type="button" class="btn btn-quiet" data-demo="advance">Advance one step</button>');
      btns.push('<button type="button" class="btn btn-quiet" data-demo="deliver">Deliver now</button>');
    }
    (order.returns || []).forEach(function (ret) {
      if (ret.status === "canceled" || ret.status === "refunded" || shipmentDone(ret.shipment)) return;
      btns.push('<button type="button" class="btn btn-quiet" data-demo-ret="' + esc(ret.id) + '">Advance return ' + esc(ret.id) + "</button>");
    });
    if (!btns.length) return "";
    return (
      '<section class="demo-controls" aria-label="Demo controls">' +
        "<h2>Demo controls (prototype only)</h2>" +
        '<div class="demo-controls-row">' + btns.join("") + "</div>" +
      "</section>"
    );
  }

  function actionsSection(order) {
    var buttons = [];
    if (order.status === "delivered" && order.lines && order.lines.length) {
      buttons.push(
        '<a class="btn btn-gold" href="../pdp/?id=' + encodeURIComponent(order.lines[0].id) + '">Review ' +
          esc(order.lines[0].name) + "</a>"
      );
    }
    buttons.push(
      '<a class="btn btn-quiet" href="mailto:demo@odorelite.example?subject=' +
        encodeURIComponent("Order " + order.id) + '">Contact support</a>'
    );
    buttons.push('<a class="btn btn-quiet" href="../content/?page=returns">Returns policy</a>');
    if (order.status === "processing") {
      buttons.push('<button class="btn btn-danger" type="button" id="cancel-order">Cancel order</button>');
    }
    return (
      '<section class="track-section" aria-label="Order actions">' +
        '<h2>Need something?</h2>' +
        '<div class="track-actions">' + buttons.join("") + "</div>" +
      "</section>"
    );
  }

  function renderStatus(order) {
    root.innerHTML =
      '<header class="track-head">' +
        '<p class="track-eyebrow">Order status</p>' +
        "<h1>" + esc(order.id) + "</h1>" +
        '<div class="track-head-meta">' +
          "<span>Placed " + esc(OEUI.fmtDate(order.placedAt)) + "</span>" +
          OEUI.statusChip(order.status) +
        "</div>" +
      "</header>" +
      '<section class="track-section" aria-label="Progress">' +
        '<div class="card-panel track-timeline">' + OEUI.orderTimeline(order) + "</div>" +
      "</section>" +
      trackingSection(order) +
      eventsFeed(order.shipment, "Carrier updates") +
      returnsSection(order) +
      '<section class="track-section" aria-label="Order summary">' +
        "<h2>Summary</h2>" +
        OEUI.orderSummaryCard(order, {
          // masked until delivered per spec; delivered orders show full details
          maskEmail: order.status !== "delivered",
          maskAddress: order.status !== "delivered"
        }) +
      "</section>" +
      actionsSection(order) +
      demoControls(order) +
      (order.guest
        ? '<div class="track-claim" data-order-id="' + esc(order.id) + '">' + OEUI.claimAccountCard(order) + "</div>"
        : "");

    var cancelBtn = el("cancel-order");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () { openCancelDialog(order.id); });
    }

    root.querySelectorAll("[data-demo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var o = OEStore.orders.byId(order.id);
        if (!o || !o.shipment) return;
        if (btn.dataset.demo === "deliver") OEShip.advanceAll(o.shipment);
        else OEShip.advance(o.shipment, 1);
        OEShip.reconcile(o);
        OEStore.orders.update(o.id, o);
        renderStatus(OEStore.orders.byId(o.id));
      });
    });
    root.querySelectorAll("[data-demo-ret]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var o = OEStore.orders.byId(order.id);
        var ret = (o.returns || []).filter(function (r) { return r.id === btn.dataset.demoRet; })[0];
        if (!ret) return;
        OEShip.advance(ret.shipment, 1);
        OEShip.reconcile(o);
        OEStore.orders.update(o.id, o);
        renderStatus(OEStore.orders.byId(o.id));
      });
    });
  }

  /* ================= cancel confirm dialog ================= */

  function openCancelDialog(id) {
    var prevFocus = document.activeElement;
    var overlay = document.createElement("div");
    overlay.className = "confirm-dialog-overlay";
    overlay.innerHTML =
      '<div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="cd-title">' +
        '<h2 id="cd-title">Cancel this order?</h2>' +
        "<p>We stop it before it ships and refund your original payment method within 5-10 business days.</p>" +
        '<div class="confirm-dialog-actions">' +
          '<button class="btn btn-quiet" type="button" id="cd-keep">Keep order</button>' +
          '<button class="btn btn-danger" type="button" id="cd-confirm">Cancel order</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    function close() {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    }
    function onKey(e) {
      if (e.key === "Escape") { close(); return; }
      // focus trap: Tab cycles between the dialog's two buttons
      if (e.key === "Tab") {
        var keep = overlay.querySelector("#cd-keep");
        var confirm = overlay.querySelector("#cd-confirm");
        if (e.shiftKey && document.activeElement === keep) {
          e.preventDefault(); confirm.focus();
        } else if (!e.shiftKey && document.activeElement === confirm) {
          e.preventDefault(); keep.focus();
        } else if (!overlay.contains(document.activeElement)) {
          e.preventDefault(); keep.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector("#cd-keep").addEventListener("click", close);
    overlay.querySelector("#cd-confirm").addEventListener("click", function () {
      OEStore.orders.updateStatus(id, "canceled");
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      toast("Cancellation requested");
      var fresh = OEStore.orders.byId(id);
      if (fresh) renderStatus(fresh);
      // the cancel button is gone after re-render; land focus on the page heading
      var head = document.querySelector(".track-head h1");
      if (head) { head.setAttribute("tabindex", "-1"); head.focus({ preventScroll: true }); }
    });
    overlay.querySelector("#cd-keep").focus({ preventScroll: true });
  }

  /* ================= boot ================= */

  function reconcileAndRender(id) {
    var o = OEStore.orders.byId(id);
    if (o && OEShip.reconcile(o)) OEStore.orders.update(o.id, o);
    renderStatus(OEStore.orders.byId(id) || o);
  }

  try {
    if (token || orderId) {
      var order = token ? OEStore.orders.byToken(token) : OEStore.orders.byId(orderId);
      if (order) {
        reconcileAndRender(order.id);
        // the only polling in the prototype: lets a shipment visibly move
        // while the user watches this page (spec section 2)
        window.setInterval(function () {
          var o = token ? OEStore.orders.byToken(token) : OEStore.orders.byId(orderId);
          if (o && OEShip.reconcile(o)) {
            OEStore.orders.update(o.id, o);
            renderStatus(o);
          }
        }, 30000);
      } else {
        renderExpired();
      }
    } else {
      root.innerHTML = lookupHtml();
      wireLookup();
    }
  } catch (err) {
    // never throw to the console as an uncaught error; fall back gracefully
    root.innerHTML = lookupHtml();
    wireLookup();
  }
})();
