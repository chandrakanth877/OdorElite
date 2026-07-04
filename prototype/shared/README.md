# prototype/shared — contracts

**Build agents: never edit files in this directory** (or in `prototype/home/`, `prototype/list/`).
If a shared gap blocks your page, note it in your final report; the orchestrator amends shared
files between batches. The binding contract is the master spec:
`docs/superpowers/specs/2026-07-04-odorelite-prototype-pages-design.md` (§1-§7).

## Page skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>… | OdorElite</title>
  <link rel="icon" href="../../assets/logo/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Archivo:wght@700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
<main>
  <!-- page content only; chrome is injected -->
</main>
<script>window.OE_PAGE = { active: null };</script>
<!-- page data scripts here (if any) -->
<script src="../shared/store.js"></script>
<script src="../shared/ui.js"></script>
<script src="../shared/validators.js"></script>
<script src="../shared/chrome.js"></script>
<script src="app.js"></script>
</body>
</html>
```

`styles.css` first lines:

```css
@import url("../home/styles.css");
@import url("../shared/shared.css");
```

- `OE_PAGE.active`: highlights a nav item — one of `all|women|men|unisex|niche|brands|new|deals` or null.
- `OE_PAGE.minimal: true` — checkout only (logo + secure line, no nav/search, slim footer).
- `OE_PAGE.onSearch(q)` — only the search page sets this to intercept header submits.

## What you get

- `OEStore` — cart/wishlist/auth/orders/addresses/cards (localStorage, seeded, `oe:state` events). Schema in spec §3. Cart/wishlist lines are denormalized snapshots; prices may drift from re-curated data — accepted prototype trade-off.
- `OEUI` — productCard (links to `../pdp/?id=`, hearts/ATC pre-wired via delegation; pass full records, they register automatically), miniCart, statusChip, orderTimeline, trackingCard, orderSummaryCard, claimAccountCard, accountShell, requireAuth, qtyStepper, notFound. Globals: `esc, money, el, toast, imgTag`, `window.__oeImgFail`.
- `OEValidate` — email/password/postal/phone/luhn/cardNetwork/expiry/addressForm + COUNTRIES.
- `shared.css` — `[hidden]{display:none!important}` global guard, mini-cart, chips, timeline, osc, claim, account shell, `.field` form kit, `.strength` meter, confirm dialog, `.page-head`, `.card-panel`, `.oe-notfound`.

## Rules recap

Zero console errors. AA contrast (`--oe-gold-text`/`--oe-accent-text` for small text on light; muted text ≥ gray-500). No em-dashes in copy. `prefers-reduced-motion` respected (check `OEUI.reducedMotion`). Every image via `imgTag()`. Unknown URL params → `OEUI.notFound(...)` into your main. Demo affordances must be labeled as demo.
