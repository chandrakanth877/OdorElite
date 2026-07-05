/* OEChrome — injects the shared announce bar, header, nav, footer, and toast
   into every prototype page and binds their behavior. Markup mirrors the
   original prototype/home chrome; CSS lives in ../home/styles.css.
   Auto-inits from window.OE_PAGE = { active, minimal }. */
(function () {
  "use strict";

  var LOGO_BARS =
    '<svg class="logo-bars" viewBox="0 0 30 20" aria-hidden="true"><rect x="0" y="0" width="2" height="9" fill="currentColor"/><rect x="7" y="0" width="2" height="14" fill="currentColor"/><rect x="14" y="0" width="2" height="20" fill="currentColor"/><rect x="21" y="0" width="2" height="14" fill="currentColor"/><rect x="28" y="0" width="2" height="9" fill="currentColor"/></svg>';

  var LOGO_FULL =
    '<svg class="logo-full" viewBox="14 22 214 60" aria-hidden="true">' +
      '<rect x="16.00" y="32" width="2.00" height="9.00" fill="#C9A96E"></rect><rect x="23.00" y="32" width="2.00" height="14.00" fill="#C9A96E"></rect><rect x="30.00" y="32" width="2.00" height="20.00" fill="#C9A96E"></rect><rect x="37.00" y="32" width="2.00" height="14.00" fill="#C9A96E"></rect><rect x="44.00" y="32" width="2.00" height="9.00" fill="#C9A96E"></rect>' +
      '<text x="58" y="54" font-family="\'Cormorant Garamond\',Georgia,serif" font-size="38" font-weight="500"><tspan fill="#F6FAFD">Odor</tspan><tspan font-style="italic" fill="#C9A96E">Elite</tspan></text>' +
      '<text x="59" y="76" font-family="\'Archivo\',Arial,sans-serif" font-weight="700" font-size="8.5" letter-spacing="3.4" fill="#F6FAFD" opacity="0.55">EST. 2026 · ROTTERDAM</text>' +
    "</svg>";

  var NAV_ITEMS = [
    ["all", "All", "../list/", true],
    ["women", "Women", "../list/?category=women"],
    ["men", "Men", "../list/?category=men"],
    ["unisex", "Unisex", "../list/?category=unisex"],
    ["niche", "Niche", "../list/?category=niche"],
    ["brands", "Brands", "../brands/"],
    ["new", "New Arrivals", "../list/?sort=newest"],
    ["deals", "Today's Deals", "../list/?disc=50"]
  ];

  function announceHtml() {
    return (
      '<div class="announce" id="announce">' +
        '<p><span class="announce-gold">Free US shipping over $50</span><span class="announce-sep">&#9670;</span>100% authentic fragrances, guaranteed</p>' +
        '<button class="announce-close" id="announce-close" aria-label="Dismiss announcement">&times;</button>' +
      "</div>"
    );
  }

  function headerHtml(cfg) {
    var auth = window.OEStore ? OEStore.auth.get() : null;
    var accountHref = auth ? "../account/" : "../sign-in/";
    var accountTop = auth ? "Hi, " + esc(auth.firstName) : "Hello, sign in";
    if (cfg.minimal) {
      return (
        '<header class="header header-minimal" id="header">' +
          '<div class="header-main container">' +
            '<a class="logo" href="../home/" id="minimal-logo" aria-label="OdorElite home">' + LOGO_BARS +
              '<span class="logo-word">Odor<em>Elite</em></span></a>' +
            '<p class="header-secure"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Secure checkout</p>' +
          "</div>" +
        "</header>"
      );
    }
    return (
      '<header class="header" id="header">' +
        '<div class="header-main container">' +
          '<a class="logo" href="../home/" aria-label="OdorElite home">' + LOGO_BARS +
            '<span class="logo-word">Odor<em>Elite</em></span></a>' +
          '<form class="search" id="search-form" role="search">' +
            '<input class="search-input" id="search-input" type="search" placeholder="Search 4,800+ fragrances, brands, notes" aria-label="Search fragrances">' +
            '<button class="search-btn" type="submit" aria-label="Search">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
            "</button>" +
          "</form>" +
          '<div class="header-actions">' +
            '<a class="h-action h-account" id="h-account" href="' + accountHref + '">' +
              '<span class="h-action-top" id="h-account-top">' + accountTop + "</span>" +
              '<span class="h-action-bottom">Account</span>' +
            "</a>" +
            '<a class="h-action h-icon" id="wishlist-btn" href="../wishlist/" aria-label="Wishlist">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' +
              '<span class="h-badge" id="wishlist-badge" hidden>0</span>' +
            "</a>" +
            '<button class="h-action h-icon h-cart" id="cart-btn" aria-label="Cart">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>' +
              '<span class="h-badge" id="cart-badge" hidden>0</span>' +
              '<span class="h-cart-label">Cart</span>' +
            "</button>" +
          "</div>" +
        "</div>" +
        '<nav class="header-nav" aria-label="Departments">' +
          '<div class="container header-nav-inner">' +
            NAV_ITEMS.map(function (n) {
              var cls = "nav-link" + (n[0] === "all" ? " nav-all" : "") + (n[0] === "deals" ? " nav-deals" : "") +
                (cfg.active === n[0] ? " nav-active" : "");
              var icon = n[0] === "all"
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
                : "";
              return '<a href="' + n[2] + '" class="' + cls + '"' + (cfg.active === n[0] ? ' aria-current="page"' : "") + ">" + icon + n[1] + "</a>";
            }).join("") +
          "</div>" +
        "</nav>" +
      "</header>"
    );
  }

  function footerHtml(cfg) {
    if (cfg.minimal) {
      return (
        '<footer class="footer footer-minimal">' +
          '<div class="container footer-legal">' +
            "<p>&copy; 2026 OdorElite. All rights reserved. Prototype, not a live store. Ratings, review counts, delivery dates and carrier tracking events are demo data.</p>" +
            '<div class="footer-pay" aria-label="Accepted payment methods"><span>Visa</span><span>Mastercard</span><span>Amex</span><span>PayPal</span></div>' +
          "</div>" +
        "</footer>"
      );
    }
    return (
      '<footer class="footer">' +
        '<div class="container footer-cols">' +
          '<div class="footer-brand">' +
            '<a class="logo" href="../home/" aria-label="OdorElite home">' + LOGO_FULL + "</a>" +
            "<p>Designer &amp; niche fragrances at up to 89% off retail. Every bottle authentic, every order insured.</p>" +
          "</div>" +
          '<nav aria-label="Shop"><h3>Shop</h3>' +
            '<a href="../list/?category=women">Women\'s fragrances</a>' +
            '<a href="../list/?category=men">Men\'s fragrances</a>' +
            '<a href="../list/?category=unisex">Unisex fragrances</a>' +
            '<a href="../list/?category=niche">Niche collection</a>' +
            '<a href="../list/?disc=50">Today\'s deals</a>' +
          "</nav>" +
          '<nav aria-label="Help"><h3>Help</h3>' +
            '<a href="../track/">Track your order</a>' +
            '<a href="../content/?page=shipping">Shipping &amp; delivery</a>' +
            '<a href="../content/?page=returns">Returns &amp; refunds</a>' +
            '<a href="mailto:demo@odorelite.example">Contact us</a>' +
            '<a href="../content/">Guides &amp; FAQ</a>' +
          "</nav>" +
          '<nav aria-label="Company"><h3>Company</h3>' +
            '<a href="../content/?page=guide-signature-scent">Find your scent</a>' +
            '<a href="../content/?page=returns">Authenticity promise</a>' +
            '<a href="../content/">Fragrance guides</a>' +
            '<a href="../content/?page=privacy">Privacy policy</a>' +
            '<a href="../content/?page=terms">Terms of service</a>' +
          "</nav>" +
        "</div>" +
        '<div class="footer-divider" aria-hidden="true"></div>' +
        '<div class="container footer-legal">' +
          "<p>&copy; 2026 OdorElite. All rights reserved. Prototype, not a live store. Ratings, review counts, delivery dates and carrier tracking events are demo data.</p>" +
          '<div class="footer-pay" aria-label="Accepted payment methods"><span>Visa</span><span>Mastercard</span><span>Amex</span><span>PayPal</span></div>' +
        "</div>" +
      "</footer>"
    );
  }

  function refreshBadges() {
    if (!window.OEStore) return;
    var wb = document.getElementById("wishlist-badge");
    var cb = document.getElementById("cart-badge");
    if (wb) {
      var wc = OEStore.wishlist.count();
      wb.hidden = wc === 0;
      wb.textContent = wc;
    }
    if (cb) {
      var cc = OEStore.cart.count();
      cb.hidden = cc === 0;
      cb.textContent = cc;
    }
    var acct = document.getElementById("h-account");
    var top = document.getElementById("h-account-top");
    if (acct && top) {
      var auth = OEStore.auth.get();
      acct.href = auth ? "../account/" : "../sign-in/";
      top.textContent = auth ? "Hi, " + auth.firstName : "Hello, sign in";
    }
  }

  function init(cfg) {
    cfg = cfg || {};
    var ref = document.querySelector("main") || document.body.firstChild;
    var top = document.createElement("div");
    top.innerHTML = announceHtml() + headerHtml(cfg);
    while (top.firstChild) document.body.insertBefore(top.firstChild, ref);
    var bottom = document.createElement("div");
    bottom.innerHTML = footerHtml(cfg);
    while (bottom.firstChild) document.body.appendChild(bottom.firstChild);

    // announce
    var announce = document.getElementById("announce");
    var dismissed = null;
    try { dismissed = window.localStorage.getItem("oe-announce-dismissed"); } catch (e) {}
    if (dismissed === "1" || cfg.minimal) announce.hidden = true;
    document.getElementById("announce-close").addEventListener("click", function () {
      announce.hidden = true;
      try { window.localStorage.setItem("oe-announce-dismissed", "1"); } catch (e) {}
    });

    if (!cfg.minimal) {
      // search
      var form = document.getElementById("search-form");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = document.getElementById("search-input").value.trim();
        if (cfg.onSearch) { cfg.onSearch(q); return; }
        window.location.href = "../search/?q=" + encodeURIComponent(q);
      });
      // cart -> mini-cart
      document.getElementById("cart-btn").addEventListener("click", function () {
        OEUI.miniCart.open();
      });
    } else if (cfg.minimal) {
      var logo = document.getElementById("minimal-logo");
      logo.addEventListener("click", function (e) {
        if (!window.confirm("Leave checkout? Your cart is saved.")) e.preventDefault();
      });
    }

    refreshBadges();
    document.addEventListener("oe:state", refreshBadges);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  window.OEChrome = { init: init, refreshBadges: refreshBadges };

  // auto-init from page config
  init(window.OE_PAGE || {});
})();
