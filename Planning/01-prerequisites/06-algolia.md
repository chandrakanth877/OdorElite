# Algolia

Search and recommendations. Powers the [search results page](../03-pages/05-search-results.md), autocomplete in the header, PLP filtering, and "similar fragrances" / "frequently bought together" recommendation rails. Index schema and synonym strategy live in [search-and-recommendations](../04-cross-cutting/search-and-recommendations.md).

## What it's for

Fragrance shoppers search by brand, note ("vanilla"), family ("woody"), occasion, and misspell constantly ("channel", "aventis"). Algolia gives typo tolerance, synonyms, faceting, and merchandising rules without building any of it.

## Tier & cost

**Build plan (free)**: 10k searches + 10k recommend requests/mo, 100k records — plenty through launch. Move to **Grow (usage-based)** when traffic outgrows it.

## Setup steps

1. Sign up at algolia.com → create application **odorelite** (region close to users).
2. Create indices:
   - `products` — primary.
   - `products_price_asc`, `products_price_desc` — replicas for PLP sort options.
   - `querysuggestions` — enable Query Suggestions on `products` for autocomplete.
3. Configure `products` index (details in the [search doc](../04-cross-cutting/search-and-recommendations.md)): searchable attributes `name, brand, notes, family, description`; facets `brand, family, notes, gender, concentration, price_range, in_stock`; custom ranking `desc(popularity_score)`.
4. Load the fragrance **synonym set** (chanel/channel, edp/eau de parfum, aventus/aventis, oud/oudh, etc.) from the search doc — via dashboard or API.
5. Wire the **Medusa → Algolia sync**: a Medusa subscriber on `product.created/updated/deleted` pushes records with the admin key (see [integration map](../02-architecture/integration-map.md)). Backfill with a one-off script.
6. Enable **Algolia Recommend** and train "Related Products" + "Frequently Bought Together" models once order events flow (needs ~30 days of events; until then the PDP uses same-family fallback logic).
7. Storefront: `react-instantsearch` for the search page; `autocomplete-js` for the header box.

## Credentials to collect

| Env var | App | Where |
|---|---|---|
| `NEXT_PUBLIC_ALGOLIA_APP_ID` | storefront | Settings → API Keys |
| `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY` | storefront | Search-Only API Key (safe to expose) |
| `ALGOLIA_ADMIN_API_KEY` | Medusa | Admin API Key (server-only, indexing) |

## OdorElite-specific configuration

- Send `click` and `conversion` insights events (via `search-insights`) from PLP/search/PDP — Recommend and personalization are useless without them; events are listed in the [tracking plan](../02-architecture/analytics-tracking-plan.md).
- Merchandising rule: pin in-stock items above out-of-stock for the same query.

## You're done when…

- The `products` index contains all seeded products and a dashboard search for "vanila" (typo) returns vanilla-note fragrances.
- Editing a product in Medusa admin updates its Algolia record within seconds.
