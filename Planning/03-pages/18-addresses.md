# TRD 18 — Addresses

## 1. Purpose & success metric

Address book powering fast checkout: add, edit, remove, set defaults. **KPI: repeat checkouts using a saved address ≥ 70%; guardrail: shipping-failure/undeliverable rate.**

## 2. Route & rendering

- Route: `/account/addresses` — dynamic, auth-required, `AccountLayout`, `noindex`.

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Address grid | `AddressCard[]` | name, formatted address, phone, badges: "Default shipping" / "Default billing" |
| Actions per card | — | edit (opens form modal pre-filled), remove (confirm), set default shipping / billing |
| Add | `AddressFormModal` | same `AddressForm` component as checkout step 2 ([TRD 09](09-checkout.md)): name, line1/line2, city, state/province, postal code, country select, phone; correct `autocomplete` attributes |
| Empty state | — | "No saved addresses" + add CTA |

## 4. Data requirements

- Medusa customer addresses CRUD via server actions; default shipping/billing flags on the customer.
- Validation: required fields + per-country postal-code format (shared validator with checkout — one source of truth); country list limited to shipping zones (region config).
- Checkout "save to account" checkbox writes here; defaults preselect at checkout step 2.

## 5. Interactions & states

- Add/edit in a modal, optimistic list update, rollback on failure.
- Removing the default promotes the most recent remaining address (stated in confirm copy); removing the last address returns to empty state and checkout falls back to blank form.
- Setting default shipping doesn't touch default billing (independent flags).
- An address used on a past order is safe to delete (orders snapshot addresses — deletion never rewrites history).
- Max 10 addresses (UI guard, keeps the picker usable).

## 6. SEO

`noindex, nofollow`; robots-disallowed under `/account`.

## 7. Analytics events

PostHog: `address_added` (`source: account|checkout`), `address_removed`, `address_default_changed`. No GA4/Meta.

## 8. Acceptance criteria

- [ ] Address added here appears preselected (if default) at checkout step 2.
- [ ] "Save to account" at checkout creates the address here without duplicates on repeat orders to the same address (dedupe on normalized fields).
- [ ] Deleting an address used by a past order leaves that order's displayed address unchanged.
- [ ] Postal-code validation matches checkout's exactly (same validator import).
- [ ] Default badges: exactly one default shipping and one default billing at all times when ≥1 address exists.
