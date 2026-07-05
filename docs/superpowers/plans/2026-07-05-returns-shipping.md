# Returns Flow + Simulated Shipping Partner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simulated shipping partner (label at order placement, live tracking events) and a full returns wizard (items → reason → method → confirmation → refund) to the OdorElite prototype.

**Architecture:** New `window.OEShip` module (Shippo/EasyPost-shaped, ES5 IIFE like `store.js`) stamps a deterministic event schedule at label purchase; `OEShip.reconcile(order)` lazily appends due events whenever a page reads an order (the webhook analogue). No timers except a 30s interval on the track page. Demo buttons shift schedule timestamps into the past. Returns live as `order.returns[]` records with their own shipments and timelines.

**Tech Stack:** Standalone HTML/CSS/ES5 JS, no build step. localStorage via `OEStore`. Served with `python3 -m http.server 8931` from the repo root. Browser verification via Playwright MCP or Chrome; module logic verified with `node -e` harnesses.

**Spec:** `docs/superpowers/specs/2026-07-05-odorelite-returns-shipping-design.md` — read it before starting; section numbers below refer to it.

## Global Constraints

- ES5 only in `prototype/` JS (IIFEs, `var`, no arrow functions, no template literals) — matches every existing file.
- No em-dashes in any visible copy. Use "-" or rephrase.
- Never commit `downloaded-images/` or `enriched-products.json` (they stay untracked).
- Demo persona is Ava Laurent, `ava@example.com`. Never use a real email. Card data is network + last4 only.
- Statuses lowercase: shipment `pre_transit | in_transit | out_for_delivery | delivered`; return `started | in_transit | received | refunded | canceled`.
- Refund math: `round(sum(price*qty) * 1.0825 * 100)/100`. Shipping is not refunded. Discounts ignored (documented simplification).
- Return window: 30 days from the `delivered` timeline entry (existing `RETURN_WINDOW_MS` logic in `prototype/orders/app.js:19`).
- Refund copy pattern (bullets are `•`): `Refund of $X.XX issued to Visa ••••4242. Allow 5-10 business days.`
- All new interactive elements: real `<button>`/`<a>` with labels, WCAG AA contrast (reuse existing `chip-*` classes and `--oe-*` tokens; small gold/accent text uses `--oe-gold-text`/`--oe-accent-text`).
- Elements toggled via JS `hidden` must work with the existing global `[hidden]` CSS guard (shared.css already has it; don't add competing `display` rules on hidden-toggled elements).
- Commit after every task. Zero console errors on every touched page.

---

### Task 1: `OEShip` module + load order

**Files:**
- Create: `prototype/shared/shipping.js`
- Modify: every `prototype/*/index.html` (19 files) — add a `shipping.js` script tag immediately BEFORE the `store.js` tag (Task 2 makes seeds depend on `OEShip`, and `store.js` seeds at load time, so shipping.js must load first on every page).

**Interfaces (produces — later tasks rely on these exact signatures):**
- `OEShip.getRates()` → `[{key, carrier, service, amount, estDays}]`
- `OEShip.buyLabel({orderId, speed, isReturn, qrRequested, rmaId, dest, now})` → shipment object (spec 3.3). `now` (ms) defaults to `Date.now()`; seeds pass past values. `dest` like `"New York, NY"`.
- `OEShip.reconcile(order)` → `true` if anything changed (caller persists). Mutates `order.shipment`, `order.returns[i]`, `order.status`, `order.timeline`, `order.fulfillments`, `ret.refund/refundNote`.
- `OEShip.reconcileAll()` → reconciles every stored order, persists changed ones via `OEStore.orders.update(o.id, o)`, returns `true` if any changed.
- `OEShip.advance(shipment, n)` / `OEShip.advanceAll(shipment)` — pull next n (or all) unfired schedule events into the past. Caller reconciles after.

- [ ] **Step 1: Write `prototype/shared/shipping.js`**

```js
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
```

- [ ] **Step 2: Verify the module in node**

Run from the repo root:

```bash
node -e '
global.window = {};
require("./prototype/shared/shipping.js");
var S = window.OEShip;
var past = Date.now() - 11 * 60000;
var sh = S.buyLabel({ orderId: "OE-2026-99999", speed: "express", now: past });
console.assert(sh.carrier === "UPS" && /^1ZOE\d{12}$/.test(sh.trackingNumber), "UPS tracking format: " + sh.trackingNumber);
var sh2 = S.buyLabel({ orderId: "OE-2026-99999", speed: "standard", now: past });
console.assert(/^9400\d{18}$/.test(sh2.trackingNumber), "USPS tracking format: " + sh2.trackingNumber);
var order = { id: "OE-2026-99999", status: "processing", timeline: [{ status: "processing", at: past }], fulfillments: [], shipment: sh };
console.assert(S.reconcile(order) === true, "reconcile reports change");
console.assert(order.status === "delivered", "order delivered, got " + order.status);
console.assert(sh.events.length === 5, "5 events, got " + sh.events.length);
console.assert(order.fulfillments.length === 1 && order.fulfillments[0].tracking === sh.trackingNumber, "fulfillments populated");
console.assert(S.reconcile(order) === false, "second reconcile is a no-op");
var ret = { id: "RMA-1", status: "started", method: "dropoff", timeline: [{ status: "started", at: past }],
  refund: { amount: 40.05, network: "visa", last4: "4242", issuedAt: null },
  shipment: S.buyLabel({ orderId: "OE-2026-99999", isReturn: true, qrRequested: true, rmaId: "RMA-1", now: past }) };
var o2 = { id: "OE-2026-99999", status: "delivered", timeline: [], returns: [ret] };
S.reconcile(o2);
console.assert(ret.status === "refunded" && ret.refund.issuedAt, "QR return refunded at scan");
console.assert(ret.refundNote.indexOf("Refund of $40.05 issued to Visa") === 0, "refund copy: " + ret.refundNote);
var fresh = { id: "OE-X", status: "delivered", timeline: [], returns: [{ id: "RMA-2", status: "started", method: "mail",
  timeline: [{ status: "started", at: Date.now() }], refund: { amount: 10, network: "visa", last4: "4242", issuedAt: null },
  shipment: S.buyLabel({ orderId: "OE-X", isReturn: true, rmaId: "RMA-2" }) }] };
S.reconcile(fresh);
console.assert(fresh.returns[0].status === "started", "future mail return untouched");
S.advanceAll(fresh.returns[0].shipment);
S.reconcile(fresh);
console.assert(fresh.returns[0].status === "refunded", "advanceAll + reconcile -> refunded (mail refunds at received)");
console.log("OK");
'
```

Expected: `OK` and no assertion output.

- [ ] **Step 3: Add the script tag to all 19 pages**

```bash
cd prototype
for f in */index.html; do
  grep -q 'shared/shipping.js' "$f" && continue
  perl -pi -e 's|(<script src="\.\./shared/store\.js"></script>)|<script src="../shared/shipping.js"></script>\n$1|' "$f"
done
grep -L 'shared/shipping.js' */index.html
```

Expected: the final `grep -L` prints nothing (every page now loads shipping.js).

- [ ] **Step 4: Browser smoke**

Serve (`python3 -m http.server 8931` from repo root if not running), open `http://localhost:8931/prototype/home/`. Console: `typeof OEShip` → `"object"`, zero errors.

- [ ] **Step 5: Commit**

```bash
git add prototype/shared/shipping.js prototype/*/index.html
git commit -m "feat: add OEShip simulated shipping partner module"
```

---

### Task 2: Store - returns API, returnableQty, seeds v2

**Files:**
- Modify: `prototype/shared/store.js`

**Interfaces:**
- Consumes: `OEShip.buyLabel`, `OEShip.reconcile` (Task 1).
- Produces: `OEStore.returns.create(orderId, ret)` → ret or null; `OEStore.returns.cancel(orderId, rmaId)` → boolean (only while `started`); `OEStore.orders.returnableQty(order, lineId)` → number. Seed flag value `"2"`. Seeded `OE-2026-00297` has one refunded return `RMA-84213` (line: Lalique L'Amour, qty 1, QR drop-off).

- [ ] **Step 1: seedOrder builds real shipments**

In `seedOrder` (store.js:95), replace the block from `if (status !== "processing" && status !== "canceled") {` through the `if (status === "canceled")` block's end (lines 111-125) with:

```js
    if (status !== "canceled" && window.OEShip) {
      // schedule base positions the seed so its status holds (spec 4):
      // processing = starts moving live; shipped = next event ~2 min out;
      // delivered/out_for_delivery = full history already due
      var base = status === "processing" ? Date.now()
        : status === "shipped" ? Date.now() - 2 * MINUTE
        : placed;
      order.shipment = OEShip.buyLabel({
        orderId: id, speed: opts.speed || "standard", dest: "New York, NY", now: base
      });
    }
    if (status !== "processing" && status !== "canceled") {
      timeline.push({ status: "shipped", at: placed + 1 * DAY });
      order.fulfillments = order.shipment
        ? [{ carrier: order.shipment.carrier, tracking: order.shipment.trackingNumber, url: "../track/?id=" + id }]
        : [{ carrier: "UPS", tracking: "1Z999AA10123456784", url: "#" }];
    }
    if (status === "out_for_delivery" || status === "delivered") {
      timeline.push({ status: "out_for_delivery", at: placed + 3 * DAY });
    }
    if (status === "delivered") {
      timeline.push({ status: "delivered", at: placed + 4 * DAY });
    }
    if (status === "canceled") {
      timeline.push({ status: "canceled", at: placed + 0.2 * DAY });
      order.refundNote = "Refund of $" + t.total.toFixed(2) + " issued to Visa ••••4242. Allow 5-10 business days.";
    }
    if (order.shipment && window.OEShip) OEShip.reconcile(order);
    return order;
```

Add `var MINUTE = 60000;` next to `var DAY = 86400000;` (store.js:17). Note: `OEShip.reconcile` appends timeline entries only for statuses not already present, so the seeded day-based timeline entries win and the seed's declared status holds.

- [ ] **Step 2: Seed the express speed + the completed return, bump the flag**

In `seed()` (store.js:128):
- Change the guard to `if (read(KEYS.seeded, null) === "2") return;` and the final write to `write(KEYS.seeded, "2");`
- On the `OE-2026-00314` seed line, add `speed: "express"` to its opts object and delete `tracking: "1Z999AA10198217643"` (tracking now comes from the shipment).
- Replace the single `write(KEYS.orders, [...])` call so the delivered order gets its return first:

```js
    var d297 = seedOrder("OE-2026-00297", 12, "delivered",
      [line(P.oudEmerald, 1), line(P.femmeIndividuelle, 1), line(P.lamour, 1)], { shipping: 0 });
    if (window.OEShip) {
      var retAt = d297.placedAt + 5 * DAY;
      var ret297 = {
        id: "RMA-84213",
        createdAt: retAt,
        returnBy: d297.placedAt + 4 * DAY + 30 * DAY,
        lines: [{ id: P.lamour.id, qty: 1 }],
        reason: { key: "no_longer_needed", label: "No longer needed" },
        comments: "",
        method: "dropoff",
        resolution: "refund",
        refund: { amount: Math.round(P.lamour.price * 1.0825 * 100) / 100, network: "visa", last4: "4242", issuedAt: null },
        shipment: OEShip.buyLabel({ orderId: "OE-2026-00297", isReturn: true, qrRequested: true, rmaId: "RMA-84213", now: retAt }),
        status: "started",
        timeline: [{ status: "started", at: retAt }]
      };
      d297.returns = [ret297];
      OEShip.reconcile(d297); // fires scan + received -> refunded
    }
    write(KEYS.orders, [
      seedOrder("OE-2026-00341", 2, "processing", [line(P.supremacyGold, 1), line(P.sunJava, 2)]),
      seedOrder("OE-2026-00314", 6, "shipped", [line(P.gameOfSpades, 1)], { method: "Express (2 business days)", shipping: 14.95, speed: "express" }),
      d297,
      seedOrder("OE-2026-00268", 21, "canceled", [line(P.qatarKing, 1)]),
      seedOrder("OE-2026-00201", 35, "delivered", [line(P.aventureGold, 1)], { shipping: 0 })
    ]);
```

- [ ] **Step 3: Add returns API + returnableQty**

Inside the `orders:` object (after `newKey`, store.js:289), add:

```js
      returnableQty: function (order, lineId) {
        var l = (order.lines || []).filter(function (x) { return x.id === lineId; })[0];
        if (!l) return 0;
        var used = 0;
        (order.returns || []).forEach(function (r) {
          if (r.status === "canceled") return;
          (r.lines || []).forEach(function (rl) { if (rl.id === lineId) used += rl.qty; });
        });
        return Math.max(0, l.qty - used);
      }
```

After the `orders` object (sibling top-level key, before `addresses`), add:

```js
    returns: {
      create: function (orderId, ret) {
        var order = OEStore.orders.byId(orderId);
        if (!order) return null;
        OEStore.orders.update(orderId, { returns: (order.returns || []).concat([ret]) });
        return ret;
      },
      cancel: function (orderId, rmaId) {
        var order = OEStore.orders.byId(orderId);
        if (!order) return false;
        var ok = false;
        var list = (order.returns || []).map(function (r) {
          if (r.id === rmaId && r.status === "started") {
            r.status = "canceled";
            r.timeline = (r.timeline || []).concat([{ status: "canceled", at: Date.now() }]);
            ok = true;
          }
          return r;
        });
        if (ok) OEStore.orders.update(orderId, { returns: list });
        return ok;
      }
    },
```

(Note `OEStore` is referenced before the `var OEStore = ...` statement completes only at *call* time, which is fine.)

- [ ] **Step 4: Verify in node**

```bash
node -e '
var mem = {};
global.window = {
  addEventListener: function () {},
  localStorage: {
    getItem: function (k) { return k in mem ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; }
  }
};
global.document = { dispatchEvent: function () {}, addEventListener: function () {} };
global.CustomEvent = function () {};
require("./prototype/shared/shipping.js");
require("./prototype/shared/store.js");
var S = window.OEStore;
console.assert(mem["oe.seeded.v1"] === JSON.stringify("2"), "seed flag v2");
var o = S.orders.byId("OE-2026-00297");
console.assert(o.returns && o.returns.length === 1, "297 has a return");
var r = o.returns[0];
console.assert(r.id === "RMA-84213" && r.status === "refunded" && r.refund.issuedAt, "seed return refunded");
console.assert(r.refund.amount === 40.05, "refund = 37 * 1.0825 = 40.05, got " + r.refund.amount);
console.assert(S.orders.returnableQty(o, 9208683841) === 0, "lamour fully returned");
console.assert(S.orders.returnableQty(o, 7410469503169) === 1, "oudEmerald still returnable");
var shipped = S.orders.byId("OE-2026-00314");
console.assert(shipped.status === "shipped" && shipped.shipment.events.length >= 2, "shipped seed mid-flight");
console.assert(shipped.fulfillments[0].tracking === shipped.shipment.trackingNumber, "fulfillments from shipment");
var ret = { id: "RMA-1", createdAt: Date.now(), lines: [{ id: 7410469503169, qty: 1 }], status: "started", timeline: [] };
S.returns.create("OE-2026-00297", ret);
console.assert(S.orders.byId("OE-2026-00297").returns.length === 2, "create appends");
console.assert(S.returns.cancel("OE-2026-00297", "RMA-1") === true, "cancel started ok");
console.assert(S.returns.cancel("OE-2026-00297", "RMA-84213") === false, "cannot cancel refunded");
console.assert(S.orders.returnableQty(S.orders.byId("OE-2026-00297"), 7410469503169) === 1, "canceled return restores qty");
console.log("OK");
'
```

Expected: `OK`.

- [ ] **Step 5: Browser smoke**

Open `http://localhost:8931/prototype/orders/` (sign in via the demo quick-fill on sign-in page if needed). The seed flag bump reseeds automatically. OE-2026-00297 and the other seeds render, zero console errors.

- [ ] **Step 6: Commit**

```bash
git add prototype/shared/store.js
git commit -m "feat: returns store API + shipment-backed seeds (v2)"
```

---

### Task 3: Shared UI - return chips, return timeline, footer, CSS

**Files:**
- Modify: `prototype/shared/ui.js` (STATUS_META at ~line 319; exports at ~line 547)
- Modify: `prototype/shared/chrome.js` (footer copy, lines 101 and 138)
- Modify: `prototype/shared/shared.css` (append)

**Interfaces:**
- Produces: `OEUI.returnChip(ret)` → chip HTML; `OEUI.returnTimeline(ret)` → mini timeline HTML (includes `ret.refundNote` when present). Both exported on `OEUI`.
- CSS classes for later tasks: `.ship-events`, `.ship-event`, `.ship-event-dot`, `.ship-event-detail`, `.ship-event-loc`, `.ship-event-time`, `.ret-tl`, `.ret-tl-step`, `.demo-controls`.

- [ ] **Step 1: STATUS_META + helpers in ui.js**

Add to `STATUS_META` (after `refunded`):

```js
    return_started: { label: "Return started", cls: "chip-info" },
    return_in_transit: { label: "Return in transit", cls: "chip-accent" },
    return_received: { label: "Return received", cls: "chip-info" },
    refund_issued: { label: "Refunded", cls: "chip-success" }
```

Below `trackingCard` add:

```js
  var RETURN_CHIP_KEY = {
    started: "return_started",
    in_transit: "return_in_transit",
    received: "return_received",
    refunded: "refund_issued",
    canceled: "canceled"
  };

  function returnChip(ret) {
    return statusChip(RETURN_CHIP_KEY[ret.status] || ret.status);
  }

  function returnTimeline(ret) {
    var labels = {
      started: "Return started",
      in_transit: ret.method === "dropoff" ? "Dropped off" : "In transit",
      received: "Return received",
      refunded: "Refund issued",
      canceled: "Return canceled"
    };
    var entries = (ret.timeline || []).slice().sort(function (a, b) { return a.at - b.at; });
    return (
      '<div class="ret-tl">' +
        entries.map(function (t) {
          return (
            '<div class="ret-tl-step">' +
              '<span class="tl-dot"></span>' +
              '<span class="tl-label">' + esc(labels[t.status] || t.status) + "</span>" +
              '<span class="tl-date">' + fmtDate(t.at) + "</span>" +
            "</div>"
          );
        }).join("") +
      "</div>" +
      (ret.refundNote ? '<p class="tl-refund">' + esc(ret.refundNote) + "</p>" : "")
    );
  }
```

Export both on the `window.OEUI = { ... }` object: `returnChip: returnChip, returnTimeline: returnTimeline,`.

- [ ] **Step 2: Footer disclosure (both variants in chrome.js)**

Replace on both line 101 and line 138:
`Ratings, review counts and delivery dates are demo data.` →
`Ratings, review counts, delivery dates and carrier tracking events are demo data.`

- [ ] **Step 3: Append to shared.css**

```css
/* ---------------- carrier events feed (track / returns) ---------------- */
.ship-events { margin-top: 12px; }
.ship-event {
  display: grid; grid-template-columns: 10px 1fr auto; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid var(--oe-gray-200); align-items: baseline;
}
.ship-event:last-child { border-bottom: 0; }
.ship-event-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--oe-gold); position: relative; top: -1px; }
.ship-event-detail { font-size: 14px; font-weight: 600; color: var(--oe-gray-800); }
.ship-event-loc { font-size: 13px; color: var(--oe-gray-500); font-weight: 400; }
.ship-event-time { font-size: 13px; color: var(--oe-gray-500); white-space: nowrap; }

/* ---------------- return mini timeline ---------------- */
.ret-tl { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
.ret-tl-step { display: flex; gap: 8px; align-items: baseline; font-size: 14px; }
.ret-tl-step .tl-label { font-weight: 600; color: var(--oe-gray-800); }
.ret-tl-step .tl-date { font-size: 12.5px; color: var(--oe-gray-500); }

/* ---------------- demo controls (prototype only) ---------------- */
.demo-controls { border: 1px dashed var(--oe-gray-300); border-radius: 10px; padding: 14px 16px; margin-top: 24px; }
.demo-controls h2 { font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--oe-gray-500); margin: 0 0 10px; }
.demo-controls-row { display: flex; flex-wrap: wrap; gap: 8px; }
```

- [ ] **Step 4: Verify**

Open `http://localhost:8931/prototype/home/` - footer reads "...delivery dates and carrier tracking events are demo data." Console: `OEUI.returnChip({status:"refunded"})` returns a `chip-success` span labeled "Refunded". Zero errors.

- [ ] **Step 5: Commit**

```bash
git add prototype/shared/ui.js prototype/shared/chrome.js prototype/shared/shared.css
git commit -m "feat: return chips/timeline helpers, events-feed CSS, footer disclosure"
```

---

### Task 4: Checkout buys the label; confirmation shows it

**Files:**
- Modify: `prototype/checkout/app.js` (`buildOrder`, ~line 412)
- Modify: `prototype/confirmation/index.html` (~line 52) and `prototype/confirmation/app.js` (`showConfirmed`, ~line 42)
- Modify: `prototype/confirmation/styles.css` (append)

**Interfaces:**
- Consumes: `OEShip.buyLabel` (Task 1). Order shape from `buildOrder` (checkout/app.js:412).
- Produces: every new order carries `order.shipment` from placement.

- [ ] **Step 1: Attach the shipment in buildOrder**

In `buildOrder`, after `if (!auth) order.guestToken = OEStore.orders.newToken();` and before `return order;`:

```js
    order.shipment = OEShip.buyLabel({
      orderId: order.id,
      speed: state.shipping,
      dest: state.address ? state.address.city + ", " + state.address.state : "New York, NY"
    });
```

- [ ] **Step 2: Confirmation shipping card container**

In `confirmation/index.html`, directly after the line `<div id="conf-summary"><!-- js: OEUI.orderSummaryCard --></div>`, add:

```html
        <div id="conf-shipping" hidden><!-- js: shipping label card --></div>
```

- [ ] **Step 3: Render the card**

In `confirmation/app.js`, add `renderShipping();` to `showConfirmed()` (after `renderSummary();`), and add:

```js
  function renderShipping() {
    var sh = order.shipment;
    if (!sh) return; // legacy orders: card stays hidden
    var wrap = el("conf-shipping");
    var trackHref = order.guest && order.guestToken
      ? "../track/?token=" + encodeURIComponent(order.guestToken)
      : "../track/?id=" + encodeURIComponent(order.id);
    wrap.innerHTML =
      '<div class="card-panel conf-ship">' +
        '<div class="conf-ship-head">' +
          "<h2>Shipping</h2>" +
          '<span class="chip-status chip-info">Label created</span>' +
        "</div>" +
        '<p class="conf-ship-carrier">' + esc(sh.carrier) + " " + esc(sh.service) + "</p>" +
        '<p class="conf-ship-no"><a href="' + esc(trackHref) + '">' + esc(sh.trackingNumber) + "</a></p>" +
        (sh.eta ? '<p class="conf-ship-eta">Estimated delivery ' + esc(OEUI.fmtDate(sh.eta)) + "</p>" : "") +
        '<a class="conf-ship-label" href="' + esc(sh.labelUrl) + '">View shipping label</a>' +
      "</div>";
    wrap.hidden = false;
  }
```

- [ ] **Step 4: Card styles (append to confirmation/styles.css)**

```css
.conf-ship { margin-top: 16px; }
.conf-ship-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.conf-ship-head h2 { margin: 0; font-size: 17px; }
.conf-ship-carrier { font-weight: 600; color: var(--oe-gray-800); margin: 0 0 2px; }
.conf-ship-no { margin: 0 0 6px; font-size: 14px; }
.conf-ship-eta { margin: 0 0 10px; font-size: 13.5px; color: var(--oe-gray-600); }
.conf-ship-label { font-size: 13.5px; color: var(--oe-accent-text); text-decoration: underline; }
```

- [ ] **Step 5: Verify end-to-end**

Browser: add any product to cart → checkout as guest (`ava.guest@example.com` style throwaway is fine; demo card `4242 4242 4242 4242`, any future expiry, any CVC) → place order. Confirmation shows the Shipping card with carrier, tracking link, ETA, "Label created" chip, "View shipping label" link (label page 404s until Task 8 - acceptable). Console clean. In DevTools: `OEStore.orders.get()[0].shipment.schedule.length` → 5.

- [ ] **Step 6: Commit**

```bash
git add prototype/checkout/app.js prototype/confirmation/
git commit -m "feat: buy shipping label at checkout, show it on confirmation"
```

---

### Task 5: Track page - events feed, returns, demo controls, 30s interval

**Files:**
- Modify: `prototype/track/app.js`
- Modify: `prototype/track/styles.css` (append)

**Interfaces:**
- Consumes: `OEShip.reconcile/advance/advanceAll`, `OEUI.returnChip/returnTimeline`, `order.shipment`, `order.returns`.
- Produces: none consumed later.

- [ ] **Step 1: Reconcile + re-render loop**

In `track/app.js`, in the boot block, wrap status rendering with reconcile and start the interval. Replace the `if (order) { renderStatus(order); }` body with:

```js
      if (order) {
        reconcileAndRender(order.id);
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
```

And add above the boot block:

```js
  function reconcileAndRender(id) {
    var o = OEStore.orders.byId(id);
    if (o && OEShip.reconcile(o)) OEStore.orders.update(o.id, o);
    renderStatus(OEStore.orders.byId(id) || o);
  }
```

- [ ] **Step 2: Events feed + returns + demo controls sections**

Add three builder functions next to `trackingSection`:

```js
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
```

- [ ] **Step 3: Wire into renderStatus**

In `renderStatus`, after `trackingSection(order) +` insert:

```js
      eventsFeed(order.shipment, "Carrier updates") +
      returnsSection(order) +
```

and before the guest-claim ternary at the end, insert `demoControls(order) +`. Then at the bottom of `renderStatus` (after the cancel-button wiring), add:

```js
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
```

- [ ] **Step 4: Styles (append to track/styles.css)**

```css
.ret-card { margin-bottom: 14px; }
.ret-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
.ret-card-id { font-weight: 700; color: var(--oe-gray-800); }
.ret-card-canceled { opacity: 0.65; }
```

- [ ] **Step 5: Verify**

Browser, reset state first (console: `OEStore.reset()`), sign in as demo user, open `../track/?id=OE-2026-00314` (shipped seed):
- Carrier updates feed shows "Shipping label created" + "Picked up by UPS".
- Demo controls card shows "Advance one step" / "Deliver now". Click "Deliver now" → status chip flips to Delivered, timeline completes, feed shows all 5 events, demo controls disappear.
- Open `../track/?id=OE-2026-00297` → Returns section shows RMA-84213 with Refunded chip, mini timeline ending "Refund issued", refund note, "View QR code" link.
- Wait on `OE-2026-00341` (processing seed) ~2 min → it flips to shipped without reload (30s interval). Console clean throughout.

- [ ] **Step 6: Commit**

```bash
git add prototype/track/
git commit -m "feat: track page carrier events, returns cards, demo controls"
```

---

### Task 6: Orders page - reconcile, Start return link, Returns tab + section

**Files:**
- Modify: `prototype/orders/app.js`
- Modify: `prototype/orders/styles.css` (append)

**Interfaces:**
- Consumes: `OEShip.reconcileAll`, `OEStore.orders.returnableQty`, `OEStore.returns.cancel`, `OEUI.returnChip/returnTimeline`.

- [ ] **Step 1: Reconcile on load**

At the bottom of `orders/app.js`, replace the final `render();` with:

```js
  OEShip.reconcileAll(); // fires any due shipment events; emits oe:state on change
  render();
```

(The existing `oe:state` listener re-renders on the emitted change; `reconcileAll` only writes when something changed, so there is no loop.)

- [ ] **Step 2: Returns filter tab**

In `FILTERS` (line 21) add before the canceled entry:

```js
    { key: "returns", label: "Returns", statuses: null, hasReturns: true },
```

and update `matches`:

```js
  function matches(order, f) {
    if (f.hasReturns) return !!(order.returns && order.returns.length);
    return !f.statuses || f.statuses.indexOf(order.status) !== -1;
  }
```

- [ ] **Step 3: Start return link + Returns section in detail view**

In `renderDetail`, replace the delivered/returnOpen actions block (the `if (delivered) { ... }` at lines 199-210) with:

```js
    if (delivered) {
      var anyReturnable = order.lines.some(function (l) {
        return OEStore.orders.returnableQty(order, l.id) > 0;
      });
      if (returnOpen && anyReturnable) {
        actions.push('<a class="btn btn-quiet" href="../returns/?order=' + encodeURIComponent(order.id) + '">Start return</a>');
      } else if (!returnOpen) {
        actions.push('<button type="button" class="btn btn-quiet" disabled title="Return window closed (30 days)" aria-label="Return window closed (30 days)">Start return</button>');
      }
      // window open but nothing left to return: no button at all
    }
```

After the `trackingHtml` block definition, add:

```js
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
```

and render it: in the `main.innerHTML` assignment, insert `returnsHtml +` right after `trackingHtml +`.

- [ ] **Step 4: Cancel-return handler**

In the delegated `main` click handler (before the `#od-cancel` branch), add:

```js
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
```

- [ ] **Step 5: Styles (append to orders/styles.css)**

```css
.od-return { padding: 12px 0; border-bottom: 1px solid var(--oe-gray-200); }
.od-return:last-child { border-bottom: 0; }
.od-return-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
.od-return-head a { font-weight: 700; }
.od-return-date { font-size: 13px; color: var(--oe-gray-500); }
.od-return-canceled { opacity: 0.65; }
.btn-cancel-return { margin-top: 8px; }
```

- [ ] **Step 6: Verify**

Browser (signed in): `../orders/` shows a "Returns" tab with count 1 (OE-2026-00297). Open OE-2026-00297 detail: Returns section shows RMA-84213 refunded with refund note; "Start return" link present (two lines still returnable) pointing to `../returns/?order=OE-2026-00297` (404 until Task 7 - fine). OE-2026-00201 (delivered 35 days ago) shows the disabled window-closed button. Console clean.

- [ ] **Step 7: Commit**

```bash
git add prototype/orders/
git commit -m "feat: orders returns tab, returns section, cancel return, start-return link"
```

---

### Task 7: Returns wizard page (`prototype/returns/`)

**Files:**
- Create: `prototype/returns/index.html`, `prototype/returns/app.js`, `prototype/returns/styles.css`

**Interfaces:**
- Consumes: `OEStore.orders.byId/byToken/returnableQty`, `OEStore.returns.create/cancel`, `OEShip.buyLabel/reconcile/advance`, `OEUI.requireAuth/returnChip/returnTimeline/statusChip`, shared form kit (`.field`, `.btn`, `.card-panel`, `chip-*`), delegated confirm-dialog pattern (copy from orders/app.js).
- Produces: return records per spec 4 (shape consumed by Tasks 5/6 renderers).

- [ ] **Step 1: index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Start a return | OdorElite</title>
<link rel="stylesheet" href="../home/styles.css">
<link rel="stylesheet" href="../shared/shared.css">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<div id="oe-top"></div>
<main class="container returns-page">
  <nav class="crumbs" id="crumbs" aria-label="Breadcrumb"></nav>
  <div id="returns-root"></div>
</main>
<div id="oe-bottom"></div>
<script>window.OE_PAGE = { active: null };</script>
<script src="../shared/shipping.js"></script>
<script src="../shared/store.js"></script>
<script src="../shared/ui.js"></script>
<script src="../shared/chrome.js"></script>
<script src="app.js"></script>
</body>
</html>
```

(Match the crumbs/container markup of `track/index.html` if its structure differs - reuse its exact wrapper classes.)

- [ ] **Step 2: app.js**

Full page logic. Key structure (write it complete; reason list and copy are locked by the spec):

```js
/* OdorElite returns wizard + return status (spec 2026-07-05 section 5.5).
   ?order=<id>            -> 4-step wizard (auth required)
   ?order=<id>&rma=<id>   -> status view for an existing return
   guests: status view only, via &token= (guestToken) - read-only. */
(function () {
  "use strict";

  var root = el("returns-root");
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

  var order = OEStore.orders.byId(orderId);
  // ... not-found handling via OEUI.notFound, breadcrumbs, then:
  if (order && OEShip.reconcile(order)) OEStore.orders.update(order.id, order);

  if (rmaId) renderStatus(); else renderWizard();
})();
```

Wizard requirements (implement all):
- **Guards before rendering the wizard:** order exists, `order.status === "delivered"`, return window open (same `RETURN_WINDOW_MS` / delivered-timeline-entry logic as orders/app.js:191-194), and at least one line with `returnableQty > 0`. Each failed guard renders a friendly `OEUI.notFound`-style panel with a link back to the order (copy: "This order is not eligible for a return." / "The 30-day return window for this order has closed." / "Everything in this order has already been returned.").
- **State:** `{ step, lines: {id: qty}, reason: null, comments: "", method: null }`.
- **Step 1 Items:** one row per order line with `returnableQty > 0`: image (`imgTag`), brand/name, checkbox (`data-ret-check`), qty stepper (minus/plus buttons + value, capped at `returnableQty`, min 1, stepper only enabled when checked). Continue disabled until at least one checked. Lines with returnableQty 0 render grayed with "Already returned".
- **Step 2 Reason:** radio list from `REASONS` (one reason for the whole return, Walmart pattern). Comments `<textarea>` labeled "Tell us more"; hint "Required for defective or damaged items (at least 20 characters)". Continue validates: reason picked; if `COMMENTS_REQUIRED[reason.key]`, comments trimmed length >= 20 (inline `.field-error` otherwise).
- **Step 3 Method:** two selectable cards (radio semantics, `aria-checked`): "Drop off with QR code" - "No box, no label, no tape. Show the QR at any drop-off point. Refund issued when your drop-off is scanned." and "Return by mail" - "Prepaid UPS label to print. Refund issued when we receive your item."
- **Step 4 Review & submit:** selected items with qty, reason label, method, refund summary `"$X.XX to Visa ••••4242, 5-10 business days after refund is issued"` (amount = `Math.round(sum(price*qty) * TAX * 100) / 100`, network/last4 from `order.payment`), and deadline `"Return by " + fmtFull(deliveredAt + 30*DAY)`. Submit button "Submit return".
- **Accordion behavior:** completed steps collapse to a one-line summary with an Edit button (same pattern as checkout); only the active step is expanded.
- **Submit handler:**

```js
  function submitReturn() {
    var rma = "RMA-" + String(10000 + Math.floor(Math.random() * 90000));
    var now = Date.now();
    var retLines = Object.keys(state.lines).map(function (id) {
      return { id: isNaN(Number(id)) ? id : Number(id), qty: state.lines[id] };
    });
    var amount = 0;
    retLines.forEach(function (rl) {
      var l = order.lines.filter(function (x) { return String(x.id) === String(rl.id); })[0];
      if (l) amount += l.price * rl.qty;
    });
    amount = Math.round(amount * TAX * 100) / 100;
    var ret = {
      id: rma,
      createdAt: now,
      returnBy: deliveredAt + 30 * DAY,
      lines: retLines,
      reason: state.reason,               // {key, label}
      comments: state.comments.trim(),
      method: state.method,               // "dropoff" | "mail"
      resolution: "refund",
      refund: { amount: amount, network: order.payment.network, last4: order.payment.last4, issuedAt: null },
      shipment: OEShip.buyLabel({
        orderId: order.id, isReturn: true,
        qrRequested: state.method === "dropoff", rmaId: rma,
        dest: order.address ? order.address.city + ", " + order.address.state : "New York, NY"
      }),
      status: "started",
      timeline: [{ status: "started", at: now }]
    };
    OEStore.returns.create(order.id, ret);
    renderSubmitted(ret);
  }
```

- **renderSubmitted(ret):** success panel: "Return started" heading, RMA number, for dropoff a "View QR code" gold button → `ret.shipment.labelUrl`, for mail a "Print return label" gold button → same URL; what-happens-next copy ("Pack the items" for mail / "No box, no label, no tape - just show the QR" for dropoff; "Your refund of $X.XX goes back to Visa ••••4242."), "Return by <date>" line, links "View this return" (`?order=&rma=`) and "Back to order" (`../orders/?id=`).
- **renderStatus():** finds `ret` by rmaId (not-found panel if missing). Shows: heading with RMA + `OEUI.returnChip(ret)`, items being returned (with images), reason + comments, `OEUI.returnTimeline(ret)`, events feed from `ret.shipment.events` (reuse the same markup classes `.ship-events`/`.ship-event` as track), label/QR link, refund summary. If `ret.status === "started"` and not `guestReadOnly`: "Cancel return" button (confirm dialog, `OEStore.returns.cancel`, then re-render). If not terminal and not `guestReadOnly`: demo-controls card with "Advance return" button (`OEShip.advance(ret.shipment, 1); OEShip.reconcile(order); OEStore.orders.update(...); renderStatus();`).
- Page title updates (`Start a return | OdorElite` / `Return RMA-... | OdorElite`), breadcrumbs `Home / Orders / Return`.

- [ ] **Step 3: styles.css**

Page-specific wizard styles; reuse shared kit for everything else:

```css
.returns-page { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
.ret-step { margin-bottom: 14px; }
.ret-step-head { display: flex; align-items: center; gap: 10px; }
.ret-step-num {
  width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  background: var(--oe-primary); color: #fff; font-size: 13px; font-weight: 700; flex: none;
}
.ret-step.locked .ret-step-num { background: var(--oe-gray-300); color: var(--oe-gray-600); }
.ret-step-head h2 { margin: 0; font-size: 17px; flex: 1; }
.ret-step-edit { background: none; border: 0; color: var(--oe-accent-text); text-decoration: underline; cursor: pointer; font-size: 13.5px; }
.ret-step-summary { color: var(--oe-gray-600); font-size: 14px; margin: 4px 0 0 36px; }
.ret-step-body { margin: 12px 0 0 36px; }
.ret-item { display: grid; grid-template-columns: auto 56px 1fr auto; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--oe-gray-200); }
.ret-item:last-child { border-bottom: 0; }
.ret-item img { width: 56px; height: 56px; object-fit: contain; background: var(--oe-gray-50); border-radius: 8px; }
.ret-item-name { font-weight: 600; font-size: 14px; }
.ret-item-meta { font-size: 12.5px; color: var(--oe-gray-500); }
.ret-item.exhausted { opacity: 0.55; }
.ret-qty { display: inline-flex; align-items: center; gap: 8px; }
.ret-qty button { width: 28px; height: 28px; border: 1px solid var(--oe-gray-300); border-radius: 6px; background: #fff; cursor: pointer; font-size: 15px; }
.ret-qty button:disabled { opacity: 0.4; cursor: default; }
.ret-reason { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0; font-size: 14.5px; cursor: pointer; }
.ret-method { display: grid; gap: 12px; }
@media (min-width: 640px) { .ret-method { grid-template-columns: 1fr 1fr; } }
.ret-method-card { border: 1.5px solid var(--oe-gray-300); border-radius: 10px; padding: 14px; text-align: left; background: #fff; cursor: pointer; }
.ret-method-card[aria-checked="true"] { border-color: var(--oe-gold-dark); box-shadow: 0 0 0 1px var(--oe-gold-dark); }
.ret-method-card h3 { margin: 0 0 4px; font-size: 15px; }
.ret-method-card p { margin: 0; font-size: 13px; color: var(--oe-gray-600); }
.ret-review dt { font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--oe-gray-500); margin-top: 12px; }
.ret-review dd { margin: 2px 0 0; font-size: 14.5px; }
.ret-done { text-align: center; padding: 28px 0; }
.ret-done h1 { margin: 8px 0 4px; }
.ret-done .btn { margin: 14px 6px 0; }
```

- [ ] **Step 4: Verify (spec test scenario 2 + 4)**

Browser, signed in:
1. `../orders/?id=OE-2026-00297` → Start return → wizard opens. L'Amour row is grayed "Already returned"; select Femme Individuelle qty 1.
2. Reason "Item defective or does not work" with 5-char comment → inline error; 20+ chars → passes.
3. Method "Drop off with QR code" → review shows `$27.06 to Visa ••••4242` (25.00 × 1.0825 = 27.0625 → 27.06) and a Return-by date → Submit → confirmation with RMA + View QR code.
4. "View this return" → status view. Demo "Advance return" once → Dropped off + Refunded (QR refunds at scan), refund note visible. Orders detail now shows the refunded return; Returns tab count still 1 order.
5. Cancel-flow check: start another return on OE-2026-00201 (mail method), submit, open its status view, Cancel return → confirm → status Canceled; back on the order, Start return is available again and `returnableQty` restored.
6. Signed out + guest token order (place a guest order, deliver it via track demo controls, create no return): `../returns/?order=<id>` redirects to sign-in. Console clean everywhere.

- [ ] **Step 5: Commit**

```bash
git add prototype/returns/
git commit -m "feat: returns wizard + return status page"
```

---

### Task 8: Label page (`prototype/label/`)

**Files:**
- Create: `prototype/label/index.html`, `prototype/label/app.js`, `prototype/label/styles.css`

**Interfaces:**
- Consumes: `?order=<id>` / `?order=<id>&rma=<id>`; `order.shipment` or `ret.shipment`; `order.address`; minimal chrome (`window.OE_PAGE = { minimal: true }` like checkout).

- [ ] **Step 1: index.html**

Same skeleton as returns/index.html but `<title>Shipping label | OdorElite</title>`, `window.OE_PAGE = { minimal: true };`, and main content:

```html
<main class="label-page">
  <div id="label-root"></div>
</main>
```

- [ ] **Step 2: app.js**

```js
/* OdorElite demo shipping label (spec 2026-07-05 section 5.6).
   ?order=<id> outbound label; &rma=<id> return label / QR.
   Every label is watermarked DEMO - deliberately not scannable. */
(function () {
  "use strict";

  var root = el("label-root");
  var params = new URLSearchParams(window.location.search);
  var orderId = params.get("order");
  var rmaId = params.get("rma");

  function hash31(str) {
    var s = String(str), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003;
    return h;
  }

  var order = orderId ? OEStore.orders.byId(orderId) : null;
  var ret = order && rmaId
    ? (order.returns || []).filter(function (r) { return r.id === rmaId; })[0]
    : null;
  var sh = ret ? ret.shipment : order ? order.shipment : null;

  if (!order || !sh || (rmaId && !ret)) {
    root.innerHTML = OEUI.notFound("No label here", "This link is incomplete or the label does not exist.");
    return;
  }

  var a = order.address || {};
  var WAREHOUSE = { name: "OdorElite Fulfillment", line1: "88 Distribution Way", city: "Edison", state: "NJ", postal: "08817" };
  var from = sh.isReturn
    ? { name: a.firstName + " " + a.lastName, line1: a.line1, city: a.city, state: a.state, postal: a.postal }
    : WAREHOUSE;
  var to = sh.isReturn
    ? WAREHOUSE
    : { name: a.firstName + " " + a.lastName, line1: a.line1, city: a.city, state: a.state, postal: a.postal };

  // CSS barcode: stripe widths derived from the tracking digits (Code128 look)
  function barcode(tn) {
    var bars = "";
    for (var i = 0; i < tn.length; i++) {
      var c = tn.charCodeAt(i);
      bars += '<span style="width:' + (1 + (c % 3)) + 'px;margin-right:' + (1 + ((c >> 2) % 2)) + 'px"></span>';
    }
    return '<div class="label-barcode" aria-hidden="true">' + bars + "</div>";
  }

  // fake QR: 21x21 grid, cells from a hash bit chain (deterministic, not scannable)
  function qr(tn) {
    var cells = "", h = hash31(tn);
    for (var i = 0; i < 441; i++) {
      h = (h * 31 + 7) % 1000003;
      var on = (h & 1) === 1;
      // solid 3x3 finder corners for the QR look
      var r = Math.floor(i / 21), c = i % 21;
      if ((r < 5 && c < 5) || (r < 5 && c > 15) || (r > 15 && c < 5)) on = (r % 4 !== 2 || c % 4 !== 2);
      cells += '<i class="' + (on ? "on" : "") + '"></i>';
    }
    return '<div class="label-qr" role="img" aria-label="Demo QR code, not scannable">' + cells + "</div>";
  }

  function addr(t, who) {
    return (
      '<div class="label-addr"><h3>' + who + "</h3>" +
        "<p>" + esc(t.name) + "<br>" + esc(t.line1 || "") + "<br>" +
        esc((t.city || "") + ", " + (t.state || "") + " " + (t.postal || "")) + "</p></div>"
    );
  }

  document.title = (sh.isReturn ? "Return label " : "Shipping label ") + order.id + " | OdorElite";
  root.innerHTML =
    '<div class="label-actions">' +
      '<a class="btn btn-quiet" href="javascript:history.back()">Back</a>' +
      '<button class="btn btn-gold" type="button" onclick="window.print()">Print label</button>' +
    "</div>" +
    '<div class="label-card">' +
      '<div class="label-head">' +
        '<span class="label-carrier">' + esc(sh.carrier) + "</span>" +
        '<span class="label-service">' + esc(sh.service) + "</span>" +
      "</div>" +
      '<div class="label-addrs">' + addr(from, "FROM") + addr(to, "TO") + "</div>" +
      (sh.qrCode ? qr(sh.trackingNumber) : barcode(sh.trackingNumber)) +
      '<p class="label-tn">' + esc(sh.trackingNumber) + "</p>" +
      (sh.isReturn ? '<p class="label-rma">' + esc(rmaId) + "</p>" : "") +
      '<div class="label-watermark" aria-hidden="true">DEMO LABEL - NOT VALID FOR SHIPPING</div>' +
    "</div>" +
    '<p class="label-note">This is a simulated label for the OdorElite prototype.</p>';
})();
```

- [ ] **Step 3: styles.css**

```css
.label-page { max-width: 480px; margin: 0 auto; padding: 24px 16px 64px; }
.label-actions { display: flex; justify-content: space-between; margin-bottom: 16px; }
.label-card {
  position: relative; overflow: hidden; background: #fff; border: 2px solid var(--oe-gray-900);
  aspect-ratio: 2 / 3; /* 4x6 proportion */ padding: 18px; display: flex; flex-direction: column; gap: 14px;
}
.label-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid var(--oe-gray-900); padding-bottom: 10px; }
.label-carrier { font-size: 26px; font-weight: 800; letter-spacing: 0.02em; }
.label-service { font-size: 13px; font-weight: 700; text-transform: uppercase; }
.label-addrs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.label-addr h3 { font-size: 11px; letter-spacing: 0.08em; margin: 0 0 4px; color: var(--oe-gray-500); }
.label-addr p { font-size: 13px; line-height: 1.45; margin: 0; }
.label-barcode { display: flex; align-items: stretch; height: 74px; margin-top: auto; }
.label-barcode span { display: block; background: #000; }
.label-qr { display: grid; grid-template-columns: repeat(21, 1fr); width: 168px; margin: auto auto 0; border: 6px solid #fff; outline: 1px solid var(--oe-gray-300); }
.label-qr i { aspect-ratio: 1; background: #fff; }
.label-qr i.on { background: #000; }
.label-tn { text-align: center; font-family: ui-monospace, Menlo, monospace; font-size: 15px; letter-spacing: 0.12em; margin: 4px 0 0; }
.label-rma { text-align: center; font-size: 13px; font-weight: 700; margin: 0; }
.label-watermark {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 26px; font-weight: 800; color: rgba(192, 57, 43, 0.18);
  transform: rotate(-24deg); pointer-events: none; text-align: center;
}
.label-note { text-align: center; font-size: 12.5px; color: var(--oe-gray-500); margin-top: 14px; }
@media print {
  #oe-top, #oe-bottom, .label-actions, .label-note { display: none !important; }
  .label-page { padding: 0; }
  .label-card { border-color: #000; margin: 0 auto; }
}
```

- [ ] **Step 4: Verify (spec test scenario 3)**

Browser: from a fresh order confirmation, "View shipping label" → barcode label with carrier, FROM Edison NJ warehouse, TO customer, tracking number, DEMO watermark. From the seeded return (`../label/?order=OE-2026-00297&rma=RMA-84213`) → QR label, FROM customer, TO warehouse. `Cmd+P` print preview: only the label card visible. Bad params (`../label/?order=nope`) → friendly not-found. Console clean.

- [ ] **Step 5: Commit**

```bash
git add prototype/label/
git commit -m "feat: printable demo label page (barcode + QR variants)"
```

---

### Task 9: Docs + full regression

**Files:**
- Modify: `prototype/README.md`
- Modify: `docs/superpowers/specs/2026-07-04-odorelite-prototype-pages-design.md` (only if it enumerates page count/footer copy - update those mentions)

- [ ] **Step 1: README updates**

- Intro: "19-page" → "21-page".
- Pages table, after the Track row:

```markdown
| Returns | `returns/?order=` | 4-step return wizard; `&rma=` opens return status |
| Label | `label/?order=` (`&rma=` for returns) | Printable demo label, barcode/QR, watermark |
```

- Track row note → `Timeline, live carrier events, returns, demo controls`.
- Shared foundation table: add row `| shipping.js | OEShip: simulated shipping partner (labels, deterministic tracking events, returns) |`.
- Prototype rules paragraph: extend the demo-data sentence to include "carrier tracking events" and add: "Shipments play out over ~10 accelerated minutes; demo controls on the track page jump them forward."
- Demo state section: mention the seeded refunded return on OE-2026-00297.

- [ ] **Step 2: Full regression (spec test scenario 6)**

With the server running, click through all 21 pages at 1440px and 390px widths (Playwright MCP or Chrome devtools emulation): home, list, pdp, search, brands, brand, content, wishlist, cart, checkout, confirmation, track, sign-in, create-account, forgot-password, account, orders (+detail), cards, addresses, returns (wizard + status), label (outbound + return). Checks per page: renders, zero console errors, footer disclosure updated, no layout break at 390px. Re-run the guest purchase end-to-end (scenario 1) and the seeded-shipped-order movement check (scenario 5: after `OEStore.reset()`, `track/?id=OE-2026-00314` moves within ~2 minutes).

- [ ] **Step 3: Copy sweep**

```bash
grep -rn "—" prototype/returns prototype/label prototype/shared/shipping.js
```

Expected: no matches (no em-dashes in new code/copy).

- [ ] **Step 4: Commit**

```bash
git add prototype/README.md docs/
git commit -m "docs: returns + shipping simulator in README and master spec"
```

---

## Self-review notes

- Spec coverage: sections 2-5.7 map to Tasks 1-8; section 6 edge cases are encoded in the guards (canceled-order skip in `reconcile`, idempotent `pushTimeline`/`fireDue`, returnableQty restore on cancel, legacy-order no-ops via `if (!sh)` checks); section 7 scenarios are distributed across task verify steps with the full sweep in Task 9.
- Deviation from spec 3 ("loaded after store.js on pages that need it"): shipping.js loads BEFORE store.js on ALL pages, because seeds (spec 4) call `OEShip.buyLabel` and `store.js` seeds at load time on every page. Store still guards with `window.OEShip &&` so nothing breaks if the tag is missing.
- QR drop-off returns keep the `delivered` (+8 min) schedule entry: it appends a "Return received" timeline entry after "Refund issued", matching the real Amazon sequence (refund at scan, warehouse receipt later). Status never downgrades from `refunded`.
