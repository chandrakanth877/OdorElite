/* OEShip - simulated shipping partner for the OdorElite prototype.
   Shaped like Shippo/EasyPost: rates -> buy label -> tracking events.
   No network calls. A deterministic event schedule is stamped at label
   purchase; reconcile() lazily appends due events (the webhook analogue).
   Contract: docs/superpowers/specs/2026-07-05-odorelite-returns-shipping-design.md */
(function () {
  "use strict";

  var MIN = 60000;
  var DAY = 86400000;

  var CARRIERS = {
    standard: { carrier: "USPS", service: "Ground Advantage" },
    express: { carrier: "UPS", service: "2nd Day Air" },
    overnight: { carrier: "FedEx", service: "Priority Overnight" }
  };

  var HUBS = {
    USPS: ["Jamaica, NY", "Kearny, NJ", "Springfield, MA"],
    UPS: ["Secaucus, NJ", "Louisville, KY", "Parsippany, NJ"],
    FedEx: ["Memphis, TN", "Newark, NJ", "Hartford, CT"]
  };

  function hash31(str) {
    var s = String(str), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003;
    return h;
  }

  // deterministic digit string of length n from a seed string
  function digits(seed, n) {
    var out = "", h = hash31(seed), i = 0;
    while (out.length < n) {
      h = (h * 31 + 17 + i) % 1000003;
      out += String(h % 10);
      i++;
    }
    return out;
  }

  function trackingNumber(carrier, seed) {
    if (carrier === "USPS") return "9400" + digits(seed, 18); // 22 digits
    if (carrier === "UPS") return "1ZOE" + digits(seed, 12);
    return digits(seed, 12); // FedEx
  }

  function hub(carrier, seed) {
    var pool = HUBS[carrier];
    return pool[hash31(seed) % pool.length];
  }

  function outboundSchedule(carrier, speed, dest, base, seed) {
    var offs = speed === "overnight" ? [0, 1, 2, 4, 6] : [0, 2, 4, 7, 10];
    return [
      { status: "pre_transit", detail: "Shipping label created", location: "Edison, NJ", at: base + offs[0] * MIN },
      { status: "in_transit", detail: "Picked up by " + carrier, location: hub(carrier, seed), at: base + offs[1] * MIN },
      { status: "in_transit", detail: "Departed facility", location: hub(carrier, seed + ":2"), at: base + offs[2] * MIN },
      { status: "out_for_delivery", detail: "Out for delivery", location: dest, at: base + offs[3] * MIN },
      { status: "delivered", detail: "Delivered", location: dest, at: base + offs[4] * MIN }
    ];
  }

  function returnSchedule(qr, origin, base) {
    return [
      {
        status: "pre_transit",
        detail: qr ? "Return QR code created" : "Return label created",
        location: origin, at: base
      },
      qr
        ? { status: "in_transit", detail: "Dropped off - package scanned at The UPS Store", location: origin, at: base + 3 * MIN }
        : { status: "in_transit", detail: "Picked up by UPS", location: origin, at: base + 3 * MIN },
      { status: "delivered", detail: "Received at OdorElite returns center", location: "Edison, NJ", at: base + 8 * MIN }
    ];
  }

  function getRates() {
    return [
      { key: "standard", carrier: "USPS", service: "Ground Advantage", amount: 6.95, estDays: "3-5 business days" },
      { key: "express", carrier: "UPS", service: "2nd Day Air", amount: 14.95, estDays: "2 business days" },
      { key: "overnight", carrier: "FedEx", service: "Priority Overnight", amount: 24.95, estDays: "Next business day" }
    ];
  }

  function buyLabel(opts) {
    var isReturn = !!opts.isReturn;
    var cfg = isReturn
      ? { carrier: "UPS", service: "Ground (prepaid return)" }
      : CARRIERS[opts.speed] || CARRIERS.standard;
    var now = opts.now || Date.now();
    var seed = opts.orderId + (isReturn ? ":" + (opts.rmaId || "ret") : ":out");
    var dest = opts.dest || "New York, NY";
    var etaDays = opts.speed === "overnight" ? 1 : opts.speed === "express" ? 2 : 3 + hash31(opts.orderId) % 3;
    return {
      carrier: cfg.carrier,
      service: cfg.service,
      trackingNumber: trackingNumber(cfg.carrier, seed),
      labelUrl: "../label/?order=" + encodeURIComponent(opts.orderId) +
        (isReturn ? "&rma=" + encodeURIComponent(opts.rmaId || "") : ""),
      qrCode: !!opts.qrRequested,
      isReturn: isReturn,
      eta: isReturn ? null : now + etaDays * DAY,
      status: "pre_transit",
      schedule: isReturn
        ? returnSchedule(!!opts.qrRequested, dest, now)
        : outboundSchedule(cfg.carrier, opts.speed || "standard", dest, now, seed),
      events: []
    };
  }

  /* ---------------- reconcile ---------------- */

  function evKey(e) { return e.status + "|" + e.detail; }

  // append due schedule entries not already in events; returns the fired list
  function fireDue(sh, now) {
    if (!sh || !sh.schedule) return [];
    sh.events = sh.events || [];
    var have = {};
    sh.events.forEach(function (e) { have[evKey(e)] = true; });
    var fired = [];
    sh.schedule.forEach(function (ev) {
      if (ev.at <= now && !have[evKey(ev)]) {
        sh.events.push(ev);
        have[evKey(ev)] = true;
        fired.push(ev);
      }
    });
    if (sh.events.length) sh.status = sh.events[sh.events.length - 1].status;
    return fired;
  }

  var ORDER_STATUS_FOR = { in_transit: "shipped", out_for_delivery: "out_for_delivery", delivered: "delivered" };

  // idempotent: appends only if the status is not already in the timeline
  function pushTimeline(rec, status, at) {
    rec.timeline = rec.timeline || [];
    if (rec.timeline.some(function (t) { return t.status === status; })) return false;
    rec.timeline.push({ status: status, at: at });
    return true;
  }

  function networkLabel(n) {
    return n === "visa" ? "Visa" : n === "mastercard" ? "Mastercard" : n === "amex" ? "Amex" : n;
  }

  function issueRefund(ret, at) {
    if (ret.refund.issuedAt) return;
    ret.refund.issuedAt = at;
    ret.status = "refunded";
    pushTimeline(ret, "refunded", at);
    ret.refundNote = "Refund of $" + ret.refund.amount.toFixed(2) + " issued to " +
      networkLabel(ret.refund.network) + " ••••" + ret.refund.last4 +
      ". Allow 5-10 business days.";
  }

  function reconcile(order) {
    if (!order) return false;
    var now = Date.now();
    var changed = false;

    // outbound: never reconcile canceled/refunded orders (spec 3.5)
    if (order.status !== "canceled" && order.status !== "refunded" && order.shipment) {
      var fired = fireDue(order.shipment, now);
      if (fired.length) changed = true;
      fired.forEach(function (ev) {
        var st = ORDER_STATUS_FOR[ev.status];
        if (!st) return;
        if (pushTimeline(order, st, ev.at)) order.status = st;
        if (ev.status === "in_transit" && !(order.fulfillments || []).length) {
          order.fulfillments = [{
            carrier: order.shipment.carrier,
            tracking: order.shipment.trackingNumber,
            url: order.guestToken
              ? "../track/?token=" + encodeURIComponent(order.guestToken)
              : "../track/?id=" + encodeURIComponent(order.id)
          }];
        }
      });
    }

    (order.returns || []).forEach(function (ret) {
      if (ret.status === "canceled") return;
      var f = fireDue(ret.shipment, now);
      if (f.length) changed = true;
      f.forEach(function (ev) {
        if (ev.status === "in_transit") {
          if (pushTimeline(ret, "in_transit", ev.at) && ret.status === "started") ret.status = "in_transit";
          // QR drop-off refunds at first scan (Amazon pattern, spec 3.5)
          if (ret.shipment.qrCode) issueRefund(ret, ev.at);
        }
        if (ev.status === "delivered") {
          if (pushTimeline(ret, "received", ev.at) && ret.status !== "refunded") ret.status = "received";
          if (!ret.shipment.qrCode) issueRefund(ret, ev.at);
        }
      });
    });

    return changed;
  }

  function reconcileAll() {
    if (!window.OEStore) return false;
    var any = false;
    window.OEStore.orders.get().forEach(function (o) {
      if (reconcile(o)) {
        window.OEStore.orders.update(o.id, o);
        any = true;
      }
    });
    return any;
  }

  /* ---------------- demo controls (magic-tracking-number analogue) ---------------- */

  function advance(sh, n) {
    if (!sh || !sh.schedule) return;
    n = n || 1;
    var have = {};
    (sh.events || []).forEach(function (e) { have[evKey(e)] = true; });
    var now = Date.now(), moved = 0;
    for (var i = 0; i < sh.schedule.length && moved < n; i++) {
      var ev = sh.schedule[i];
      if (!have[evKey(ev)]) {
        // keep firing order: earlier pulled events land further in the past
        ev.at = Math.min(ev.at, now - (n - moved) * 1000);
        moved++;
      }
    }
  }

  function advanceAll(sh) {
    advance(sh, sh && sh.schedule ? sh.schedule.length : 0);
  }

  window.OEShip = {
    getRates: getRates,
    buyLabel: buyLabel,
    reconcile: reconcile,
    reconcileAll: reconcileAll,
    advance: advance,
    advanceAll: advanceAll
  };
})();
