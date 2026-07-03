# Analytics Tracking Plan

Canonical event dictionary. **GA4 naming is the source of truth**; Meta and Klaviyo names are mappings of the same firing points — one `track()` wrapper in the storefront fans out to all enabled destinations, so an event is defined once here and never ad hoc in components. Page TRDs reference these names in their "Analytics events" sections.

## Conventions

- Item payloads use the GA4 `items[]` shape everywhere: `item_id` (variant SKU), `item_name`, `item_brand`, `item_category` (fragrance family), `item_variant` (size/concentration), `price`, `quantity`, plus custom dims `item_notes` (top 3), `item_gender`.
- `value` + `currency` on every commerce event.
- All client trackers load only after consent ([compliance doc](../04-cross-cutting/payments-and-compliance.md)); `purchase` is additionally sent server-side (CAPI, Klaviyo) which does not depend on the client.

## Event dictionary

| Event (GA4 name) | Fires when / where | Key params | Meta | Klaviyo |
|---|---|---|---|---|
| `page_view` | every route change | page path/type | `PageView` | — |
| `view_item_list` | PLP / search results / rec rail rendered | `item_list_id` (`category_x`, `search`, `rec_similar`, `rec_fbt`), `items[]` (visible) | — | — |
| `select_item` | product card click | `item_list_id`, item | — | — |
| `view_item` | PDP load | item, `value` | `ViewContent` | `Viewed Product` |
| `search` | search submitted / results shown | `search_term`, `results_count` | `Search` | — |
| `add_to_cart` | add from PDP/PLP quick-add/wishlist | item, `value`, source | `AddToCart` | `Added to Cart` |
| `remove_from_cart` | cart line removed | item | — | — |
| `view_cart` | cart page/drawer opened | `items[]`, `value` | — | — |
| `begin_checkout` | checkout page load with cart | `items[]`, `value` | `InitiateCheckout` | `Started Checkout` |
| `add_shipping_info` | shipping step completed | `shipping_tier` | — | — |
| `add_payment_info` | payment method entered | `payment_type` (`card`, `wallet`, `upi`) | `AddPaymentInfo` | — |
| `purchase` | order confirmation page **and** server-side on `order.placed` | `transaction_id` (order id), `items[]`, `value`, `tax`, `shipping`, `coupon` | `Purchase` (client + CAPI, deduped by `event_id` = order id) | `Placed Order` (server) |
| `refund` | server-side on refund | `transaction_id`, `value` | — | — |
| `sign_up` | account created | `method: email` | `CompleteRegistration` | profile created |
| `login` | sign-in success | `method` | — | — |
| `add_to_wishlist` | wishlist add | item | `AddToWishlist` | — |
| `share` | PDP share button | item, method | — | — |
| `newsletter_signup` | footer/popup form success | `location` | `Lead` | list subscribe |
| `view_promotion` / `select_promotion` | home/PLP banner impression/click | `promotion_id` | — | — |
| `subscribe_restock` | out-of-stock PDP email capture | item | — | `Subscribed to Back in Stock` |

## Algolia Insights (separate pipeline, required for Recommend/personalization)

| Insights event | Fires |
|---|---|
| `clickedObjectIDsAfterSearch` | product card click on search results (with `queryID`, position) |
| `clickedObjectIDs` | card click on PLP/rec rails |
| `convertedObjectIDsAfterSearch` / `convertedObjectIDs` | add-to-cart and purchase for items, attributed to the query when one exists |

Pass a stable anonymous `userToken` (session id; customer id after sign-in).

## Dedup & identity rules

- **Meta**: browser pixel and CAPI both send `Purchase` with `event_id = order_id` — Meta dedupes on that pair. Same rule if any other event is ever mirrored server-side.
- **GA4**: `purchase` fires once per order on the confirmation page, guarded by a `sessionStorage` flag keyed on order id (refreshes must not double-count); the server does **not** also send GA4 (avoid double counting — Measurement Protocol only if the client event proves unreliable).
- **Identity**: anonymous id (PostHog/GA4 client ids) linked to customer id on login via `identify` calls; never put email in GA4 params; hash email (SHA-256) for CAPI matching only.

## Ownership of firing points

- Storefront `lib/analytics.ts` exposes `track(event, payload)` → fans out to GA4 (gtag), Meta pixel, Klaviyo client, PostHog. Components never call vendors directly.
- Server events (`purchase` CAPI, Klaviyo `Placed Order`) fire from the Medusa `order.placed` subscriber ([integration map](integration-map.md)).

## Acceptance

- GA4 DebugView shows the full funnel (`view_item` → `add_to_cart` → `begin_checkout` → `purchase`) from one test session with consistent `items[]`.
- Meta test-events tool shows deduplicated client+server `Purchase`.
- A PostHog funnel `view_item → purchase` can be built with no missing steps.
