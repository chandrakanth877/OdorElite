# OdorElite Prototype Pages — Master Design Spec (17 pages)

**Date:** 2026-07-04
**Status:** Approved (plan mode, user-approved)
**Goal:** Build the 17 remaining page prototypes (TRDs 03–19) as standalone HTML/CSS/JS pages under `prototype/`, sharing one chrome, one state store, and one visual system with the finished `prototype/home/` and `prototype/list/`. The result is a fully clickable store demo: browse → PDP → cart → checkout → confirmation → tracking → account.

This spec is the single source of truth for parallel build agents. Sections 1–7 are binding contracts; section 8 is per-page scope.

---

## 1. Ground rules (all pages)

- Plain HTML/CSS/JS. No frameworks, no build step. Served via `python3 -m http.server` from repo root.
- Every page lives at `prototype/<name>/index.html` (depth 2) — relative paths are uniform: `../../downloaded-images/...`, `../../assets/...`, `../home/styles.css`, `../shared/...`.
- Every page's `styles.css` starts with `@import url("../home/styles.css");` (tokens + chrome CSS) then `@import url("../shared/shared.css");` then page-specific rules only.
- Script order in every page: `data script(s)` → `../shared/store.js` → `../shared/ui.js` → `../shared/validators.js` (if forms) → `../shared/chrome.js` → `app.js`.
- **Agents never edit anything in `prototype/shared/`, `prototype/home/`, or `prototype/list/`.** If a shared gap blocks you, note it in your report; the orchestrator amends shared files between batches.
- Honest data: no fake star ratings presented as real, no fake "live" claims. Demo reviews (PDP only) sit under a persistent visible badge "Sample reviews — demo content". Mock orders/cards/addresses belong to the demo persona, never the real user.
- A11y floor: WCAG AA text contrast (small text on light uses `--oe-gold-text` #8D6A2F / `--oe-accent-text` #40729A, never gold-dark/accent raw; muted text ≥ gray-500 on white), visible focus, labels on all inputs, `aria-live` for async feedback, `prefers-reduced-motion` respected, 44px touch targets for primary controls.
- `[hidden]` works globally — `shared.css` ships `[hidden] { display: none !important; }`. Never fight it with inline display.
- Copy rules: no em-dashes (—) anywhere; middle-dot (·) max once per line; no fake-precise numbers unless derived from data; concrete verbs.
- Every `<img>`: `loading="lazy"` (except above-the-fold hero media), `alt`, `onerror="window.__oeImgFail(this)"` (provided by ui.js).
- Unknown/missing URL params → in-page not-found state: gold diamond mark, "We couldn't find that", search box (submits to `../search/?q=`), link back to `../list/`.

## 2. URL scheme

| Page | URL |
|---|---|
| PDP | `prototype/pdp/?id=<numeric id>` |
| Brand index | `prototype/brands/` |
| Brand page | `prototype/brand/?name=<exact brand string, URL-encoded>` |
| Search | `prototype/search/?q=<query>` |
| Wishlist | `prototype/wishlist/` |
| Content | `prototype/content/?page=shipping\|returns\|privacy\|terms\|guide-<slug>` |
| Cart | `prototype/cart/` |
| Checkout | `prototype/checkout/` |
| Confirmation | `prototype/confirmation/?id=<orderId>&key=<key>` (key present for guest orders) |
| Tracking | `prototype/track/` (lookup) · `prototype/track/?token=<guestToken>` (status) |
| Sign in | `prototype/sign-in/?next=<relative path>` |
| Create account | `prototype/create-account/?next=…` |
| Forgot password | `prototype/forgot-password/` (`?token=demo` shows the reset form) |
| Account overview | `prototype/account/` |
| Order history | `prototype/orders/` · detail `prototype/orders/?id=<orderId>` |
| Saved cards | `prototype/cards/` |
| Addresses | `prototype/addresses/` |

`?next` values must be validated: relative same-origin paths only (must start with `../` or `/`, reject anything containing `//` or `:`); invalid → default `../account/`.

## 3. Store contract — `prototype/shared/store.js` (`window.OEStore`)

localStorage keys (all JSON):

| Key | Shape |
|---|---|
| `oe.cart.v1` | `[{id, brand, name, price, compareAt, img, conc, size, qty}]` — denormalized snapshot at add time |
| `oe.wishlist.v1` | `[{id, brand, name, price, compareAt, img, conc, size, avail}]` |
| `oe.auth.v1` | `null` or `{firstName, lastName, email}` (any password accepted; demo auth) |
| `oe.orders.v1` | `[Order]` (see below), newest first |
| `oe.addresses.v1` | `[{id, firstName, lastName, line1, line2, city, state, postal, country, phone, isDefaultShipping, isDefaultBilling}]` |
| `oe.cards.v1` | `[{id, network: "visa"\|"mastercard"\|"amex", last4, expMonth, expYear, isDefault}]` — never a full PAN |
| `oe.seeded.v1` | `"1"` after first seed |
| `oe-announce-dismissed` | `"1"` (pre-existing) |

**Order shape** (binding across checkout, confirmation, track, orders, account):

```json
{
  "id": "OE-2026-00341",
  "placedAt": 1783200000000,
  "status": "processing",
  "email": "ava@example.com",
  "guest": false,
  "guestToken": "t_8f3ka92m",        // only when guest: true
  "key": "k_29dkq0",                  // confirmation access key, always present
  "lines": [{ "id": 533964033, "brand": "…", "name": "…", "price": 25.0, "img": "…", "conc": "EDP", "size": "3.4 oz", "qty": 1 }],
  "subtotal": 25.0, "discount": 0, "shipping": 6.95, "tax": 2.06, "total": 34.01,
  "shippingMethod": "Standard (3-5 business days)",
  "address": { "…address fields, snapshot copy…" },
  "payment": { "network": "visa", "last4": "4242" },
  "fulfillments": [{ "carrier": "UPS", "tracking": "1Z999AA10123456784", "url": "#" }],  // empty until shipped
  "timeline": [{ "status": "processing", "at": 1783200000000 }]   // appended per status change
}
```

Status vocabulary (only these): `processing | shipped | out_for_delivery | delivered | canceled | refunded`. Rendered ONLY via `OEUI.statusChip(status)`.

**API** (all synchronous, all fire `document` CustomEvent `oe:state` with `{detail:{key}}` after writes; store also listens to window `storage` events and re-emits):
`OEStore.cart.get()/add(line)/updateQty(id, qty)/remove(id)/clear()/count()/subtotal()` (add merges on `id`, qty-capped at 10) · `OEStore.wishlist.get()/toggle(item)/has(id)/remove(id)/count()` · `OEStore.auth.get()/signIn({firstName,lastName,email})/signOut()` · `OEStore.orders.get()/byId(id)/byToken(token)/add(order)/updateStatus(id, status)` (updateStatus appends to timeline) · `OEStore.addresses.get()/add()/update()/remove()/setDefault(id, kind)` (kind: `shipping|billing`; invariant: exactly one default of each when ≥1 exists; removing a default promotes the most recent) · `OEStore.cards.get()/add()/remove()/setDefault(id)` (removing default promotes most recent) · `OEStore.reset()` (clears all keys, reseeds).
All getters must survive corrupted JSON (try/catch → return defaults, rewrite key).

**Seeds** (first load only; persona **Ava Laurent, ava@example.com**): 5 orders — `OE-2026-00297` delivered 12 days ago (3 lines, return window open), `OE-2026-00314` shipped (1 fulfillment, UPS), `OE-2026-00341` processing (cancelable), `OE-2026-00268` canceled (+refund note in timeline), `OE-2026-00201` delivered 35 days ago (return window closed). 2 addresses (default: Ava Laurent, 428 Ninth Ave Apt 12, New York NY 10001 US, +1 212 555 0184; secondary: Austin TX). 2 cards (visa 4242 12/27 default; mastercard 4444 09/26 → "expires soon"). Seed product lines use REAL products (ids resolved at seed time from a small embedded list of known-good ids with images). `oe.auth.v1` seeds to `null` (signed out) — sign-in quick-fill uses Ava.

## 4. Chrome contract — `prototype/shared/chrome.js` (`window.OEChrome`)

- Markup: verbatim copies of home's announcement bar, header (logo lockup, search, account/wishlist/cart actions), nav row, footer, toast div — as template strings. Page HTML contains ONLY `<main>` (plus head).
- `OEChrome.init({active, minimal})` — injects announce+header+nav before `<main>`, footer+toast after. `active`: nav item to highlight (`"women" | "men" | "unisex" | "niche" | "new" | "deals" | null`). `minimal: true` (checkout only): header renders logo + secure-checkout line only, no nav/search/footer links (per TRD 09 distraction-free), logo click asks confirm before leaving.
- Behaviors bound by chrome: announce dismiss (`oe-announce-dismissed`), search submit → `../search/?q=<encoded>`, wishlist icon → `../wishlist/`, cart icon → opens mini-cart drawer (from ui.js), account action → `../account/` when signed in else `../sign-in/`; account label shows "Hi, {firstName}" when signed in. Badges hydrate from OEStore on init and on every `oe:state`.
- Nav links (all pages): All→`../list/`, Women/Men/Unisex/Niche→`../list/?category=…`, Brands→`../brands/`, New Arrivals→`../list/?sort=newest`, Today's Deals→`../list/?disc=50`.
- Footer links: shop links → list params; Help: Track your order→`../track/`, Shipping/Returns/FAQ→`../content/?page=…`, Contact→`mailto:demo@odorelite.example`; Company: About/Authenticity/Guides→content pages, Privacy/Terms→content pages.

## 5. UI kit — `prototype/shared/ui.js` (`window.OEUI` + globals)

`esc(s)`, `money(n)`, `el(id)`, `toast(msg)`, `window.__oeImgFail`, `imgTag(src, alt, eager?)` — semantics identical to the existing home/list implementations.
`OEUI.productCard(p, opts)` — the canonical card: image+brand+name link to `../pdp/?id=`, heart routes `OEStore.wishlist.toggle`, ATC routes `OEStore.cart.add` + opens mini-cart; OOS variant (greyed price, Notify me toast). Accepts both listing-record shape (`conc/fam/cat/avail`) and snapshot shape.
`OEUI.miniCart` — right-side drawer: last-added highlight, compact lines with qty/remove, subtotal, "View cart" → `../cart/`, "Checkout" → `../checkout/`; opens on ATC and cart-icon click; Esc/overlay close; focus-visible; body scroll lock; closed state uses `visibility:hidden` pattern.
`OEUI.statusChip(status)` → span with per-status class/colors (processing=info, shipped/out_for_delivery=accent, delivered=success, canceled=gray, refunded=warning).
`OEUI.orderTimeline(order)` → placed→confirmed→shipped→out for delivery→delivered stepper (canceled/refunded render the branch state per TRD 11), current stage highlighted, timestamps from `timeline`.
`OEUI.trackingCard(fulfillment)` · `OEUI.orderSummaryCard(order, {maskEmail})` (mask: `a***@example.com`; pre-delivery guest view shows city/state only) · `OEUI.claimAccountCard(order)` (guest: email pre-filled locked + one password field → writes auth, marks order `guest:false`, swaps to success link) · `OEUI.accountShell(activeTab)` (sidebar desktop / horizontal tabs mobile: Overview `../account/`, Orders `../orders/`, Addresses `../addresses/`, Saved cards `../cards/`, Wishlist `../wishlist/`, Sign out) · `OEUI.qtyStepper(line)` (min 1, max 10) · `OEUI.notFound(title, body)`.

## 6. Validators — `prototype/shared/validators.js` (`window.OEValidate`)

`email(s)` · `password(s)` → `{ok, score 0-4, hints[]}` (min 10 chars, blocks top-20 common) · `postal(country, s)` (US 5 or 5+4; CA A1A 1A1; GB/AE/IN patterns; else non-empty) · `phone(s)` · `luhn(pan)` + `cardNetwork(pan)` (visa/mastercard/amex by prefix) · `expiry(mm, yy)` (future; `expiresSoon` ≤60 days) · `addressForm(fields)` → `{ok, errors:{field: msg}}`. Countries offered: US, CA, GB, AE, IN.

## 7. Data generation (orchestrator-owned, Phase 1)

- `prototype/pdp/curate_pdp.py` → `prototype/pdp/details/bucket-<0..47>.json` (`id % 48`). Record: listing fields + `topNotes/midNotes/baseNotes`, `accords`, `scentJourney`, `brandStory`, `usage`, `perfumer`, `launchYear`, `occasions`, `desc`, **`gallery: [{type, src}]` disk-verified** (hero first; single-image products get length-1 gallery), `similar: [8 compact card records]` (same family, prefer same brand, close price, in-stock preferred, deterministic, excludes self).
- `prototype/search/curate_search.py` → `search/search-notes.js`: `window.ODORELITE_NOTES = {"<id>": "comma,joined,note,and,accord,tokens", …}`.
- `prototype/brands/curate_brands.py` → `brands/brands-data.js`: `window.ODORELITE_BRANDS = [{name, count, inStock, niche (from the shared niche-house list), img (disk-verified), story (first non-empty brand_story excerpt ≤240 chars)}]` sorted A–Z.

## 8. Pages

Every page: chrome via `OEChrome.init`, breadcrumbs under header (Home → … pattern from list page), zero console errors, works at 1440/768/390.

### 8.1 `pdp/` — Product detail (TRD 06)
Sections: breadcrumbs (Home → {cat} → {brand} → {name}); two-column: **gallery** (main image + thumb rail from `gallery[]`; single-image → no rail; click thumbs to swap; no zoom needed) and **buy box** (brand link → `../brand/?name=`, H1, concentration badge + size, mono price + was + save, qty stepper, ATC → store + mini-cart, wishlist toggle, availability line In stock / Out of stock + Notify me, reassurance line: authenticity/shipping/returns); **note pyramid** (Top/Heart/Base chips from real notes; hide tier if empty; accords chip row); **accordion** (Description=desc, Scent journey, Brand story, How to wear=usage + perfumer/launch year/occasions when present); **demo reviews** under persistent badge "Sample reviews — demo content": 3 deterministic reviews (seeded by id from a fixed pool, varied names/lengths), NO aggregate numeric rating in buy box; **"You may also like"** rail from `similar[]` via `OEUI.productCard`; mobile sticky ATC bar (price + button) appearing after buy box scrolls out.
Data: fetch `details/bucket-<id%48>.json`, find record. Fetch failure or id missing → `OEUI.notFound`.
Done: deep-link from list card works; hero-only product renders cleanly; OOS product shows Notify me; ATC updates badge + drawer everywhere.

### 8.2 `search/` — Search results (TRD 05)
Header search input pre-filled with `q`, live re-search on keystroke (150ms debounce) updating URL via replaceState. Corpus: `../list/listing-data.js` + `search-notes.js`. Matching: tokenize query, AND across tokens; token matches brand (weight 3), name (3), family/conc (1), notes (1); prefix matching allowed; results sorted by score then discount. Synonym/typo map (~40 entries) applied per token; when it rewrites, show "Showing results for {corrected}". Exact brand match → banner card linking `../brand/?name=`. Results grid via `OEUI.productCard`, 24 + Load more, count line. Zero results: "No results for {q}" + did-you-mean chip (if map suggests) + popular chips (Vanilla, Oud, Rose, Dior, Creed…) + in-stock bestsellers rail. Empty q → focus input, show popular chips + rail.

### 8.3 `brands/` — Brand index (TRD 03)
H1 All Brands + count; featured strip (8 largest in-stock brands as cards with image + count); sticky A–Z jump bar (letters without brands disabled; active letter highlighted via IntersectionObserver); alphabetical groups: brand name → `../brand/?name=`, product count, NICHE badge where flagged; Niche/Designer/All segment toggle filters client-side.

### 8.4 `brand/` — Brand page (TRD 04)
Reads `?name=`; unknown → notFound. Navy hero band (pattern from list page): brand name H1, story excerpt (from brands-data), stats (products, in stock, top markdown), representative bottle image. Grid of all brand products from listing corpus (client filter), sort select (Featured/Newest/Price↑/Price↓/Discount reusing list sort semantics), count line; in-stock rail "Best of {brand}" (top 4 by discount) above grid.

### 8.5 `content/` — Guides & policies (TRD 07)
`?page=` registry rendered from a static JS content map: policies `shipping`, `returns`, `privacy`, `terms` (hand-written prose, "Last updated July 2026", TOC sidebar for privacy/terms, zero-JS-readable markup) + guides `guide-signature-scent`, `guide-edt-vs-edp`, `guide-layering` (article header, 3–5 sections, one embedded live product card each via `OEUI.productCard` from listing corpus, related-guides cards). Index view when no/unknown param: card grid of all content.

### 8.6 `wishlist/` — Wishlist (TRD 19)
Grid of `oe.wishlist.v1` snapshots via product cards (remove ×, ATC keeps item on list + toast "Still on your wishlist"); OOS items show Notify me; signed-out + ≥1 item → nudge banner "Sign in to keep this wishlist on all your devices" → `../sign-in/?next=../wishlist/`; empty state + in-stock bestsellers rail; header heart badge already synced by chrome.

### 8.7 `cart/` — Cart (TRD 08)
Lines from store: thumb (→ PDP), brand+name, conc/size, mono unit price, qty stepper (max 10), line total, remove (5s undo toast restores), "Move to wishlist". Summary card: subtotal, free-shipping meter ("You're $X away from free shipping" → progress bar → "You've got free shipping" at $50), shipping row ("Free" or "$6.95"), discount input (code `WELCOME10` = 10% off; `EXPIRED10` → "That code has expired"; anything else → "That code isn't valid"; applied → removable chip), estimated tax (8.25%), total; Checkout button → `../checkout/` (disabled when empty). Cross-sell rail (8 in-stock high-discount products). Empty state + bestsellers + "Have an account? Sign in".

### 8.8 `checkout/` — Checkout (TRD 09)
`OEChrome.init({minimal:true})`. Empty cart → redirect `../cart/`. Accordion steps, completed steps collapse to summary + Edit:
1. **Contact** — signed in: prefilled + skip; guest: email (validate) + "Have an account? Sign in" link + newsletter checkbox (unticked).
2. **Address** — signed in: saved-address radio cards + "Add new"; guest/new: shared AddressForm (autocomplete attrs, per-country postal validation, inline errors, focus first error) + "Save to account" checkbox when signed in.
3. **Shipping** — radio cards: Standard $6.95 (3–5 days, free ≥$50), Express $14.95 (2 days), Overnight $24.95; updates totals.
4. **Payment** — saved-card radio cards (signed in) or card form: number (Luhn + network icon live, formats 4-4-4-4), expiry MM/YY, CVC, name; "save this card" checkbox; demo note "Demo checkout: use any Luhn-valid number. 4000 0000 0000 0002 simulates a decline."; Pay button locks with spinner "Processing, don't refresh" ~1.5s; decline card → inline gateway-style error, fields intact; success → build Order (per §3: totals from cart+shipping+discount+tax, guest gets `guestToken`, all get `key`; status `processing`), `OEStore.orders.add`, cart cleared, redirect `../confirmation/?id=…&key=…`.
Aside: sticky order summary (lines, totals, discount chip), collapsible on mobile. Trust footer: payment badges (text pills), terms/privacy links, support contact.

### 8.9 `confirmation/` — Order confirmation (TRD 10)
Reads `?id=&key=`; order missing or key mismatch → neutral fallback ("Check the link in your email") — never an error dump. Renders processing state ~2.5s ("Payment received, finalizing…") then flips confirmed in place (skip flip under reduced motion). Hero: check mark, "Thanks, your order is confirmed", order number, "Confirmation sent to {email}". `OEUI.orderSummaryCard`. CTA: signed-in → "Track your order" `../orders/?id=`; guest → `../track/?token=` + "We emailed you this link". Guest: `OEUI.claimAccountCard`. Cross-sell rail "Complete your collection" (similar to first line item's family). Support strip.

### 8.10 `track/` — Order status (TRD 11)
No token: lookup form (order number + email) → always neutral: "If that order exists, we've emailed a status link." (If the pair actually matches a stored order, ALSO show "Demo shortcut: view order status" linking the token URL — demo affordance, labeled.) With `?token=`: `OEStore.orders.byToken`; unknown token → "This link has expired" + lookup form (indistinguishable from invalid). Status view: `orderTimeline`, `trackingCard` per fulfillment (pre-shipment: ETA copy instead), `orderSummaryCard` with masked email + city/state only (until delivered), actions (contact support mailto with order id, returns policy link, Cancel order while `processing` → confirm dialog → status `canceled` + toast), guest claim card. Delivered: review CTA linking first line's PDP.

### 8.11 `sign-in/` (TRD 12)
Email + password (show/hide toggle), any credentials accepted (demo note visible: "Demo: any email and password signs you in" + "Use demo account" quick-fill button for Ava). Uniform error only for format issues. Success: `OEStore.auth.signIn` (name derived from email or Ava), redirect to validated `?next` (default `../account/`). Links: Forgot password, Create account (carry `next`). `aria-live` errors, autocomplete attrs, Enter submits, button spinner.

### 8.12 `create-account/` (TRD 13)
First/last name, email, password with live strength meter (OEValidate.password: bar + hints, weak blocks submit), marketing checkbox unticked, terms line. Success: signIn + redirect `?next` (default `../account/` with welcome banner via sessionStorage flag). Link to sign-in.

### 8.13 `forgot-password/` (TRD 14)
Request form: email → always "If an account exists for that email, we've sent a reset link." + demo link "Open the reset form (demo)" → `?token=demo`. Reset form (`?token=` present): new + confirm password with strength meter; mismatched → inline error; success → signIn + toast "Password updated" → `../account/`. `?token=` anything other than `demo` → "This link has expired" + re-request shortcut. (Demo-labeled shortcuts keep the honest-data rule.)

### 8.14 `account/` — Overview (TRD 15)
Signed-out → redirect `../sign-in/?next=../account/`. `accountShell("overview")`. "Hi {firstName}"; welcome banner on first visit after signup; last 3 orders as compact cards (number, date, chip, total, thumbs → `../orders/?id=`), "Track" prominent on in-flight; quick links w/ live counts (orders, addresses, cards, wishlist); profile card (name, email, Change password → inline modal: current+new+strength → success toast "Password updated. Other sessions signed out."; marketing toggle persisted in auth record); wishlist preview rail (first 4); sign out button (clears auth → home); danger line "To delete your account, contact support" mailto.

### 8.15 `orders/` — History + detail (TRD 16)
Shell tab "orders". **List**: filter tabs All / In progress (processing+shipped+out_for_delivery) / Delivered / Canceled (incl. refunded); order cards (number, date, chip, total, first 3 thumbs +N, View); 10/page pagination; empty → bestsellers link. **Detail** (`?id=`): header (number, date, chip), `orderTimeline`, tracking cards, line list (thumb+name → PDP, qty, mono price, per-line "Buy again" → cart add at current price with "price updated" notice if changed), totals block (payment last4), full shipping+billing address, actions: Reorder all (reports unavailable lines), Cancel (processing only → confirm → canceled), Start return (delivered within 30 days; outside → disabled with reason), review CTA on delivered lines. Unknown id → notFound.

### 8.16 `cards/` — Saved cards (TRD 17)
Shell tab "cards". Card list: network glyph (text badge fine), •••• last4, expiry, Default badge, "Expires soon" (≤60d) / "Expired" flags; actions: set default, remove (confirm dialog; removing default promotes next; removing last → empty state). Add card form: number (Luhn + network detect, stores ONLY network+last4), expiry, name; demo note about test numbers. Empty state: "Save a card at checkout or add one here".

### 8.17 `addresses/` — Address book (TRD 18)
Shell tab "addresses". Address cards: name, formatted address, phone, Default shipping / Default billing badges; actions: edit (modal, prefilled shared AddressForm), remove (confirm; default promotion copy), set default shipping / set default billing (independent); add (modal; max 10 → button disabled with note). Empty state + add CTA. Validation identical to checkout (shared validator).

## 9. Batches & execution

- Batch A (parallel): pdp, search, brands, brand, content, wishlist.
- Batch B (parallel): cart, checkout, confirmation, track. Exit criterion: guest flow PDP→ATC→cart→checkout→confirmation→track token→claim works end to end.
- Batch C (parallel): sign-in, create-account, forgot-password, account, orders, cards, addresses. Exit criterion: signed-in re-run of B lands the order in history.
- Per batch: agent self-verify (own page, 1440+390, zero console errors, all controls exercised) → orchestrator cross-flow pass → adversarial review workflow → fixes → commit.

## 10. Out of scope (all pages)

Backends (Medusa/Algolia/Sanity/Stripe/Razorpay/Redis/Klaviyo), real auth/sessions/emails/webhooks, Turnstile/rate limiting/token hashing, SSR/ISR/SEO mechanics (JSON-LD, canonicals, sitemaps, noindex), analytics events, invoice downloads, share-wishlist, i18n. Real client-side behavior (validation, optimistic UI, undo, drawers, timelines) is IN scope.
