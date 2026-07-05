/* OEStore — cross-page state for the OdorElite prototypes.
   Contract: docs/superpowers/specs/2026-07-04-odorelite-prototype-pages-design.md §3.
   Page agents: read via the API only; never touch localStorage keys directly. */
(function () {
  "use strict";

  var KEYS = {
    cart: "oe.cart.v1",
    wishlist: "oe.wishlist.v1",
    auth: "oe.auth.v1",
    orders: "oe.orders.v1",
    addresses: "oe.addresses.v1",
    cards: "oe.cards.v1",
    seeded: "oe.seeded.v1"
  };
  var MAX_QTY = 10;
  var DAY = 86400000;
  var MINUTE = 60000;

  function read(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (raw == null) return fallback;
      var v = JSON.parse(raw);
      if (v === null && fallback !== null) return fallback;
      return v;
    } catch (e) {
      try { window.localStorage.setItem(key, JSON.stringify(fallback)); } catch (e2) {}
      return fallback;
    }
  }

  function write(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* session-only */ }
    emit(key);
  }

  function emit(key) {
    document.dispatchEvent(new CustomEvent("oe:state", { detail: { key: key } }));
  }

  // cross-tab sync: another tab wrote -> re-emit locally
  window.addEventListener("storage", function (e) {
    if (e.key && e.key.indexOf("oe.") === 0) emit(e.key);
  });

  function uid(prefix) {
    // no Math.random dependence on quality; good enough for demo ids
    return prefix + Math.random().toString(36).slice(2, 10);
  }

  /* ---------------- seeds ---------------- */

  // Real in-stock products (snapshots from listing data, images verified on disk)
  var P = {
    supremacyGold: { id: 7641146917057, brand: "Afnan", name: "Supremacy Gold", price: 25.0, compareAt: 150.0, img: "../../downloaded-images/7641146917057/hero/1.webp", conc: "EDP", size: "3.4 oz" },
    oudEmerald: { id: 7410469503169, brand: "Orientica", name: "XO Xclusif Oud Emerald", price: 48.0, compareAt: 250.0, img: "../../downloaded-images/7410469503169/hero/1.webp", conc: "EDP", size: "2.7 oz" },
    femmeIndividuelle: { id: 534195393, brand: "Montblanc", name: "Femme Individuelle", price: 25.0, compareAt: 124.0, img: "../../downloaded-images/534195393/hero/1.jpg", conc: "EDT", size: "2.5 oz" },
    qatarKing: { id: 10695434698945, brand: "786 Parfum Dubai", name: "Qatar King", price: 32.0, compareAt: 160.0, img: "../../downloaded-images/10695434698945/hero/1.webp", conc: "EDP", size: "3.4 oz" },
    aventureGold: { id: 10871590813889, brand: "Al Haramain", name: "L'Aventure Gold", price: 41.0, compareAt: 210.0, img: "../../downloaded-images/10871590813889/hero/1.webp", conc: "EDP", size: "6.8 oz" },
    lamour: { id: 9208683841, brand: "Lalique", name: "L'Amour", price: 37.0, compareAt: 176.0, img: "../../downloaded-images/9208683841/hero/1.jpg", conc: "EDP", size: "3.3 oz" },
    gameOfSpades: { id: 10647970775233, brand: "Jo Milano", name: "Game Of Spades Opal", price: 70.0, compareAt: 320.0, img: "../../downloaded-images/10647970775233/hero/1.webp", conc: "Parfum", size: "3.4 oz" },
    sunJava: { id: 4671271927896, brand: "Franck Olivier", name: "Sun Java Royal Oud", price: 23.0, compareAt: 99.0, img: "../../downloaded-images/4671271927896/hero/1.jpg", conc: "EDP", size: "2.5 oz" }
  };

  function line(p, qty) {
    return { id: p.id, brand: p.brand, name: p.name, price: p.price, compareAt: p.compareAt, img: p.img, conc: p.conc, size: p.size, qty: qty };
  }

  function totals(lines, shipping, discount) {
    var subtotal = 0;
    lines.forEach(function (l) { subtotal += l.price * l.qty; });
    var tax = Math.round((subtotal - discount) * 0.0825 * 100) / 100;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discount: discount,
      shipping: shipping,
      tax: tax,
      total: Math.round((subtotal - discount + shipping + tax) * 100) / 100
    };
  }

  var ADDR_NY = {
    id: "addr_ny", firstName: "Ava", lastName: "Laurent",
    line1: "428 Ninth Ave", line2: "Apt 12", city: "New York", state: "NY",
    postal: "10001", country: "US", phone: "+1 212 555 0184",
    isDefaultShipping: true, isDefaultBilling: true
  };
  var ADDR_TX = {
    id: "addr_tx", firstName: "Ava", lastName: "Laurent",
    line1: "1911 Barton Springs Rd", line2: "", city: "Austin", state: "TX",
    postal: "78704", country: "US", phone: "+1 512 555 0136",
    isDefaultShipping: false, isDefaultBilling: false
  };

  function seedOrder(id, daysAgo, status, lines, opts) {
    opts = opts || {};
    var placed = Date.now() - daysAgo * DAY;
    var t = totals(lines, opts.shipping != null ? opts.shipping : 6.95, opts.discount || 0);
    var timeline = [{ status: "processing", at: placed }];
    var order = {
      id: id, placedAt: placed, status: status, email: "ava@example.com",
      guest: false, key: uid("k_"),
      lines: lines,
      subtotal: t.subtotal, discount: t.discount, shipping: t.shipping, tax: t.tax, total: t.total,
      shippingMethod: opts.method || "Standard (3-5 business days)",
      address: ADDR_NY,
      payment: { network: "visa", last4: "4242" },
      fulfillments: [],
      timeline: timeline
    };
    if (status !== "canceled" && window.OEShip) {
      // schedule base positions the seed so its status holds (spec 4):
      // processing = starts moving live; shipped = next event ~2 min out;
      // delivered/out_for_delivery = full history already due
      var base = status === "processing" ? Date.now()
        : status === "shipped" ? Date.now() - 2 * MINUTE
        : placed;
      order.shipment = window.OEShip.buyLabel({
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
    if (order.shipment && window.OEShip) window.OEShip.reconcile(order);
    return order;
  }

  function seed() {
    if (read(KEYS.seeded, null) === "2") return;
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
        shipment: window.OEShip.buyLabel({ orderId: "OE-2026-00297", isReturn: true, qrRequested: true, rmaId: "RMA-84213", now: retAt }),
        status: "started",
        timeline: [{ status: "started", at: retAt }]
      };
      d297.returns = [ret297];
      window.OEShip.reconcile(d297); // fires scan + received -> refunded
    }
    write(KEYS.orders, [
      seedOrder("OE-2026-00341", 2, "processing", [line(P.supremacyGold, 1), line(P.sunJava, 2)]),
      seedOrder("OE-2026-00314", 6, "shipped", [line(P.gameOfSpades, 1)], { method: "Express (2 business days)", shipping: 14.95, speed: "express" }),
      d297,
      seedOrder("OE-2026-00268", 21, "canceled", [line(P.qatarKing, 1)]),
      seedOrder("OE-2026-00201", 35, "delivered", [line(P.aventureGold, 1)], { shipping: 0 })
    ]);
    write(KEYS.addresses, [ADDR_NY, ADDR_TX]);
    var now = new Date();
    var y = now.getFullYear();
    // mc expires at the end of NEXT month so the "expires soon" (<=60 days)
    // state is actually exercised by the saved-cards page
    var soonMonth = ((now.getMonth() + 1) % 12) + 1;
    var soonYear = y + (now.getMonth() === 11 ? 1 : 0);
    write(KEYS.cards, [
      { id: "card_visa", network: "visa", last4: "4242", expMonth: 12, expYear: y + 1, isDefault: true },
      { id: "card_mc", network: "mastercard", last4: "4444", expMonth: soonMonth, expYear: soonYear, isDefault: false }
    ]);
    if (read(KEYS.cart, null) === null) write(KEYS.cart, []);
    if (read(KEYS.wishlist, null) === null) write(KEYS.wishlist, []);
    if (read(KEYS.auth, undefined) === undefined) write(KEYS.auth, null);
    write(KEYS.seeded, "2");
  }

  /* ---------------- API ---------------- */

  function snapshot(p) {
    // accepts listing-record or snapshot shape; normalizes to a line/wishlist snapshot
    return {
      id: p.id, brand: p.brand, name: p.name,
      price: p.price, compareAt: p.compareAt || null,
      img: p.img,
      conc: p.conc || p.concentration || "",
      size: p.size || "",
      avail: p.avail === undefined ? 1 : (p.avail ? 1 : 0)
    };
  }

  var OEStore = {
    KEYS: KEYS,
    MAX_QTY: MAX_QTY,

    cart: {
      get: function () { return read(KEYS.cart, []); },
      add: function (p, qty) {
        var lines = read(KEYS.cart, []);
        var s = snapshot(p);
        var existing = lines.filter(function (l) { return l.id === s.id; })[0];
        if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + (qty || 1));
        else {
          s.qty = Math.min(MAX_QTY, qty || 1);
          delete s.avail;
          lines.push(s);
        }
        write(KEYS.cart, lines);
        return lines;
      },
      updateQty: function (id, qty) {
        var lines = read(KEYS.cart, []).map(function (l) {
          if (l.id === id) l.qty = Math.max(1, Math.min(MAX_QTY, qty));
          return l;
        });
        write(KEYS.cart, lines);
      },
      remove: function (id) {
        var lines = read(KEYS.cart, []);
        var removed = lines.filter(function (l) { return l.id === id; })[0] || null;
        write(KEYS.cart, lines.filter(function (l) { return l.id !== id; }));
        return removed;
      },
      restore: function (lineObj) {
        var lines = read(KEYS.cart, []);
        if (!lines.some(function (l) { return l.id === lineObj.id; })) lines.push(lineObj);
        write(KEYS.cart, lines);
      },
      clear: function () { write(KEYS.cart, []); },
      count: function () {
        return read(KEYS.cart, []).reduce(function (n, l) { return n + l.qty; }, 0);
      },
      subtotal: function () {
        return Math.round(read(KEYS.cart, []).reduce(function (n, l) { return n + l.price * l.qty; }, 0) * 100) / 100;
      }
    },

    wishlist: {
      get: function () { return read(KEYS.wishlist, []); },
      has: function (id) {
        return read(KEYS.wishlist, []).some(function (w) { return w.id === id; });
      },
      toggle: function (p) {
        var items = read(KEYS.wishlist, []);
        var s = snapshot(p);
        var had = items.some(function (w) { return w.id === s.id; });
        items = had ? items.filter(function (w) { return w.id !== s.id; }) : items.concat([s]);
        write(KEYS.wishlist, items);
        return !had; // true = now saved
      },
      remove: function (id) {
        write(KEYS.wishlist, read(KEYS.wishlist, []).filter(function (w) { return w.id !== id; }));
      },
      count: function () { return read(KEYS.wishlist, []).length; }
    },

    auth: {
      get: function () { return read(KEYS.auth, null); },
      signIn: function (user) { write(KEYS.auth, user); return user; },
      update: function (patch) {
        var u = read(KEYS.auth, null);
        if (!u) return null;
        Object.keys(patch).forEach(function (k) { u[k] = patch[k]; });
        write(KEYS.auth, u);
        return u;
      },
      signOut: function () { write(KEYS.auth, null); }
    },

    orders: {
      get: function () {
        return read(KEYS.orders, []).slice().sort(function (a, b) { return b.placedAt - a.placedAt; });
      },
      byId: function (id) {
        return read(KEYS.orders, []).filter(function (o) { return o.id === id; })[0] || null;
      },
      byToken: function (token) {
        if (!token) return null;
        return read(KEYS.orders, []).filter(function (o) { return o.guestToken === token; })[0] || null;
      },
      add: function (order) {
        var orders = read(KEYS.orders, []);
        orders.unshift(order);
        write(KEYS.orders, orders);
        return order;
      },
      update: function (id, patch) {
        var orders = read(KEYS.orders, []).map(function (o) {
          if (o.id === id) Object.keys(patch).forEach(function (k) { o[k] = patch[k]; });
          return o;
        });
        write(KEYS.orders, orders);
      },
      updateStatus: function (id, status) {
        var orders = read(KEYS.orders, []).map(function (o) {
          if (o.id === id) {
            o.status = status;
            o.timeline = (o.timeline || []).concat([{ status: status, at: Date.now() }]);
          }
          return o;
        });
        write(KEYS.orders, orders);
      },
      nextId: function () {
        var max = 341;
        read(KEYS.orders, []).forEach(function (o) {
          var m = /OE-\d{4}-(\d{5})/.exec(o.id);
          if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        return "OE-2026-" + String(max + 1).padStart(5, "0");
      },
      newToken: function () { return uid("t_"); },
      newKey: function () { return uid("k_"); },
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
    },

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

    addresses: {
      get: function () { return read(KEYS.addresses, []); },
      add: function (a) {
        var list = read(KEYS.addresses, []);
        if (list.length >= 10) return null;
        a.id = a.id || uid("addr_");
        if (!list.length) { a.isDefaultShipping = true; a.isDefaultBilling = true; }
        list.push(a);
        write(KEYS.addresses, list);
        return a;
      },
      update: function (id, patch) {
        var list = read(KEYS.addresses, []).map(function (a) {
          if (a.id === id) Object.keys(patch).forEach(function (k) { a[k] = patch[k]; });
          return a;
        });
        write(KEYS.addresses, list);
      },
      remove: function (id) {
        var list = read(KEYS.addresses, []);
        var removed = list.filter(function (a) { return a.id === id; })[0];
        list = list.filter(function (a) { return a.id !== id; });
        // invariant: exactly one default of each kind while any address exists
        ["isDefaultShipping", "isDefaultBilling"].forEach(function (flag) {
          if (removed && removed[flag] && list.length && !list.some(function (a) { return a[flag]; })) {
            list[list.length - 1][flag] = true;
          }
        });
        write(KEYS.addresses, list);
      },
      setDefault: function (id, kind) {
        var flag = kind === "billing" ? "isDefaultBilling" : "isDefaultShipping";
        var list = read(KEYS.addresses, []).map(function (a) {
          a[flag] = a.id === id;
          return a;
        });
        write(KEYS.addresses, list);
      }
    },

    cards: {
      get: function () { return read(KEYS.cards, []); },
      add: function (c) {
        var list = read(KEYS.cards, []);
        c.id = c.id || uid("card_");
        if (!list.length) c.isDefault = true;
        list.push(c);
        write(KEYS.cards, list);
        return c;
      },
      remove: function (id) {
        var list = read(KEYS.cards, []);
        var removed = list.filter(function (c) { return c.id === id; })[0];
        list = list.filter(function (c) { return c.id !== id; });
        if (removed && removed.isDefault && list.length) list[list.length - 1].isDefault = true;
        write(KEYS.cards, list);
      },
      setDefault: function (id) {
        write(KEYS.cards, read(KEYS.cards, []).map(function (c) {
          c.isDefault = c.id === id;
          return c;
        }));
      }
    },

    totals: totals,
    reset: function () {
      Object.keys(KEYS).forEach(function (k) {
        try { window.localStorage.removeItem(KEYS[k]); } catch (e) {}
      });
      seed();
      emit("reset");
    }
  };

  window.OEStore = OEStore;
  seed();
})();
