# OdorElite Store Prototype

A fully clickable 21-page e-commerce prototype in the OdorElite navy/gold
identity. Standalone HTML/CSS/JS, no framework and no build step. Real
products from `enriched-products.json` (5,428 perfumes) and real images from
`downloaded-images/`.

Master spec: `docs/superpowers/specs/2026-07-04-odorelite-prototype-pages-design.md`
(shared contracts in sections 1-7, one section per page in 8.x).

## Run it

From the **repo root** (image paths resolve relative to it):

```bash
python3 -m http.server 8000
# open http://localhost:8000/prototype/home/
```

Every page is reachable from the header, footer, and product cards.

## Pages

| Page | URL | Notes |
|---|---|---|
| Home | `home/` | Marketing home: hero carousel, deal rails, category tiles |
| List (PLP) | `list/` | Working filters/sort over all ~4,900 fragrances, URL pagination |
| Product | `pdp/?id=` | Disk-verified gallery, note pyramid, similar rail |
| Search | `search/?q=` | Weighted matching, synonyms, did-you-mean, URL pagination |
| Brands index | `brands/` | A-Z with letter jump bar |
| Brand | `brand/?name=` | Brand hero + scoped grid, URL pagination |
| Content | `content/?page=` | 4 policies + 3 guides |
| Wishlist | `wishlist/` | Move to cart, remove, empty state |
| Cart | `cart/` | Qty/undo/move-to-wishlist, free-ship meter, `WELCOME10` |
| Checkout | `checkout/` | Accordion steps, validated address + demo card (Luhn) |
| Confirmation | `confirmation/?id=&key=` | Key-gated, processing-to-confirmed flip |
| Track | `track/?token=` or `?id=` | Timeline, live carrier events, returns, demo controls |
| Returns | `returns/?order=` | 4-step return wizard; `&rma=` opens return status |
| Label | `label/?order=` (`&rma=` for returns) | Printable demo label, barcode/QR, watermark |
| Sign in | `sign-in/?next=` | Demo quick-fill; `next` validated against open redirects |
| Create account | `create-account/` | Live password strength |
| Forgot password | `forgot-password/` | `?token=demo` opens the reset form |
| Account | `account/` | Overview, profile, change-password modal |
| Orders | `orders/` and `orders/?id=` | Filter tabs, detail, buy again, cancel/return logic |
| Cards | `cards/` | Masked list, add via Luhn, default + expiring-soon |
| Addresses | `addresses/` | CRUD modal, independent shipping/billing defaults |

## Shared foundation (`shared/`)

| File | Role |
|---|---|
| `chrome.js` | Injects announce bar, header, nav, footer, toast on every page (`OE_PAGE` config; minimal mode for checkout) |
| `store.js` | `OEStore`: cart, wishlist, auth, orders, returns, addresses, cards in versioned localStorage keys (`oe.*.v1`), `oe:state` events, cross-tab sync, first-run seeds |
| `shipping.js` | `OEShip`: simulated shipping partner (labels, deterministic tracking events, returns); loads before store.js on every page |
| `ui.js` | Product card, mini-cart drawer, status chips, order timeline/summary, account shell, `requireAuth`, not-found state |
| `validators.js` | Email, password strength, postal-per-country, phone, Luhn, expiry, address form |
| `shared.css` | Form kit, dialogs, mini-cart, timeline, global `[hidden]` guard |

Design tokens live in `home/styles.css` (`--oe-*`), imported by every page.

## Demo state

All state is local to your browser. Seeds create the demo persona
**Ava Laurent (ava@example.com)** with 5 orders in every status (one with a
completed refunded return), 2 addresses, and 2 cards. Sign-in accepts any email + password (labeled demo affordance).
Discount code `WELCOME10` works; `EXPIRED10` shows the expired branch.

Reset everything from any page's console:

```js
OEStore.reset()
```

## Data generation

Deterministic curation scripts (safe to re-run, fail loudly on missing images):

```bash
python3 prototype/home/curate.py        # home sections -> home/data.js
python3 prototype/list/curate_list.py   # full listing  -> list/listing-data.js
python3 prototype/pdp/curate_pdp.py     # 48 PDP shards -> pdp/details/bucket-*.json
```

## Prototype rules

No backend; payments and emails are simulated and labeled. Star ratings,
review counts, badges, delivery dates, and carrier tracking events are
deterministic demo data (disclosed in the global footer); sample reviews carry
a visible badge. Shipments play out over ~10 accelerated minutes; demo
controls on the track page jump them forward. Card numbers are never stored - network + last4 only. Fonts
load from Google Fonts CDN and fall back to system fonts offline.
