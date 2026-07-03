# TRD 15 — Account Overview

## 1. Purpose & success metric

Hub for everything a signed-in customer owns: recent orders, profile, and jump-offs to the account sub-pages. **KPI: task success — customers reach orders/addresses/cards in ≤ 2 clicks from anywhere (nav audit); secondary: repeat-purchase rate of account holders.**

## 2. Route & rendering

- Route: `/account` — dynamic, auth-required (middleware redirects unauthenticated → `/sign-in?redirect=/account`), `noindex`.
- Shared `AccountLayout` (used by TRDs 15–19): sidebar nav (desktop) / tab bar (mobile) with Overview, Orders, Addresses, Saved Cards, Wishlist, Profile, Sign out.

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Greeting | `AccountHeader` | "Hi {first name}" |
| Recent orders | `OrderCardList` | last 3 with status chips → [order history](16-order-history.md); prominent "track" on any in-flight order |
| Quick actions | `AccountQuickLinks` | reorder last order, addresses, cards, wishlist counts |
| Profile card | `ProfileCard` | name, email, password change (inline modal: current + new password, same strength rules; invalidates other sessions), marketing-preferences toggle (syncs Klaviyo consent) |
| Wishlist preview | `ProductRail id=account_wishlist` | first 4 wishlist items |
| Danger zone | `DeleteAccountLink` | starts the support-driven deletion runbook ([compliance](../04-cross-cutting/payments-and-compliance.md)) — mailto/form, not self-serve destructive |

## 4. Data requirements

- Medusa: customer profile, last 3 orders with fulfillment status, address/card/wishlist counts — one server fetch composed into the page.
- Password change + profile edits via server actions; marketing toggle calls Klaviyo consent update server-side.

## 5. Interactions & states

- First visit after signup: welcome banner + "add your first address" nudge.
- Zero orders: recent-orders slot shows "No orders yet" + bestsellers link.
- Password change: current-password verification required; success toast + other-session invalidation notice.
- Reorder: adds the last order's available lines to the cart (out-of-stock lines reported, not silently dropped) → `/cart`.
- Session expiry mid-visit: any failing server action redirects through sign-in and back.

## 6. SEO

`noindex, nofollow`; `/account/*` disallowed in robots.txt.

## 7. Analytics events

`page_view` (`page_type: account`); PostHog `reorder_clicked`, `marketing_prefs_changed` (state), `password_changed`. No commerce events beyond `add_to_cart` (`source: reorder`).

## 8. Acceptance criteria

- [ ] Unauthenticated hit on `/account` round-trips through sign-in back to `/account`.
- [ ] Recent orders match order history and status chips match Medusa fulfillment state.
- [ ] Reorder with one discontinued line adds the rest and names what it couldn't add.
- [ ] Password change requires the current password and kills a parallel session.
- [ ] Marketing toggle off → profile suppressed in Klaviyo within a minute.
- [ ] Layout nav works identically across all account sub-pages (TRDs 16–19).
