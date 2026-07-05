/* OEUI — shared UI kit for the OdorElite prototypes.
   Contract: master spec §5. Also exposes the page-script globals
   (esc, money, el, toast, imgTag, __oeImgFail) used by home/list. */
(function () {
  "use strict";

  /* ---------------- globals ---------------- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) { return "$" + Number(n).toFixed(2); }
  function el(id) { return document.getElementById(id); }

  window.__oeImgFail = function (img) {
    var initial = (img.alt || "?").charAt(0).toUpperCase();
    var fb = document.createElement("div");
    fb.className = "img-fallback";
    fb.textContent = initial;
    img.replaceWith(fb);
  };

  function imgTag(src, alt, eager) {
    return '<img src="' + esc(src) + '" alt="' + esc(alt) + '"' +
      (eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"') +
      ' onerror="window.__oeImgFail(this)">';
  }

  var toastTimer = null;
  function toast(msg) {
    var t = el("toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.id = "toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      t.hidden = true;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.hidden = false;
    void t.offsetWidth;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  window.esc = esc; window.money = money; window.el = el;
  window.toast = toast; window.imgTag = imgTag;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var HEART_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

  /* ---------------- demo merchandising ----------------
     Ratings, review counts, badges and delivery dates are DEMO DATA,
     derived deterministically from the product id (disclosed once in the
     global footer). Same hash family as pdpBucket so values are stable
     across pages and sessions. */

  function hash31(str) {
    var s = String(str), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003;
    return h;
  }

  var metaCache = {};

  function demoMeta(p) {
    if (!p || p.id === undefined) return null;
    var hit = metaCache[p.id];
    if (hit) return hit;
    var h = hash31(p.id);
    var rating = (380 + (h % 111)) / 100; // 3.80 - 4.90
    var count = 15 + Math.floor(Math.pow(((h >> 3) % 997) / 997, 2.6) * 2385);
    var bestseller = (p.discount || 0) >= 40 && count >= 700;
    var meta = {
      rating: rating,
      count: count,
      bestseller: bestseller,
      popular: !bestseller && rating >= 4.6 && count >= 250
    };
    metaCache[p.id] = meta;
    return meta;
  }

  var STAR_PATH = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
  function starStrip(cls) {
    var one = '<svg viewBox="0 0 24 24" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : "") + ">" + STAR_PATH + "</svg>";
    return one + one + one + one + one;
  }

  function starRow(meta, opts) {
    if (!meta) return "";
    opts = opts || {};
    var pct = Math.round((meta.rating / 5) * 100);
    var label = "Rated " + meta.rating.toFixed(1) + " out of 5, " + meta.count + " reviews";
    return (
      '<span class="oe-stars" role="img" aria-label="' + esc(label) + '">' +
        '<span class="oe-stars-track" aria-hidden="true">' + starStrip() +
          '<span class="oe-stars-fill" style="width:' + pct + '%">' + starStrip() + "</span>" +
        "</span>" +
        (opts.noCount ? "" : '<span class="oe-stars-count" aria-hidden="true">(' + meta.count.toLocaleString("en-US") + ")</span>") +
      "</span>"
    );
  }

  function unitPrice(p) {
    if (!p || !p.size) return "";
    var oz = parseFloat(p.size);
    if (!oz || oz <= 0 || String(p.size).toLowerCase().indexOf("oz") === -1) return "";
    return money(p.price / oz) + "/oz";
  }

  function arrivalDate(id) {
    var d = new Date();
    d.setDate(d.getDate() + 3 + (hash31(id) % 3));
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  /* ---------------- product card ---------------- */

  // Accepts listing-record shape (conc/avail) or curated-home shape (concentration).
  // Registry so delegated handlers can recover the full record from data-pid.
  var cardRegistry = {};

  function productCard(p, opts) {
    opts = opts || {};
    cardRegistry[p.id] = p;
    var conc = p.conc || p.concentration || "";
    var alt = p.brand + " " + p.name;
    var save = p.compareAt ? p.compareAt - p.price : 0;
    var oos = p.avail !== undefined && !p.avail;
    var href = (opts.pdpBase || "../pdp/") + "?id=" + p.id;
    var saved = window.OEStore && OEStore.wishlist.has(p.id);
    var meta = demoMeta(p);
    var unit = unitPrice(p);
    var flag = "";
    if (!oos && meta) {
      if (meta.bestseller) flag = '<span class="pcard-flag flag-best">Best seller</span>';
      else if (meta.popular) flag = '<span class="pcard-flag flag-pop">Popular pick</span>';
    }
    return (
      '<article class="pcard">' +
        '<div class="pcard-media">' +
          (oos ? '<span class="pcard-oos-flag">Out of stock</span>'
               : (p.discount >= 15 ? '<span class="pcard-off">-' + p.discount + "%</span>" : "")) +
          '<button class="pcard-wish' + (saved ? " active" : "") + '" data-wish="' + p.id +
            '" aria-label="Add ' + esc(alt) + ' to wishlist" aria-pressed="' + (saved ? "true" : "false") + '">' + HEART_SVG + "</button>" +
          '<a href="' + href + '" aria-hidden="true" tabindex="-1">' + imgTag(p.img, alt) + "</a>" +
        "</div>" +
        '<div class="pcard-body">' +
          '<p class="pcard-brand">' + esc(p.brand) + "</p>" +
          flag +
          '<p class="pcard-name"><a class="pcard-link" href="' + href + '">' + esc(p.name) + "</a></p>" +
          (meta ? '<div class="pcard-stars">' + starRow(meta) + "</div>" : "") +
          '<p class="pcard-meta">' +
            (conc && conc !== "Other" ? '<span class="pcard-conc">' + esc(conc) + "</span>" : "") +
            (p.size ? '<span class="pcard-size">' + esc(p.size) + "</span>" : "") +
          "</p>" +
          '<p class="pcard-priceline">' +
            '<span class="pcard-price' + (oos ? " oos" : "") + '">' + money(p.price) + "</span>" +
            (p.compareAt ? '<span class="pcard-was">' + money(p.compareAt) + "</span>" : "") +
            (unit ? '<span class="pcard-unit">' + unit + "</span>" : "") +
          "</p>" +
          (!oos && save > 0 ? '<p class="pcard-save">Save ' + money(save) + "</p>" : "") +
          (!oos ? '<p class="pcard-ship">' + (p.price >= 50
                    ? '<span class="ship-free">Free shipping</span>'
                    : "Arrives by " + arrivalDate(p.id)) + "</p>" : "") +
          (oos ? '<button class="pcard-notify" data-notify="' + esc(alt) + '">Notify me</button>'
               : '<button class="pcard-atc" data-atc="' + p.id + '">Add to cart</button>') +
        "</div>" +
      "</article>"
    );
  }

  // one delegated handler for every card on every page
  document.addEventListener("click", function (e) {
    var wishBtn = e.target.closest("[data-wish]");
    if (wishBtn) {
      e.preventDefault();
      var id = Number(wishBtn.dataset.wish);
      var rec = cardRegistry[id] || wishBtn.closest(".pcard") && recFromCard(wishBtn.closest(".pcard"), id);
      if (!rec) return;
      var nowSaved = OEStore.wishlist.toggle(rec);
      document.querySelectorAll('[data-wish="' + id + '"]').forEach(function (b) {
        b.classList.toggle("active", nowSaved);
        b.setAttribute("aria-pressed", nowSaved ? "true" : "false");
      });
      toast(nowSaved ? "Saved to wishlist ♥" : "Removed from wishlist");
      return;
    }
    var atcBtn = e.target.closest("[data-atc]");
    if (atcBtn) {
      e.preventDefault();
      var pid = Number(atcBtn.dataset.atc);
      var rec2 = cardRegistry[pid];
      if (!rec2) return;
      OEStore.cart.add(rec2, 1);
      miniCart.open(pid);
      return;
    }
    var notifyBtn = e.target.closest("[data-notify]");
    if (notifyBtn) {
      e.preventDefault();
      toast("We will email you when it is back in stock (prototype)");
    }
  });

  function recFromCard() { return null; } // registry misses are dropped silently

  /* ---------------- mini-cart drawer ---------------- */

  var miniCart = (function () {
    var built = false, lastAdded = null;

    function build() {
      if (built) return;
      built = true;
      var wrap = document.createElement("div");
      wrap.innerHTML =
        '<div class="mc-overlay" id="mc-overlay" hidden></div>' +
        '<aside class="mc" id="mc" aria-label="Cart" aria-hidden="true">' +
          '<div class="mc-head"><h2>Your cart <span id="mc-count"></span></h2>' +
          '<button class="mc-close" id="mc-close" aria-label="Close cart">&times;</button></div>' +
          '<div class="mc-lines" id="mc-lines"></div>' +
          '<div class="mc-foot" id="mc-foot"></div>' +
        "</aside>";
      while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
      el("mc-close").addEventListener("click", close);
      el("mc-overlay").addEventListener("click", close);
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && el("mc").classList.contains("open")) close();
      });
      el("mc-lines").addEventListener("click", function (e) {
        var rm = e.target.closest("[data-mc-remove]");
        if (rm) { OEStore.cart.remove(Number(rm.dataset.mcRemove)); render(); }
        var inc = e.target.closest("[data-mc-qty]");
        if (inc) {
          var id = Number(inc.dataset.mcQty);
          var lineObj = OEStore.cart.get().filter(function (l) { return l.id === id; })[0];
          if (lineObj) {
            OEStore.cart.updateQty(id, lineObj.qty + Number(inc.dataset.dir));
            render();
          }
        }
      });
    }

    function render() {
      var lines = OEStore.cart.get();
      el("mc-count").textContent = lines.length ? "(" + OEStore.cart.count() + ")" : "";
      if (!lines.length) {
        el("mc-lines").innerHTML = '<p class="mc-empty">Your cart is empty.</p>';
        el("mc-foot").innerHTML = '<a class="btn btn-gold mc-btn" href="../list/">Start shopping</a>';
        return;
      }
      el("mc-lines").innerHTML = lines.map(function (l) {
        return (
          '<div class="mc-line' + (l.id === lastAdded ? " mc-line-new" : "") + '">' +
            imgTag(l.img, l.brand + " " + l.name) +
            '<div class="mc-line-info">' +
              '<p class="mc-line-brand">' + esc(l.brand) + "</p>" +
              '<p class="mc-line-name">' + esc(l.name) + "</p>" +
              '<div class="mc-line-row">' +
                '<span class="mc-qty">' +
                  '<button data-mc-qty="' + l.id + '" data-dir="-1" aria-label="Decrease quantity"' + (l.qty <= 1 ? " disabled" : "") + ">&minus;</button>" +
                  "<b>" + l.qty + "</b>" +
                  '<button data-mc-qty="' + l.id + '" data-dir="1" aria-label="Increase quantity"' + (l.qty >= OEStore.MAX_QTY ? " disabled" : "") + ">+</button>" +
                "</span>" +
                '<span class="mc-line-price">' + money(l.price * l.qty) + "</span>" +
              "</div>" +
            "</div>" +
            '<button class="mc-line-remove" data-mc-remove="' + l.id + '" aria-label="Remove ' + esc(l.name) + '">&times;</button>' +
          "</div>"
        );
      }).join("");
      el("mc-foot").innerHTML =
        '<div class="mc-subtotal"><span>Subtotal</span><b>' + money(OEStore.cart.subtotal()) + "</b></div>" +
        '<p class="mc-note">Shipping and tax calculated at checkout. Free US shipping over $50.</p>' +
        '<a class="btn btn-gold mc-btn" href="../checkout/">Checkout</a>' +
        '<a class="mc-viewcart" href="../cart/">View cart</a>';
    }

    function open(addedId) {
      build();
      lastAdded = addedId || null;
      render();
      el("mc-overlay").hidden = false;
      var mc = el("mc");
      mc.classList.add("open");
      mc.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      el("mc-close").focus({ preventScroll: true });
    }
    function close() {
      var mc = el("mc");
      if (!mc) return;
      // move focus out before aria-hidden lands on the drawer
      if (mc.contains(document.activeElement)) {
        var cartBtn = el("cart-btn");
        if (cartBtn) cartBtn.focus({ preventScroll: true });
        else document.activeElement.blur();
      }
      mc.classList.remove("open");
      mc.setAttribute("aria-hidden", "true");
      el("mc-overlay").hidden = true;
      document.body.style.overflow = "";
    }
    return { open: open, close: close };
  })();

  /* ---------------- order components ---------------- */

  var STATUS_META = {
    processing: { label: "Processing", cls: "chip-info" },
    shipped: { label: "Shipped", cls: "chip-accent" },
    out_for_delivery: { label: "Out for delivery", cls: "chip-accent" },
    delivered: { label: "Delivered", cls: "chip-success" },
    canceled: { label: "Canceled", cls: "chip-gray" },
    refunded: { label: "Refunded", cls: "chip-warning" }
  };

  function statusChip(status) {
    var m = STATUS_META[status] || { label: status, cls: "chip-gray" };
    return '<span class="chip-status ' + m.cls + '">' + esc(m.label) + "</span>";
  }

  var TIMELINE_STEPS = ["processing", "shipped", "out_for_delivery", "delivered"];
  var STEP_LABELS = { processing: "Order placed", shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered" };

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function orderTimeline(order) {
    if (order.status === "canceled" || order.status === "refunded") {
      var cancelAt = (order.timeline || []).filter(function (t) { return t.status === order.status || t.status === "canceled"; }).slice(-1)[0];
      return (
        '<div class="tl tl-branch">' +
          '<div class="tl-step done"><span class="tl-dot"></span><span class="tl-label">Order placed</span><span class="tl-date">' + fmtDate(order.placedAt) + "</span></div>" +
          '<div class="tl-step canceled"><span class="tl-dot"></span><span class="tl-label">' + (order.status === "refunded" ? "Refunded" : "Canceled") + "</span>" +
            (cancelAt ? '<span class="tl-date">' + fmtDate(cancelAt.at) + "</span>" : "") + "</div>" +
          (order.refundNote ? '<p class="tl-refund">' + esc(order.refundNote) + "</p>" : "") +
        "</div>"
      );
    }
    var reachedIdx = TIMELINE_STEPS.indexOf(order.status);
    var stamps = {};
    (order.timeline || []).forEach(function (t) { stamps[t.status] = t.at; });
    return (
      '<div class="tl">' +
        TIMELINE_STEPS.map(function (s, i) {
          var state = i < reachedIdx ? "done" : i === reachedIdx ? "current" : "future";
          return (
            '<div class="tl-step ' + state + '">' +
              '<span class="tl-dot"></span>' +
              '<span class="tl-label">' + STEP_LABELS[s] + "</span>" +
              (stamps[s] && state !== "future" ? '<span class="tl-date">' + fmtDate(stamps[s]) + "</span>" : "") +
            "</div>"
          );
        }).join('<span class="tl-bar" aria-hidden="true"></span>') +
      "</div>"
    );
  }

  function trackingCard(f) {
    return (
      '<div class="track-card">' +
        '<div><p class="track-carrier">' + esc(f.carrier) + '</p>' +
        '<p class="track-no">' + esc(f.tracking) + "</p></div>" +
        '<a class="track-link" href="' + esc(f.url || "#") + '">Track with carrier</a>' +
      "</div>"
    );
  }

  function maskEmail(email) {
    var parts = String(email).split("@");
    return parts[0].charAt(0) + "***@" + (parts[1] || "");
  }

  function orderSummaryCard(order, opts) {
    opts = opts || {};
    var a = order.address || {};
    var addressHtml = opts.maskAddress
      ? esc(a.city + ", " + a.state)
      : esc(a.firstName + " " + a.lastName) + "<br>" + esc(a.line1) + (a.line2 ? ", " + esc(a.line2) : "") + "<br>" +
        esc(a.city + ", " + a.state + " " + a.postal);
    return (
      '<div class="osc">' +
        '<div class="osc-lines">' +
          order.lines.map(function (l) {
            return (
              '<div class="osc-line">' +
                imgTag(l.img, l.brand + " " + l.name) +
                '<div><p class="osc-line-brand">' + esc(l.brand) + '</p>' +
                '<p class="osc-line-name">' + esc(l.name) + (l.size ? " · " + esc(l.size) : "") + "</p>" +
                '<p class="osc-line-qty">Qty ' + l.qty + "</p></div>" +
                '<span class="osc-line-price">' + money(l.price * l.qty) + "</span>" +
              "</div>"
            );
          }).join("") +
        "</div>" +
        '<div class="osc-totals">' +
          '<div><span>Subtotal</span><span>' + money(order.subtotal) + "</span></div>" +
          (order.discount ? '<div><span>Discount</span><span>-' + money(order.discount) + "</span></div>" : "") +
          '<div><span>Shipping</span><span>' + (order.shipping ? money(order.shipping) : "Free") + "</span></div>" +
          '<div><span>Tax</span><span>' + money(order.tax) + "</span></div>" +
          '<div class="osc-total"><span>Total</span><span>' + money(order.total) + "</span></div>" +
        "</div>" +
        '<div class="osc-meta">' +
          '<div><h3>Delivery</h3><p>' + addressHtml + "</p><p>" + esc(order.shippingMethod || "") + "</p></div>" +
          '<div><h3>Contact</h3><p>' + esc(opts.maskEmail ? maskEmail(order.email) : order.email) + "</p>" +
          (order.payment ? "<p>" + esc(order.payment.network === "visa" ? "Visa" : order.payment.network === "mastercard" ? "Mastercard" : "Amex") + " ••••" + esc(order.payment.last4) + "</p>" : "") + "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function claimAccountCard(order) {
    return (
      '<div class="claim" id="claim-card">' +
        '<h2>Track this order anywhere</h2>' +
        '<p>Create a password and this order joins your account. Your email is already filled in.</p>' +
        '<form class="claim-form" id="claim-form">' +
          '<input class="claim-email" type="email" value="' + esc(order.email) + '" readonly aria-label="Email">' +
          '<input class="claim-pass" id="claim-pass" type="password" placeholder="Choose a password" aria-label="Choose a password" required>' +
          '<button class="btn btn-gold" type="submit">Create account</button>' +
        "</form>" +
      "</div>"
    );
  }

  // claim-card behavior (delegated so any page can drop the card in)
  document.addEventListener("submit", function (e) {
    if (e.target && e.target.id === "claim-form") {
      e.preventDefault();
      var pass = el("claim-pass").value;
      if (pass.length < 10) { toast("Password needs at least 10 characters"); return; }
      var card = el("claim-card");
      var email = card.querySelector(".claim-email").value;
      OEStore.auth.signIn({ firstName: "Ava", lastName: "Laurent", email: email });
      var orderEl = card.closest("[data-order-id]");
      var orderId = orderEl ? orderEl.dataset.orderId : null;
      if (orderId) OEStore.orders.update(orderId, { guest: false });
      card.innerHTML = '<h2>You are set</h2><p>This order now lives in your account.</p>' +
        '<a class="btn btn-gold" href="../orders/' + (orderId ? "?id=" + orderId : "") + '">View your orders</a>';
    }
  });

  /* ---------------- account shell ---------------- */

  var ACCOUNT_TABS = [
    ["overview", "Overview", "../account/"],
    ["orders", "Orders", "../orders/"],
    ["addresses", "Addresses", "../addresses/"],
    ["cards", "Saved cards", "../cards/"],
    ["wishlist", "Wishlist", "../wishlist/"]
  ];

  function accountShell(activeTab) {
    return (
      '<nav class="acct-nav" aria-label="Account">' +
        ACCOUNT_TABS.map(function (t) {
          return '<a class="acct-link' + (t[0] === activeTab ? " active" : "") + '" href="' + t[2] + '"' +
            (t[0] === activeTab ? ' aria-current="page"' : "") + ">" + t[1] + "</a>";
        }).join("") +
        '<button class="acct-link acct-signout" id="acct-signout">Sign out</button>' +
      "</nav>"
    );
  }

  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "acct-signout") {
      OEStore.auth.signOut();
      window.location.href = "../home/";
    }
  });

  // account pages call this first: bounce to sign-in when signed out
  function requireAuth(nextPath) {
    if (!OEStore.auth.get()) {
      window.location.replace("../sign-in/?next=" + encodeURIComponent(nextPath));
      return null;
    }
    return OEStore.auth.get();
  }

  /* ---------------- misc ---------------- */

  function qtyStepper(line) {
    return (
      '<span class="qty-step">' +
        '<button data-qty="' + line.id + '" data-dir="-1" aria-label="Decrease quantity"' + (line.qty <= 1 ? " disabled" : "") + ">&minus;</button>" +
        "<b>" + line.qty + "</b>" +
        '<button data-qty="' + line.id + '" data-dir="1" aria-label="Increase quantity"' + (line.qty >= OEStore.MAX_QTY ? " disabled" : "") + ">+</button>" +
      "</span>"
    );
  }

  function notFound(title, body) {
    return (
      '<div class="oe-notfound">' +
        '<span class="oe-notfound-mark" aria-hidden="true"></span>' +
        "<h1>" + esc(title || "We couldn't find that") + "</h1>" +
        "<p>" + esc(body || "It may have moved, or the link is incomplete.") + "</p>" +
        '<form class="oe-notfound-search" onsubmit="location.href=\'../search/?q=\'+encodeURIComponent(this.q.value);return false;">' +
          '<input name="q" type="search" placeholder="Search fragrances" aria-label="Search fragrances">' +
          '<button class="btn btn-gold" type="submit">Search</button>' +
        "</form>" +
        '<a class="oe-notfound-back" href="../list/">Browse all fragrances</a>' +
      "</div>"
    );
  }

  // Wire prev/next arrows for a horizontal .rail (home rail pattern):
  // buttons carry data-rail="<rail element id>" and data-dir="-1|1".
  function wireRailArrows(scope) {
    (scope || document).querySelectorAll(".rail-arrow").forEach(function (btn) {
      var rail = document.getElementById(btn.dataset.rail);
      if (!rail) return;
      var dir = Number(btn.dataset.dir);
      function update() {
        var max = rail.scrollWidth - rail.clientWidth - 4;
        btn.disabled = dir < 0 ? rail.scrollLeft <= 4 : rail.scrollLeft >= max;
      }
      btn.addEventListener("click", function () {
        rail.scrollBy({ left: dir * (rail.clientWidth - 80), behavior: reducedMotion ? "auto" : "smooth" });
      });
      rail.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      update();
    });
  }

  // PDP detail shard bucket — MUST mirror bucket_of() in pdp/curate_pdp.py
  function pdpBucket(id) {
    var s = String(id), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003;
    return h % 48;
  }

  window.OEUI = {
    pdpBucket: pdpBucket,
    demoMeta: demoMeta,
    starRow: starRow,
    unitPrice: unitPrice,
    arrivalDate: arrivalDate,
    wireRailArrows: wireRailArrows,
    productCard: productCard,
    registerProduct: function (p) { cardRegistry[p.id] = p; },
    getProduct: function (id) { return cardRegistry[id] || null; },
    miniCart: miniCart,
    statusChip: statusChip,
    orderTimeline: orderTimeline,
    trackingCard: trackingCard,
    orderSummaryCard: orderSummaryCard,
    claimAccountCard: claimAccountCard,
    accountShell: accountShell,
    requireAuth: requireAuth,
    qtyStepper: qtyStepper,
    notFound: notFound,
    maskEmail: maskEmail,
    fmtDate: fmtDate,
    reducedMotion: reducedMotion,
    HEART_SVG: HEART_SVG
  };
})();
