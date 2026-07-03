# TRD 01 — Home

## 1. Purpose & success metric

Orient new visitors (what OdorElite sells, why trust it) and route everyone to a shopping surface in one click. **KPI: click-through rate from home to PLP/PDP/search (target ≥ 60% of home sessions); secondary: home bounce rate.**

## 2. Route & rendering

- Route: `/`
- ISR, revalidate 1h + on-demand when `homepageEditorial` publishes in Sanity ([integration map](../02-architecture/integration-map.md)).
- Everything above the fold is server-rendered; recommendation rails hydrate client-side.

## 3. Layout & components

| Order | Section | Component | Source |
|---|---|---|---|
| 1 | Announcement bar | `AnnouncementBar` (dismissible) | Sanity `homepageEditorial` |
| 2 | Header (global) | `SiteHeader`: logo, nav (Categories, Brands, Guides), `AutocompleteSearch`, wishlist + cart icons with badges | — |
| 3 | Hero | `HomeHero`: campaign image + CTA | Sanity |
| 4 | Category tiles | `CategoryGrid`: men / women / unisex / niche | static config + Cloudinary banners |
| 5 | Trending rail | `ProductRail id=rec_trending` | Algolia (top `popularity_score`, in stock) |
| 6 | Featured brands | `BrandStrip`: 6–8 logos → brand pages | `brand` table (flagged featured) |
| 7 | "Because you viewed" rail | `ProductRail id=rec_recent` — hidden for first-time visitors | Algolia Recommend, seeded from `localStorage` view history |
| 8 | Editorial/guides | `GuideCards` (2–3) | Sanity |
| 9 | Trust strip | `TrustBar`: authenticity, shipping, returns | static |
| 10 | Newsletter signup | `NewsletterForm` (Turnstile invisible) | Klaviyo via server action |
| 11 | Footer (global) | `SiteFooter`: policies, contact, social | — |

## 4. Data requirements

- Sanity GROQ: `homepageEditorial` (hero, announcement, guide picks) — build-time fetch, tag `content:home`.
- Algolia: trending query (`products`, filter `in_stock:true`, 12 hits); Recommend related-products for rail 7 (client-side).
- Medusa: none directly (product cards come from Algolia records).

## 5. Interactions & states

- Rails: horizontal scroll with snap; skeleton cards while hydrating; a rail with <4 items doesn't render (no half-empty rails).
- First-visit: rail 7 absent; layout must not shift (rails render below the fold sequentially).
- Announcement bar dismissal persists in `localStorage`.
- Add-to-wishlist on rail cards works logged-out (Redis session — [TRD 19](19-wishlist.md)).
- Error states: Algolia failure hides rails silently; Sanity failure serves last ISR render.

## 6. SEO

Per [seo-requirements](../04-cross-cutting/seo-requirements.md): title `OdorElite — Designer & Niche Fragrances`; JSON-LD `Organization` + `WebSite`/`SearchAction`; self-canonical; LCP = hero image (`priority`, Cloudinary `f_auto,q_auto`).

## 7. Analytics events

`page_view`; `view_promotion`/`select_promotion` (hero, category tiles); `view_item_list`/`select_item` for each rail (`item_list_id`: `rec_trending`, `rec_recent`, `home_guides`); `newsletter_signup` (`location: footer`); Algolia Insights `clickedObjectIDs` on rail clicks. Definitions: [tracking plan](../02-architecture/analytics-tracking-plan.md).

## 8. Acceptance criteria

- [ ] Publishing a new hero in Sanity updates `/` within 60s without redeploy.
- [ ] Trending rail shows only in-stock products with correct prices.
- [ ] Second visit after viewing a PDP shows the "Because you viewed" rail.
- [ ] Newsletter signup adds the address to the Klaviyo `Newsletter` list; bot submissions (no Turnstile token) rejected.
- [ ] LCP < 2.5s on 4G mobile emulation; CLS < 0.1.
- [ ] All events in §7 visible in GA4 DebugView from one session.
