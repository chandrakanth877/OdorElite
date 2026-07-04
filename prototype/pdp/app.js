/* OdorElite PDP: reads ?id=, fetches its detail bucket and hydrates
   the page. Chrome, state, cards, toast, esc/money/el/imgTag come from
   ../shared/ (chrome.js, store.js, ui.js). */
(function () {
  "use strict";

  var CAT_SLUGS = { "Women": "women", "Men": "men", "Unisex": "unisex", "Kids": "kids", "Gift Sets": "gift-sets" };

  /* Fixed pool of hand-written sample reviews (demo content, labeled on
     the page). 3 are picked deterministically from the product id. */
  var REVIEWS = [
    { name: "Priya S.", title: "Exactly as described", body: "The bottle arrived sealed in the original box and the batch code checks out. Smells identical to the tester I tried in a department store, and the price here was far kinder." },
    { name: "Marcus T.", title: "My new signature", body: "I went through a dozen samples before landing on this one. It opens loud but settles into something warm and quiet that people lean in to notice. I get compliments at work without it ever feeling like too much. Projection calms down after the first hour, which I actually prefer, and it still hangs on my collar by evening." },
    { name: "Elena V.", title: "Good value, fast shipping", body: "Ordered on a Sunday, arrived midweek, packed carefully. The scent itself is lovely and carries me through most of the day." },
    { name: "Jordan B.", title: "Better in cool weather", body: "In summer heat it fades quicker than I would like, but on a crisp morning it really blooms. If you are on the fence, try wearing it in the colder months first and you will understand the fuss." },
    { name: "Amina K.", title: "Bought it twice", body: "Finished my first bottle and did not hesitate to reorder. It layers nicely over an unscented lotion and never turns sharp on my skin the way some fragrances do." },
    { name: "Tom R.", title: "Solid blind buy", body: "Picked this up without sampling, based on the note breakdown alone, and got lucky. The drydown is the best part, soft and a little sweet without ever getting cloying." },
    { name: "Lucia M.", title: "A gift that landed", body: "Got this for my partner's birthday. They wear it constantly now, which says more than any review I could write. The presentation out of the box also felt more expensive than what I paid." },
    { name: "Devon P.", title: "Give it twenty minutes", body: "The first spray had me worried, but wait before you judge. Once the opening burns off it turns smooth and honestly kind of addictive. Sillage is moderate and longevity is respectable." },
    { name: "Hannah G.", title: "Office safe and pleasant", body: "I wanted something I could wear in a shared workspace without announcing myself from the hallway. This sits close to the skin, stays polite, and still feels special when I catch it during the day." }
  ];

  var mainEl = document.querySelector("main");
  var params = new URLSearchParams(location.search);
  var rawId = (params.get("id") || "").trim();

  function showNotFound() {
    document.title = "Product not found | OdorElite";
    mainEl.innerHTML = OEUI.notFound(
      "We couldn't find that fragrance",
      "The link may be incomplete, or the bottle is no longer in our catalog."
    );
  }

  if (!/^\d+$/.test(rawId)) {
    showNotFound();
    return;
  }

  fetch("details/bucket-" + OEUI.pdpBucket(rawId) + ".json")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      var rec = data && data[rawId];
      if (!rec) { showNotFound(); return; }
      render(rec);
    })
    .catch(function () { showNotFound(); });

  /* ---------- render ---------- */

  function render(rec) {
    var alt = rec.brand + " " + rec.name;
    document.title = alt + " | OdorElite";
    OEUI.registerProduct(rec);

    renderCrumbs(rec);
    renderGallery(rec, alt);
    renderBuyBox(rec);
    renderNotes(rec);
    renderAccordion(rec);
    renderReviews(rec);
    renderSimilar(rec);
    setupStickyBar(rec, alt);

    el("pdp").hidden = false;
  }

  /* ---------- breadcrumbs ---------- */

  function renderCrumbs(rec) {
    var slug = CAT_SLUGS[rec.cat];
    var catLink = el("crumb-cat");
    catLink.textContent = rec.cat || "Fragrances";
    catLink.href = slug ? "../list/?category=" + slug : "../list/";
    var brandLink = el("crumb-brand");
    brandLink.textContent = rec.brand;
    brandLink.href = "../brand/?name=" + encodeURIComponent(rec.brand);
    el("crumb-current").textContent = rec.name;
    el("crumb-rest").hidden = false;
  }

  /* ---------- gallery ---------- */

  function renderGallery(rec, alt) {
    var gal = (rec.gallery && rec.gallery.length) ? rec.gallery : [{ type: "hero", src: rec.img }];

    function mainAlt(i) {
      return gal.length > 1 ? alt + ", view " + (i + 1) + " of " + gal.length : alt;
    }
    function show(i) {
      el("g-main").innerHTML = imgTag(gal[i].src, mainAlt(i), true);
      var thumbs = el("g-thumbs").querySelectorAll(".pdp-thumb");
      thumbs.forEach(function (t, j) {
        t.classList.toggle("active", j === i);
        t.setAttribute("aria-pressed", j === i ? "true" : "false");
      });
    }

    show(0);
    if (gal.length > 1) {
      el("g-thumbs").innerHTML = gal.map(function (g, i) {
        return (
          '<button type="button" class="pdp-thumb' + (i === 0 ? " active" : "") +
            '" data-gi="' + i + '" aria-pressed="' + (i === 0 ? "true" : "false") +
            '" aria-label="Show image ' + (i + 1) + " of " + gal.length + '">' +
            imgTag(g.src, alt + " thumbnail " + (i + 1)) +
          "</button>"
        );
      }).join("");
      el("g-thumbs").hidden = false;
      el("g-thumbs").addEventListener("click", function (e) {
        var btn = e.target.closest("[data-gi]");
        if (btn) show(Number(btn.dataset.gi));
      });
      show(0);
    }
  }

  /* ---------- buy box ---------- */

  function renderBuyBox(rec) {
    var brandLink = el("bb-brand");
    brandLink.textContent = rec.brand;
    brandLink.href = "../brand/?name=" + encodeURIComponent(rec.brand);
    el("bb-name").textContent = rec.name;

    var meta = "";
    if (rec.conc && rec.conc !== "Other") meta += '<span class="bb-conc">' + esc(rec.conc) + "</span>";
    if (rec.size) meta += '<span class="bb-size">' + esc(rec.size) + "</span>";
    el("bb-meta").innerHTML = meta;
    el("bb-meta").hidden = !meta;

    var save = rec.compareAt ? Math.max(0, rec.compareAt - rec.price) : 0;
    el("bb-priceline").innerHTML =
      '<span class="bb-price' + (rec.avail ? "" : " oos") + '">' + money(rec.price) + "</span>" +
      (rec.compareAt ? '<s class="bb-was">' + money(rec.compareAt) + "</s>" : "") +
      (rec.avail && save > 0 ? '<span class="bb-save">Save ' + money(save) + "</span>" : "");

    el("bb-avail").innerHTML = rec.avail
      ? '<span class="bb-dot bb-dot-in" aria-hidden="true"></span>In stock'
      : '<span class="bb-dot bb-dot-out" aria-hidden="true"></span>Out of stock';

    /* quantity stepper, 1 to MAX_QTY */
    var qty = 1;
    var minus = el("qty-minus"), plus = el("qty-plus");
    function setQty(n) {
      qty = Math.max(1, Math.min(OEStore.MAX_QTY, n));
      el("qty-val").textContent = qty;
      minus.disabled = qty <= 1;
      plus.disabled = qty >= OEStore.MAX_QTY;
    }
    minus.addEventListener("click", function () { setQty(qty - 1); });
    plus.addEventListener("click", function () { setQty(qty + 1); });

    function addToCart() {
      OEStore.cart.add(rec, qty);
      OEUI.miniCart.open(rec.id);
    }

    if (rec.avail) {
      el("bb-atc").addEventListener("click", addToCart);
      el("sticky-atc").addEventListener("click", addToCart);
    } else {
      el("bb-qty").hidden = true;
      el("bb-atc").hidden = true;
      var notify = el("bb-notify");
      notify.hidden = false;
      /* data-notify routes through the shared delegated handler (toast) */
      notify.dataset.notify = rec.brand + " " + rec.name;
    }

    /* wishlist toggle: data-wish routes through the shared delegated
       handler; oe:state keeps heart + label in sync everywhere */
    var wish = el("bb-wish");
    wish.dataset.wish = rec.id;
    function syncWish() {
      var saved = OEStore.wishlist.has(rec.id);
      wish.classList.toggle("active", saved);
      wish.setAttribute("aria-pressed", saved ? "true" : "false");
      el("bb-wish-label").textContent = saved ? "Saved to wishlist" : "Add to wishlist";
    }
    syncWish();
    document.addEventListener("oe:state", syncWish);
  }

  /* ---------- note pyramid ---------- */

  function renderNotes(rec) {
    var tiers = [
      ["Top notes", rec.topNotes],
      ["Heart notes", rec.midNotes],
      ["Base notes", rec.baseNotes]
    ].filter(function (t) { return t[1] && t[1].length; });

    var accords = rec.accords || [];
    if (!tiers.length && !accords.length) return;

    if (tiers.length) {
      el("pyramid").innerHTML = tiers.map(function (t) {
        return (
          '<div class="tier">' +
            '<span class="tier-label">' + esc(t[0]) + "</span>" +
            '<span class="tier-chips">' +
              t[1].map(function (n) { return '<span class="note-chip">' + esc(n) + "</span>"; }).join("") +
            "</span>" +
          "</div>"
        );
      }).join("");
    } else {
      el("pyramid").hidden = true;
    }

    if (accords.length) {
      el("accords").innerHTML =
        '<span class="tier-label">Accords</span>' +
        '<span class="accord-chips">' +
          accords.map(function (a) { return '<span class="accord-chip">' + esc(a) + "</span>"; }).join("") +
        "</span>";
      el("accords").hidden = false;
    }

    el("notes-section").hidden = false;
  }

  /* ---------- accordion ---------- */

  function renderAccordion(rec) {
    var items = [];
    if (rec.desc) items.push(["desc", "Description", "<p>" + esc(rec.desc) + "</p>"]);
    if (rec.scentJourney) items.push(["journey", "Scent journey", "<p>" + esc(rec.scentJourney) + "</p>"]);
    if (rec.brandStory) items.push(["story", "Brand story", "<p>" + esc(rec.brandStory) + "</p>"]);

    var wear = "";
    if (rec.usage) wear += "<p>" + esc(rec.usage) + "</p>";
    var metaRows = "";
    if (rec.perfumer) metaRows += "<dt>Perfumer</dt><dd>" + esc(rec.perfumer) + "</dd>";
    if (rec.launchYear) metaRows += "<dt>Launched</dt><dd>" + esc(rec.launchYear) + "</dd>";
    if (rec.occasions && rec.occasions.length) metaRows += "<dt>Occasions</dt><dd>" + esc(rec.occasions.join(", ")) + "</dd>";
    if (metaRows) wear += '<dl class="acc-meta">' + metaRows + "</dl>";
    if (wear) items.push(["wear", "How to wear", wear]);

    if (!items.length) return;

    el("acc").innerHTML = items.map(function (it, i) {
      var open = i === 0;
      return (
        '<div class="acc-item">' +
          '<h3 class="acc-head"><button type="button" class="acc-btn" id="acc-b-' + it[0] +
            '" data-acc="' + it[0] + '" aria-expanded="' + (open ? "true" : "false") +
            '" aria-controls="acc-p-' + it[0] + '">' + esc(it[1]) +
            '<span class="acc-icon" aria-hidden="true">+</span></button></h3>' +
          '<div class="acc-panel" id="acc-p-' + it[0] + '" role="region" aria-labelledby="acc-b-' + it[0] + '"' +
            (open ? "" : " hidden") + ">" + it[2] + "</div>" +
        "</div>"
      );
    }).join("");

    el("acc").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-acc]");
      if (!btn) return;
      var expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", expanded ? "false" : "true");
      el("acc-p-" + btn.dataset.acc).hidden = expanded;
    });

    el("info-section").hidden = false;
  }

  /* ---------- demo reviews ---------- */

  function renderReviews(rec) {
    var start = Number(rawId) % REVIEWS.length;
    var picks = [
      REVIEWS[start],
      REVIEWS[(start + 1) % REVIEWS.length],
      REVIEWS[(start + 2) % REVIEWS.length]
    ];
    el("reviews").innerHTML = picks.map(function (r) {
      return (
        '<article class="review">' +
          "<h3>" + esc(r.title) + "</h3>" +
          "<p>" + esc(r.body) + "</p>" +
          '<span class="review-name">' + esc(r.name) + "</span>" +
        "</article>"
      );
    }).join("");
    el("reviews-section").hidden = false;
  }

  /* ---------- you may also like ---------- */

  function renderSimilar(rec) {
    var similar = rec.similar || [];
    if (!similar.length) return;

    el("similar-rail").innerHTML = similar.map(function (p) {
      return OEUI.productCard(p);
    }).join("");
    el("similar-section").hidden = false;

    /* rail arrows, house pattern from the home page */
    el("similar-section").querySelectorAll(".rail-arrow").forEach(function (btn) {
      var rail = el(btn.dataset.rail);
      var dir = Number(btn.dataset.dir);
      function update() {
        var max = rail.scrollWidth - rail.clientWidth - 4;
        if (dir < 0) btn.disabled = rail.scrollLeft <= 4;
        else btn.disabled = rail.scrollLeft >= max;
      }
      btn.addEventListener("click", function () {
        rail.scrollBy({ left: dir * (rail.clientWidth - 80), behavior: OEUI.reducedMotion ? "auto" : "smooth" });
      });
      rail.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      update();
    });
  }

  /* ---------- mobile sticky ATC bar ---------- */

  function setupStickyBar(rec, alt) {
    if (!rec.avail || !("IntersectionObserver" in window)) return;

    el("sticky-name").textContent = alt;
    el("sticky-price").textContent = money(rec.price);

    var bar = el("sticky-bar");
    var io = new IntersectionObserver(function (entries) {
      var e = entries[0];
      /* show only once the buy box has scrolled up out of view */
      var passed = !e.isIntersecting && e.boundingClientRect.bottom < 0;
      bar.classList.toggle("show", passed);
    }, { threshold: 0 });
    io.observe(el("buy-box"));
  }
})();
