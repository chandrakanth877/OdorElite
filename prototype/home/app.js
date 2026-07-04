/* OdorElite home prototype — page rendering.
   Chrome, state, card renderer, toast, esc/money/el/imgTag come from
   ../shared/ (chrome.js, store.js, ui.js). */
(function () {
  "use strict";

  var DATA = window.ODORELITE_DATA;
  if (!DATA) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var productCard = OEUI.productCard;

  /* ---------- 3 · hero ---------- */

  var EYEBROWS = ["Featured house", "Limited edition", "New York icon"];

  el("hero-slides").innerHTML = DATA.hero.map(function (h, i) {
    var save = h.compareAt ? Math.round(100 * (h.compareAt - h.price) / h.compareAt) : 0;
    return (
      '<div class="hero-slide' + (i === 0 ? " active" : "") + '" data-slide="' + i + '">' +
        '<div class="hero-copy">' +
          '<p class="eyebrow">' + esc(EYEBROWS[i] || "Featured") + " · " + esc(h.brand) + "</p>" +
          '<h1 class="hero-title">' + esc(h.name) + "</h1>" +
          '<p class="hero-desc">' + esc(h.desc) + "</p>" +
          '<div class="hero-priceline">' +
            '<span class="hero-price-now">' + money(h.price) + "</span>" +
            (h.compareAt ? '<span class="hero-price-was">' + money(h.compareAt) + "</span>" : "") +
            (save > 0 ? '<span class="hero-price-save">' + save + "% off</span>" : "") +
          "</div>" +
          '<div class="hero-ctas">' +
            '<a class="btn btn-gold" href="#deals">Shop now</a>' +
            '<a class="btn btn-ghost-light" href="../list/?category=niche">Explore niche</a>' +
          "</div>" +
        "</div>" +
        '<div class="hero-media">' + imgTag(h.heroImg || h.img, h.brand + " " + h.name, i === 0) + "</div>" +
      "</div>"
    );
  }).join("");

  el("hero-dots").innerHTML = DATA.hero.map(function (_, i) {
    return '<button class="hero-dot' + (i === 0 ? " active" : "") + '" data-dot="' + i +
      '" aria-label="Slide ' + (i + 1) + '"' + (i === 0 ? ' aria-current="true"' : "") + "></button>";
  }).join("");

  var slideIdx = 0;
  var slides = document.querySelectorAll(".hero-slide");
  var dots = document.querySelectorAll(".hero-dot");

  function goSlide(i) {
    slideIdx = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) { s.classList.toggle("active", k === slideIdx); });
    dots.forEach(function (d, k) {
      d.classList.toggle("active", k === slideIdx);
      if (k === slideIdx) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
  }

  dots.forEach(function (d) {
    d.addEventListener("click", function () {
      goSlide(Number(d.dataset.dot));
      restartAuto();
    });
  });

  var autoTimer = null;
  function stopAuto() { clearInterval(autoTimer); autoTimer = null; }
  function startAuto() {
    if (reducedMotion || slides.length < 2) return;
    stopAuto(); // never stack intervals (mouseleave/focusout call this unconditionally)
    autoTimer = setInterval(function () { goSlide(slideIdx + 1); }, 6000);
  }
  function restartAuto() { stopAuto(); startAuto(); }

  var heroBox = el("hero");
  heroBox.addEventListener("mouseenter", stopAuto);
  heroBox.addEventListener("mouseleave", startAuto);
  heroBox.addEventListener("focusin", stopAuto);
  heroBox.addEventListener("focusout", startAuto);
  startAuto();

  /* ---------- hero side promos ---------- */

  var promoMeta = [
    { kicker: "Deal of the week", cls: "promo-light", link: "Shop deals", href: "../list/?disc=50" },
    { kicker: "Just landed · niche", cls: "promo-navy", link: "Discover", href: "../list/?category=niche" },
  ];
  el("hero-side").innerHTML = DATA.promos.map(function (p, i) {
    var m = promoMeta[i] || promoMeta[0];
    return (
      '<a class="promo-card ' + m.cls + '" href="' + m.href + '">' +
        (p.discount >= 40 ? '<span class="promo-flag">-' + p.discount + "%</span>" : "") +
        "<div>" +
          '<p class="promo-kicker">' + m.kicker + "</p>" +
          '<p class="promo-title">' + esc(p.brand) + " " + esc(p.name) + "</p>" +
          '<p class="promo-sub">' + money(p.price) +
            (p.compareAt ? ' <s>' + money(p.compareAt) + "</s>" : "") + "</p>" +
          '<span class="promo-link">' + m.link + "</span>" +
        "</div>" +
        imgTag(p.img, p.brand + " " + p.name) +
      "</a>"
    );
  }).join("");

  /* ---------- 4 · deal grid ---------- */

  var TILE_LINKS = {
    "Flash deals under $30": "../list/?max=30&disc=50",
    "70%+ off": "../list/?disc=70",
    "Niche picks": "../list/?category=niche",
    "Designer classics": "../list/?stock=1",
    "Arabian house gems": "../list/?brand=Lattafa%2CArmaf%2CMaison%20Alhambra%2CAfnan",
    "New arrivals": "../list/?sort=newest"
  };
  el("deal-grid").innerHTML = DATA.dealGrid.map(function (t) {
    var p = t.product;
    return (
      '<a class="deal-tile" href="' + (TILE_LINKS[t.label] || "../list/") + '">' +
        '<p class="deal-tile-label">' + esc(t.label) + "</p>" +
        '<p class="deal-tile-sub">' + esc(t.sub) + "</p>" +
        '<span class="deal-tile-link">Shop now</span>' +
        '<div class="deal-tile-media">' +
          (p.discount >= 50 ? '<span class="deal-tile-off">-' + p.discount + "%</span>" : "") +
          imgTag(p.img, p.brand + " " + p.name) +
        "</div>" +
      "</a>"
    );
  }).join("");

  /* ---------- rails ---------- */

  el("deals-rail").innerHTML = DATA.dealsRail.map(productCard).join("");
  el("trending-rail").innerHTML = DATA.trendingRail.map(productCard).join("");
  el("niche-rail").innerHTML = DATA.nicheRail.map(productCard).join("");

  document.querySelectorAll(".rail-arrow").forEach(function (btn) {
    var rail = el(btn.dataset.rail);
    var dir = Number(btn.dataset.dir);

    function update() {
      var max = rail.scrollWidth - rail.clientWidth - 4;
      if (dir < 0) btn.disabled = rail.scrollLeft <= 4;
      else btn.disabled = rail.scrollLeft >= max;
    }
    btn.addEventListener("click", function () {
      rail.scrollBy({ left: dir * (rail.clientWidth - 80), behavior: reducedMotion ? "auto" : "smooth" });
    });
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  });

  /* ---------- 6 · categories ---------- */

  el("cat-grid").innerHTML = DATA.categories.map(function (c) {
    return (
      '<a class="cat-tile" href="../list/?category=' + encodeURIComponent(c.label.toLowerCase()) + '">' +
        imgTag(c.img, c.label + " fragrances") +
        '<span class="cat-tile-label">' +
          '<span class="cat-tile-name">' + esc(c.label) + "</span>" +
          '<span class="cat-tile-count">' + Number(c.count).toLocaleString() + " fragrances</span>" +
        "</span>" +
      "</a>"
    );
  }).join("");

  /* ---------- 8 · brands ---------- */

  el("brand-grid").innerHTML = DATA.brands.map(function (b) {
    return (
      '<a class="brand-tile" href="../list/?brand=' + encodeURIComponent(b) + '">' +
        '<span class="brand-tile-name">' + esc(b) + "</span>" +
        '<span class="brand-tile-cta">Shop the house</span>' +
      "</a>"
    );
  }).join("");

  /* ---------- 10 · buckets ---------- */

  el("bucket-grid").innerHTML = DATA.buckets.map(function (b) {
    return (
      '<div class="bucket">' +
        '<div class="bucket-head">' +
          '<span class="bucket-cap">$' + b.cap + "</span>" +
          '<span class="bucket-label">' + esc(b.label.replace("Gifts under $" + b.cap, "& under")) + "</span>" +
        "</div>" +
        '<div class="bucket-products">' +
          b.products.map(function (p) {
            return (
              '<a class="bucket-item" href="#">' +
                imgTag(p.img, p.brand + " " + p.name) +
                '<p class="bucket-item-name">' + esc(p.brand) + " " + esc(p.name) + "</p>" +
                '<p class="bucket-item-price">' + money(p.price) +
                  (p.compareAt ? '<span class="bucket-item-was">' + money(p.compareAt) + "</span>" : "") + "</p>" +
              "</a>"
            );
          }).join("") +
        "</div>" +
        '<a class="bucket-link" href="../list/?max=' + b.cap + '&stock=1">Shop all under $' + b.cap + "</a>" +
      "</div>"
    );
  }).join("");

  /* ---------- 11 · guides ---------- */

  el("guide-grid").innerHTML = DATA.guides.map(function (g) {
    return (
      '<a class="guide-card" href="#">' +
        '<div class="guide-media">' + imgTag(g.img, g.title) + "</div>" +
        '<div class="guide-body">' +
          '<p class="guide-tag">' + esc(g.tag) + "</p>" +
          '<p class="guide-title">' + esc(g.title) + "</p>" +
          '<p class="guide-excerpt">' + esc(g.excerpt) + "</p>" +
          '<span class="guide-cta">Read guide</span>' +
        "</div>" +
      "</a>"
    );
  }).join("");

  /* wishlist hearts + add-to-cart are handled by OEUI's delegated listener */

  /* ---------- 13 · newsletter ---------- */

  el("newsletter-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = el("newsletter-email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast("That email doesn’t look right — try again?");
      return;
    }
    el("newsletter-email").value = "";
    toast("You’re on the list. First dispatch lands Friday ✨");
  });

  /* ---------- scroll reveal ---------- */

  if (!reducedMotion && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px 120px 0px" });
    document.querySelectorAll("main .section, .trust, .newsletter").forEach(function (s) {
      s.classList.add("reveal");
      io.observe(s);
    });
  }
})();
