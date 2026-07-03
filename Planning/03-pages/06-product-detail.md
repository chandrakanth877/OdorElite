# TRD 06 — Product Detail Page (PDP)

## 1. Purpose & success metric

The conversion page: everything needed to buy a fragrance sight-unseen (notes, family, longevity, reviews). **KPI: PDP add-to-cart rate (target ≥ 8%); secondary: PDP → purchase conversion.**

## 2. Route & rendering

- Route: `/products/[handle]` (e.g. `/products/creed-aventus-edp`).
- ISR with on-demand revalidation on `product.updated` (tag `product:{handle}`); `generateStaticParams` pre-builds the catalog.
- **Price and stock re-verified client-side on mount** via a lightweight Medusa fetch — ISR pages can be minutes stale, and money data must not be.

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Breadcrumbs | `Breadcrumbs` | Home → {Category} → {Brand} → {Name} |
| Gallery | `ProductGallery` | main image (`t_pdp`) + thumbs, zoom on hover/pinch |
| Buy box | `BuyBox` | brand link, H1 `{Brand} {Name}`, rating summary (anchor to reviews), concentration badge, **variant selector** (size/concentration pills with per-variant price), price, quantity, `AddToCartButton`, wishlist toggle, stock state, shipping/returns reassurance line |
| Note pyramid | `NotePyramid` | top/heart/base from `product_note` ([data model](../02-architecture/data-model.md)); each note links to its note page when those exist (Phase 3) |
| Details | `ProductAccordion` | description, fragrance family, longevity/sillage hints, ingredients/allergen note |
| Reviews | `ReviewSection` | summary histogram, sorted list (Verified purchase badge), pagination; `ReviewForm` for signed-in customers, prompt-to-sign-in otherwise |
| Rails | `ProductRail id=rec_similar` ("You may also like"), `ProductRail id=rec_fbt` ("Pairs well with", hidden until trained) | logic per [search doc](../04-cross-cutting/search-and-recommendations.md) |
| Sticky mobile bar | `StickyAtc` | price + Add to Cart pinned on scroll (mobile) |

## 4. Data requirements

- Medusa: product by handle with variants, prices, inventory (server, tag `product:{handle}`); client re-fetch of variant prices/stock on mount.
- Brand + notes + family via the extended modules (joined server-side).
- Reviews: `GET /store/products/{id}/reviews?status=approved` (custom route), paginated; `POST` review (auth required, rate-limited per [security doc](../04-cross-cutting/security-and-bots.md)).
- Algolia Recommend for both rails (fallback query until trained).
- Restock subscribe: `POST /store/restock-subscriptions` (email + variant).

## 5. Interactions & states

- Variant switch updates price/stock/SKU instantly, no URL change ([SEO doc](../04-cross-cutting/seo-requirements.md): one URL per product).
- Add to cart: optimistic mini-cart drawer open with the added line ([TRD 08](08-cart.md)); button shows a spinner→success tick; failure rolls back with a toast.
- Out of stock (variant): button becomes "Notify me when available" → email capture (pre-filled for signed-in users) → `restock_subscription`.
- Out of stock (product): page stays live (SEO), gallery greyed, notify-me primary.
- Review form: 1–5 stars, title, body (10–2000 chars); submits to `pending` with "awaiting moderation" confirmation; one review per customer per product (form becomes "edit your review").
- Unknown handle → 404 with search box; draft/unpublished product → 404 unless admin preview.

## 6. SEO

The highest-value template. Title `{Brand} {Name} {Concentration} | OdorElite`; JSON-LD `Product` with `offers` (price, availability sync'd to stock state), `aggregateRating`/`review` only when approved reviews exist, plus `BreadcrumbList`; self-canonical; `og:image` via `t_og`; in `sitemap-products.xml` with `lastmod`. Rules: [seo-requirements](../04-cross-cutting/seo-requirements.md).

## 7. Analytics events

`view_item` (on load, with full item payload incl. `item_notes`); `add_to_cart` (`source: pdp`); `add_to_wishlist`; `share`; `subscribe_restock`; `view_item_list`/`select_item` for both rails (`rec_similar`, `rec_fbt`); Algolia Insights `convertedObjectIDs(AfterSearch)` on add-to-cart (attributing to `queryID` when arrival was from search); Klaviyo `Viewed Product` (client). Definitions: [tracking plan](../02-architecture/analytics-tracking-plan.md).

## 8. Acceptance criteria

- [ ] Admin price change reflects on the PDP within 60s (revalidation) and instantly in the client stock/price check.
- [ ] Variant switching updates price/stock without navigation; structured-data `offers` matches the default variant.
- [ ] 3-variant product: each variant independently sellable and its stock respected at add-to-cart.
- [ ] Out-of-stock notify-me writes a `restock_subscription` row; restock triggers the T9 email ([email-flows](../04-cross-cutting/email-flows.md)).
- [ ] Review lifecycle: submit → pending (invisible) → approve in admin → visible with correct aggregates and updated JSON-LD.
- [ ] Rich Results test passes for `Product`.
- [ ] LCP (main image) < 2.5s mobile; gallery images lazy except the first.
