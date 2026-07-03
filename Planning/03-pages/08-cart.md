# TRD 08 — Cart

## 1. Purpose & success metric

Review-and-edit staging area between browsing and checkout, in two forms: the **mini-cart drawer** (post-add feedback, stay in flow) and the **full cart page**. **KPI: cart → checkout progression rate (target ≥ 55%); guardrail: cart abandonment rate.**

## 2. Route & rendering

- Route: `/cart` (full page) + `MiniCartDrawer` mounted globally in the header.
- Fully dynamic — never cached. Server component reads the cart; mutations via server actions.

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Line items | `CartLineItem[]` | thumb (`t_thumb`), brand+name, variant (size/concentration), unit price, qty stepper, line total, remove, "move to wishlist" |
| Summary | `CartSummary` | subtotal, shipping estimate ("calculated at checkout" pre-address), discount code input, total |
| Discount | `DiscountForm` | applies Medusa promotion; invalid → inline error; applied → removable chip |
| CTA | `CheckoutButton` | primary → `/checkout`; shows Apple/Google Pay express button when available (Stripe) |
| Cross-sell | `ProductRail id=rec_cart` | FBT/fallback per [search doc](../04-cross-cutting/search-and-recommendations.md) |
| Empty state | `CartEmpty` | "Your cart is empty" + bestsellers rail + sign-in prompt ("signed in previously? your cart may be on your account") |
| Mini-cart | `MiniCartDrawer` | last-added confirmation, compact lines, subtotal, checkout + view-cart buttons |

## 4. Data requirements

- **Cart identity** (guest): `_oe_session` httpOnly cookie → Upstash `cart:{sessionId}` → Medusa cart id (30d TTL, refreshed on activity). Signed-in: cart attached to the customer; on sign-in, guest cart **merges** into the customer cart (quantities summed, capped by stock).
- Medusa Store API: retrieve cart, line-item add/update/delete, promotions — all via server actions.
- Prices/totals always from Medusa's response — the client never computes money.
- Cross-sell rail: Algolia Recommend on cart item ids.

## 5. Interactions & states

- Qty stepper: optimistic update, debounced server action, rollback + toast on failure; qty capped at available stock (stepper disables with "only N left").
- Remove: instant with 5s undo toast.
- Item went out of stock since adding: line flagged "no longer available", excluded from totals, checkout blocked until removed.
- Price changed since adding: Medusa reprices automatically; show a subtle "price updated" note comparing against the client's last-seen price.
- Discount errors: expired/invalid/min-not-met each get specific copy.
- Mini-cart opens on every add, closes on outside click/Esc; cart badge count syncs everywhere via a client cart store fed by server-action responses.
- Guest → sign-in mid-cart: merge per §4 then return to `/cart`.

## 6. SEO

`noindex, nofollow`; excluded in robots.txt. No structured data.

## 7. Analytics events

`view_cart` (page or drawer open, with items + value); `add_to_cart` fires at the *action* source, not here; `remove_from_cart`; `begin_checkout` fires on checkout entry ([TRD 09](09-checkout.md)); `select_item` on cross-sell (`item_list_id: rec_cart`); PostHog `discount_applied` (code, success).

## 8. Acceptance criteria

- [ ] Guest cart survives browser restart (cookie + Redis) for 30 days.
- [ ] Sign-in with items in both guest and account carts merges without loss or duplication (verify quantities).
- [ ] Stock cap enforced: can't step qty above availability; concurrent stock-out flags the line and blocks checkout.
- [ ] Totals always match Medusa's server calculation (spot-check with promotion applied).
- [ ] Redis outage: cart still functions via fallback cookie-held cart id ([system-architecture](../02-architecture/system-architecture.md) failure policy).
- [ ] Undo restores a removed line with the same variant and quantity.
