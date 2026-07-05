/* OdorElite checkout - accordion steps, writes the Order that
   confirmation/track/orders read. Contract: master spec section 3 + 8.8. */
(function () {
  "use strict";

  /* ---------------- guard: empty cart ---------------- */

  var cart = OEStore.cart.get();
  if (!cart.length) {
    window.location.replace("../cart/");
    return;
  }

  var auth = OEStore.auth.get();
  var savedAddresses = auth ? OEStore.addresses.get() : [];
  var savedCards = auth ? OEStore.cards.get() : [];

  var SHIP = {
    standard: { label: "Standard", eta: "3-5 business days", price: 6.95 },
    express: { label: "Express", eta: "2 business days", price: 14.95 },
    overnight: { label: "Overnight", eta: "Next business day", price: 24.95 }
  };
  var FREE_SHIP_MIN = 50;
  var DECLINE_PAN = "4000000000000002";

  var state = {
    step: 0,
    done: { 1: false, 2: false, 3: false, 4: false },
    email: auth ? auth.email : "",
    address: null,       // snapshot committed by step 2
    shipping: "standard"
  };

  var subtotal = OEStore.cart.subtotal();
  var completing = false; // true once payment succeeded; suppresses the empty-cart redirect race

  // discount handoff from the cart page (sessionStorage, same-tab)
  var discountInfo = null;
  try { discountInfo = JSON.parse(window.sessionStorage.getItem("oe.checkout.discount")); } catch (e) {}
  function discountAmount() {
    if (!discountInfo || !discountInfo.pct) return 0;
    return Math.round(subtotal * discountInfo.pct) / 100;
  }

  function shippingCost() {
    if (state.shipping === "standard" && subtotal >= FREE_SHIP_MIN) return 0;
    return SHIP[state.shipping].price;
  }

  // the cart can change from another tab (store.js re-emits storage events);
  // keep lines/totals fresh and bail out if the cart empties under us
  function refreshCart() {
    cart = OEStore.cart.get();
    subtotal = OEStore.cart.subtotal();
    if (!cart.length && !completing) {
      window.location.replace("../cart/");
      return false;
    }
    return true;
  }
  document.addEventListener("oe:state", function (e) {
    if (completing) return;
    if (e.detail && e.detail.key === OEStore.KEYS.cart) {
      if (refreshCart()) renderAside();
    }
  });

  /* ---------------- order summary aside ---------------- */

  function renderAside() {
    var t = OEStore.totals(cart, shippingCost(), discountAmount());
    el("co-sum-lines").innerHTML = cart.map(function (l) {
      return (
        '<div class="co-sum-line">' +
          imgTag(l.img, l.brand + " " + l.name) +
          '<div><p class="co-sum-brand">' + esc(l.brand) + "</p>" +
          '<p class="co-sum-name">' + esc(l.name) + "</p>" +
          '<p class="co-sum-qty">Qty ' + l.qty + "</p></div>" +
          '<span class="co-sum-price">' + money(l.price * l.qty) + "</span>" +
        "</div>"
      );
    }).join("");
    var n = OEStore.cart.count();
    el("co-sum-count").textContent = "(" + n + (n === 1 ? " item)" : " items)");
    var saved = 0;
    cart.forEach(function (l) {
      if (l.compareAt && l.compareAt > l.price) saved += (l.compareAt - l.price) * l.qty;
    });
    el("co-sum-totals").innerHTML =
      "<div><span>Subtotal</span><span>" + money(t.subtotal) + "</span></div>" +
      (saved > 0 ? '<div class="co-sum-saved"><span>You\'re saving</span><span>-' + money(saved) + "</span></div>" : "") +
      (t.discount > 0
        ? "<div><span>Discount (" + esc(discountInfo.code) + ")</span><span>-" + money(t.discount) + "</span></div>"
        : "<div><span>Discount</span><span>" + money(0) + "</span></div>") +
      "<div><span>Shipping</span>" +
        (t.shipping === 0 ? '<span class="co-sum-free">Free</span>' : "<span>" + money(t.shipping) + "</span>") +
      "</div>" +
      "<div><span>Estimated tax</span><span>" + money(t.tax) + "</span></div>" +
      '<div class="co-sum-grand"><span>Total</span><span>' + money(t.total) + "</span></div>";
    el("aside-toggle-total").textContent = money(t.total);
    el("pay-total").textContent = money(t.total);
  }

  /* express pay is a labeled demo affordance only */
  document.querySelectorAll("[data-express]").forEach(function (b) {
    b.addEventListener("click", function () {
      toast(this.dataset.express + " express pay is not wired in this prototype");
    });
  });

  el("aside-toggle").addEventListener("click", function () {
    var open = el("co-summary").classList.toggle("collapsed") === false;
    this.setAttribute("aria-expanded", open ? "true" : "false");
  });

  /* ---------------- accordion plumbing ---------------- */

  function setStep(n) {
    state.step = n;
    [1, 2, 3, 4].forEach(function (i) {
      var open = i === n;
      var sec = el("step-" + i);
      sec.classList.toggle("open", open);
      sec.classList.toggle("done", state.done[i] && !open);
      sec.classList.toggle("locked", !open && !state.done[i]);
      el("body-" + i).hidden = !open;
      el("sum-" + i).textContent = open ? "" : el("sum-" + i).textContent;
      el("edit-" + i).hidden = open || !state.done[i];
      var head = el("head-" + i);
      head.setAttribute("aria-expanded", open ? "true" : "false");
      head.disabled = !open && !state.done[i];
    });
    el("head-" + n).focus({ preventScroll: false });
  }

  function complete(n, summary) {
    state.done[n] = true;
    el("sum-" + n).textContent = summary;
    var next = [1, 2, 3, 4].filter(function (i) { return !state.done[i]; })[0];
    if (next) setStep(next);
  }

  [1, 2, 3, 4].forEach(function (i) {
    el("head-" + i).addEventListener("click", function () {
      if (state.step === i || !state.done[i]) return;
      state.done[i] = false; // must re-confirm the step after editing
      setStep(i);
    });
  });

  /* ---------------- error helpers ---------------- */

  function setErr(fieldId, msg) {
    var input = el(fieldId);
    var err = el(fieldId + "-err");
    if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) err.textContent = msg || "";
  }

  function clearErrs(ids) {
    ids.forEach(function (id) { setErr(id, ""); });
  }

  /* ---------------- step 1: contact ---------------- */

  if (auth) {
    el("f-email").value = auth.email;
    el("signin-link").hidden = true;
  }

  el("btn-1").addEventListener("click", function () {
    var email = el("f-email").value.trim();
    if (!OEValidate.email(email)) {
      setErr("f-email", "Enter a valid email address, like you@example.com");
      el("f-email").focus();
      return;
    }
    setErr("f-email", "");
    state.email = email;
    complete(1, email);
  });

  /* ---------------- step 2: address ---------------- */

  var ADDR_FIELDS = {
    firstName: "f-first", lastName: "f-last", line1: "f-line1",
    city: "f-city", state: "f-state", postal: "f-postal", phone: "f-phone"
  };
  var ADDR_ORDER = ["f-first", "f-last", "f-line1", "f-city", "f-state", "f-postal", "f-phone"];

  // country select + postal hint
  var countrySel = el("f-country");
  countrySel.innerHTML = OEValidate.COUNTRIES.map(function (c) {
    return '<option value="' + c[0] + '">' + esc(c[1]) + "</option>";
  }).join("");
  function updatePostalHint() {
    el("f-postal-hint").textContent = OEValidate.postal(countrySel.value, "").hint;
  }
  countrySel.addEventListener("change", updatePostalHint);
  updatePostalHint();

  function formatAddr(a) {
    return a.firstName + " " + a.lastName + ", " + a.line1 +
      (a.line2 ? " " + a.line2 : "") + ", " + a.city + ", " + a.state + " " + a.postal;
  }

  var addrChoice = savedAddresses.length ? null : "new"; // null until radios render

  if (savedAddresses.length) {
    var defAddr = savedAddresses.filter(function (a) { return a.isDefaultShipping; })[0] || savedAddresses[0];
    addrChoice = defAddr.id;
    el("addr-saved").hidden = false;
    el("addr-saved").innerHTML = savedAddresses.map(function (a) {
      return (
        '<label class="co-radio">' +
          '<input type="radio" name="addr" value="' + esc(a.id) + '"' + (a.id === defAddr.id ? " checked" : "") + ">" +
          '<span class="co-radio-main">' +
            '<span class="co-radio-title">' + esc(a.firstName + " " + a.lastName) + "</span>" +
            '<span class="co-radio-sub">' + esc(a.line1 + (a.line2 ? ", " + a.line2 : "") + ", " + a.city + ", " + a.state + " " + a.postal) + "</span>" +
          "</span>" +
          (a.isDefaultShipping ? '<span class="co-radio-badge">Default</span>' : "") +
        "</label>"
      );
    }).join("") +
      '<label class="co-radio">' +
        '<input type="radio" name="addr" value="new">' +
        '<span class="co-radio-main"><span class="co-radio-title">Add new address</span></span>' +
      "</label>";
    el("addr-saved").addEventListener("change", function (e) {
      if (e.target.name !== "addr") return;
      addrChoice = e.target.value;
      el("addr-form").hidden = addrChoice !== "new";
      if (addrChoice === "new") el("f-first").focus();
    });
  } else {
    el("addr-form").hidden = false;
  }
  if (auth) el("save-addr-wrap").hidden = false;

  function readAddrForm() {
    return {
      firstName: el("f-first").value.trim(),
      lastName: el("f-last").value.trim(),
      line1: el("f-line1").value.trim(),
      line2: el("f-line2").value.trim(),
      city: el("f-city").value.trim(),
      state: el("f-state").value.trim(),
      country: countrySel.value,
      postal: el("f-postal").value.trim(),
      phone: el("f-phone").value.trim()
    };
  }

  el("btn-2").addEventListener("click", function () {
    if (addrChoice !== "new") {
      var saved = savedAddresses.filter(function (a) { return a.id === addrChoice; })[0];
      state.address = {
        firstName: saved.firstName, lastName: saved.lastName,
        line1: saved.line1, line2: saved.line2, city: saved.city, state: saved.state,
        postal: saved.postal, country: saved.country, phone: saved.phone
      };
      complete(2, formatAddr(state.address));
      return;
    }
    clearErrs(ADDR_ORDER);
    var form = readAddrForm();
    var result = OEValidate.addressForm(form);
    if (!result.ok) {
      Object.keys(result.errors).forEach(function (key) {
        if (ADDR_FIELDS[key]) setErr(ADDR_FIELDS[key], result.errors[key]);
      });
      var first = ADDR_ORDER.filter(function (id) {
        return el(id).getAttribute("aria-invalid") === "true";
      })[0];
      if (first) el(first).focus();
      return;
    }
    state.address = form;
    if (auth && el("f-saveaddr").checked) {
      OEStore.addresses.add({
        firstName: form.firstName, lastName: form.lastName,
        line1: form.line1, line2: form.line2, city: form.city, state: form.state,
        postal: form.postal, country: form.country, phone: form.phone,
        isDefaultShipping: false, isDefaultBilling: false
      });
      savedAddresses = OEStore.addresses.get();
      toast("Address saved to your account");
    }
    complete(2, formatAddr(form));
  });

  /* ---------------- step 3: shipping ---------------- */

  if (subtotal >= FREE_SHIP_MIN) {
    el("ship-standard-price").textContent = "Free";
    el("ship-standard-price").classList.add("co-sum-free");
  }

  /* demo delivery promises (calendar days; disclosed in the footer) */
  var ETA_DAYS = { standard: 5, express: 2, overnight: 1 };
  function etaDate(method) {
    var d = new Date();
    d.setDate(d.getDate() + ETA_DAYS[method]);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  ["standard", "express", "overnight"].forEach(function (m) {
    var span = el("eta-" + m);
    if (span) span.textContent = "Arrives by " + etaDate(m);
  });

  function shipSummary() {
    var s = SHIP[state.shipping];
    var cost = shippingCost();
    return s.label + " · arrives by " + etaDate(state.shipping) + " · " + (cost === 0 ? "Free" : money(cost));
  }

  document.querySelectorAll('input[name="ship"]').forEach(function (r) {
    r.addEventListener("change", function () {
      state.shipping = this.value;
      renderAside();
    });
  });

  el("btn-3").addEventListener("click", function () {
    complete(3, shipSummary());
  });

  /* ---------------- step 4: payment ---------------- */

  var cardChoice = savedCards.length ? null : "new";

  if (savedCards.length) {
    var defCard = savedCards.filter(function (c) { return c.isDefault; })[0] || savedCards[0];
    cardChoice = defCard.id;
    var netLabel = { visa: "Visa", mastercard: "Mastercard", amex: "Amex" };
    el("card-saved").hidden = false;
    el("card-saved").innerHTML = savedCards.map(function (c) {
      var exp = String(c.expMonth).padStart(2, "0") + "/" + String(c.expYear).slice(-2);
      return (
        '<label class="co-radio">' +
          '<input type="radio" name="card" value="' + esc(c.id) + '"' + (c.id === defCard.id ? " checked" : "") + ">" +
          '<span class="co-radio-main">' +
            '<span class="co-radio-title">' + esc(netLabel[c.network] || c.network) + " •••• " + esc(c.last4) + "</span>" +
            '<span class="co-radio-sub">Expires ' + esc(exp) + "</span>" +
          "</span>" +
          (c.isDefault ? '<span class="co-radio-badge">Default</span>' : "") +
        "</label>"
      );
    }).join("") +
      '<label class="co-radio">' +
        '<input type="radio" name="card" value="new">' +
        '<span class="co-radio-main"><span class="co-radio-title">Use a new card</span></span>' +
      "</label>";
    el("card-saved").addEventListener("change", function (e) {
      if (e.target.name !== "card") return;
      cardChoice = e.target.value;
      el("card-form").hidden = cardChoice !== "new";
      if (cardChoice === "new") el("c-number").focus();
    });
  } else {
    el("card-form").hidden = false;
  }
  if (auth) el("save-card-wrap").hidden = false;

  // live formatting: 4-4-4-4 groups + network badge
  el("c-number").addEventListener("input", function () {
    var digits = this.value.replace(/\D/g, "").slice(0, 19);
    this.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
    var net = OEValidate.cardNetwork(digits);
    var badge = el("c-network");
    badge.hidden = !net;
    badge.textContent = net || "";
  });

  el("c-exp").addEventListener("input", function () {
    var digits = this.value.replace(/\D/g, "").slice(0, 4);
    this.value = digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
  });

  el("c-cvc").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 4);
  });

  var CARD_IDS = ["c-number", "c-exp", "c-cvc", "c-name"];

  function validateCardForm() {
    clearErrs(CARD_IDS);
    var pan = el("c-number").value.replace(/\D/g, "");
    var net = OEValidate.cardNetwork(pan);
    if (!OEValidate.luhn(pan)) setErr("c-number", "Enter a valid card number");
    else if (!net) setErr("c-number", "We accept Visa, Mastercard and Amex");
    var exp = el("c-exp").value.split("/");
    var expResult = OEValidate.expiry(exp[0], exp[1]);
    if (!expResult.ok) setErr("c-exp", "Enter a valid future date as MM/YY");
    if (!/^\d{3,4}$/.test(el("c-cvc").value)) setErr("c-cvc", "Enter the 3 or 4 digit code");
    if (!el("c-name").value.trim()) setErr("c-name", "Enter the name on the card");
    var firstBad = CARD_IDS.filter(function (id) {
      return el(id).getAttribute("aria-invalid") === "true";
    })[0];
    if (firstBad) { el(firstBad).focus(); return null; }
    return {
      pan: pan,
      network: net,
      last4: pan.slice(-4),
      expMonth: parseInt(exp[0], 10),
      expYear: 2000 + parseInt(exp[1], 10)
    };
  }

  /* ---------------- the order write ---------------- */

  function buildOrder(payment) {
    var placedAt = Date.now();
    var t = OEStore.totals(cart, shippingCost(), discountAmount());
    var order = {
      id: OEStore.orders.nextId(),
      placedAt: placedAt,
      status: "processing",
      email: state.email,
      guest: !auth,
      key: OEStore.orders.newKey(),
      lines: cart.map(function (l) {
        return { id: l.id, brand: l.brand, name: l.name, price: l.price, img: l.img, conc: l.conc, size: l.size, qty: l.qty };
      }),
      subtotal: t.subtotal,
      discount: t.discount,
      shipping: t.shipping,
      tax: t.tax,
      total: t.total,
      shippingMethod: SHIP[state.shipping].label + " (" + SHIP[state.shipping].eta + ")",
      address: state.address,
      payment: { network: payment.network, last4: payment.last4 },
      fulfillments: [],
      timeline: [{ status: "processing", at: placedAt }]
    };
    if (!auth) order.guestToken = OEStore.orders.newToken();
    order.shipment = OEShip.buyLabel({
      orderId: order.id,
      speed: state.shipping,
      dest: state.address ? state.address.city + ", " + state.address.state : "New York, NY"
    });
    return order;
  }

  function lockPay(locked) {
    el("pay-btn").disabled = locked;
    el("pay-status").hidden = !locked;
  }

  el("pay-btn").addEventListener("click", function () {
    el("gateway-err").hidden = true;
    el("gateway-err").textContent = "";

    var payment;
    if (cardChoice !== "new") {
      var saved = savedCards.filter(function (c) { return c.id === cardChoice; })[0];
      payment = { pan: null, network: saved.network, last4: saved.last4 };
    } else {
      payment = validateCardForm();
      if (!payment) return;
    }

    lockPay(true);
    window.setTimeout(function () {
      if (payment.pan === DECLINE_PAN) {
        lockPay(false);
        var g = el("gateway-err");
        g.textContent = "Your card was declined by the payment provider (code: card_declined). No charge was made. Try a different card.";
        g.hidden = false;
        el("c-number").focus();
        return;
      }
      // the cart may have been emptied or purchased from another tab while
      // this tab sat on the payment step; never write an order for stale lines
      if (!refreshCart()) return;
      if (auth && cardChoice === "new" && el("c-save").checked) {
        OEStore.cards.add({
          network: payment.network, last4: payment.last4,
          expMonth: payment.expMonth, expYear: payment.expYear, isDefault: false
        });
      }
      completing = true;
      var order = buildOrder(payment);
      OEStore.orders.add(order);
      OEStore.cart.clear();
      try { window.sessionStorage.removeItem("oe.checkout.discount"); } catch (e) {}
      window.location.href = "../confirmation/?id=" + encodeURIComponent(order.id) + "&key=" + encodeURIComponent(order.key);
    }, 1500);
  });

  /* ---------------- boot ---------------- */

  renderAside();
  if (auth) {
    state.done[1] = true;
    el("sum-1").textContent = auth.email;
    setStep(2);
  } else {
    setStep(1);
    el("f-email").focus();
  }
})();
