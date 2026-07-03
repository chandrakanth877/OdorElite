# TRD 19 — Wishlist

## 1. Purpose & success metric

Low-commitment save-for-later that works **without an account** and survives sign-in. Fragrances are considered purchases — the wishlist is the deferred-intent capture. **KPI: wishlist → cart conversion ≥ 15%; secondary: wishlist adds per session.**

## 2. Route & rendering

- Route: `/wishlist` — dynamic, works signed-out and signed-in (signed-in users also reach it via `AccountLayout` nav), `noindex`.
- Hearts (`WishlistToggle`) appear on every product card and PDP buy box; header icon shows count badge.

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Grid | `WishlistCard[]` | `ProductCard` variant: image, brand/name, current price (live), stock state, add-to-cart (or notify-me when OOS), remove |
| Guest banner | `WishlistSignupNudge` | signed-out with ≥1 item: "Sign in to keep this wishlist on all your devices" |
| Empty state | — | explainer + bestsellers rail |
| Share (Phase 3) | `ShareWishlist` | public read-only tokenized link — out of scope v1, noted for the data model |

## 4. Data requirements

Dual storage, merged on auth ([data model](../02-architecture/data-model.md), [Redis conventions](../01-prerequisites/13-upstash-redis.md)):

- **Guest**: Redis `wishlist:{sessionId}` = set of product ids, 90d TTL, via server actions using the same `_oe_session` cookie as the cart.
- **Customer**: `wishlist_item` table, unique (customer, product).
- **Merge on sign-in/signup**: union of Redis set into the table, then delete the Redis key — same hook point as the cart merge ([TRD 12](12-sign-in.md) §4).
- Page hydrates cards from current Medusa product data by id (live price/stock); deleted/unpublished products silently dropped from display and storage.

## 5. Interactions & states

- Heart toggle: optimistic everywhere (PLP, PDP, rails), single flight per product, rollback on failure; badge count syncs via the client store.
- Add-to-cart from wishlist: adds default variant (multi-variant → PDP), keeps the item on the wishlist (removal is explicit — buying it triggers a subtle "still on your wishlist" affordance post-add).
- OOS item: card stays with notify-me ([TRD 06](06-product-detail.md) restock flow) — wishlists are exactly where restock intent lives.
- Signed-out device B sees a different (session-scoped) wishlist until sign-in merges — the nudge banner explains this.
- Price-drop indicators: Phase 3 (requires price history), out of scope v1.

## 6. SEO

`noindex, nofollow`. Title `Your Wishlist | OdorElite`.

## 7. Analytics events

`add_to_wishlist` (item, `source: plp|pdp|rail`); Meta `AddToWishlist`; `add_to_cart` (`source: wishlist`); `view_item_list` (`item_list_id: wishlist`); PostHog `wishlist_removed`, `wishlist_merged` (guest count, account count). Definitions: [tracking plan](../02-architecture/analytics-tracking-plan.md).

## 8. Acceptance criteria

- [ ] Guest hearts 3 products, closes the browser, returns next day: wishlist intact.
- [ ] Guest with 3 items signs in to an account holding 2 (1 overlapping): merged wishlist has 4, no duplicates, Redis key gone.
- [ ] Hearts reflect wishlist state consistently across PLP, PDP, rails, and the page itself.
- [ ] OOS wishlist item offers notify-me and wires into `restock_subscription`.
- [ ] A product unpublished in admin disappears from the wishlist without an error card.
- [ ] Wishlist page shows live prices (admin price change reflected on next load).
