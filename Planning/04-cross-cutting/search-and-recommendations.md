# Search & Recommendations

Everything Algolia: the record shape, index configuration, synonyms, and which recommendation logic each surface uses. Account setup is in [06-algolia](../01-prerequisites/06-algolia.md); the sync mechanics are in the [integration map](../02-architecture/integration-map.md).

## Index record shape (`products`)

One record per **product** (not per variant — variant prices collapse to a `price_range`):

```json
{
  "objectID": "prod_01H…",
  "handle": "creed-aventus-edp",
  "name": "Aventus",
  "brand": "Creed",
  "brand_slug": "creed",
  "family": "Fruity Chypre",
  "gender": "masculine",
  "concentration": ["EDP"],
  "notes": ["pineapple", "birch", "musk", "bergamot"],
  "notes_by_position": { "top": ["pineapple", "bergamot"], "heart": ["birch"], "base": ["musk"] },
  "description": "…first 500 chars…",
  "image": "https://res.cloudinary.com/odorelite/image/upload/t_card/products/creed-aventus-edp/main.jpg",
  "price_min": 250, "price_max": 435, "currency": "USD",
  "in_stock": true,
  "avg_rating": 4.6, "review_count": 128,
  "popularity_score": 0.92,
  "categories": ["men"],
  "is_niche": true,
  "updated_at": 1719964800
}
```

## Index configuration

- **Searchable attributes** (ordered): `name`, `brand`, `notes`, `family`, `description`.
- **Facets**: `brand`, `family`, `notes`, `gender`, `concentration`, `in_stock`, `is_niche`; numeric: `price_min`, `avg_rating`.
- **Custom ranking**: `desc(popularity_score)`, `desc(review_count)`.
- **Replicas**: `products_price_asc` / `products_price_desc` (sort by `price_min`); primary index sorts by relevance→popularity ("Bestsellers" default).
- **Rules**: pin `in_stock:true` above out-of-stock for equal relevance; optional merchandising pins per campaign.
- **Typo tolerance**: on (default); disable on `notes` values shorter than 4 chars (avoid "oud" matching everything).

## Synonym set (seed list — grow from search analytics)

| Type | Entries |
|---|---|
| Brand misspellings (one-way → correct) | `channel → chanel`, `dolce gabana → dolce & gabbana`, `aventis → aventus`, `armani → giorgio armani` |
| Concentration | `edp = eau de parfum`, `edt = eau de toilette`, `edc = eau de cologne`, `extrait = parfum = pure parfum` |
| Notes | `oud = oudh = agarwood`, `amber = ambre`, `vanilla = vanille`, `rose = damask rose` |
| Vernacular | `cologne = fragrance = perfume = scent`, `long lasting = longevity`, `summer scent = fresh` |

Review Algolia's "searches without results" monthly; every recurring miss becomes a synonym or a catalog gap.

## Query Suggestions (header autocomplete)

`querysuggestions` index generated from search analytics; autocomplete panel shows: 3 query suggestions + top 4 product hits (with `t_thumb` images) + matching brand link. Powered by `autocomplete-js`; submitting goes to `/search?q=…`.

## Recommendations by surface

| Surface | Logic | Source |
|---|---|---|
| PDP "You may also like" | Algolia Recommend **Related Products**; until the model has 30d of events: same `family`, overlapping `notes`, in stock, excluding self — via a filtered Algolia query | Recommend / fallback |
| PDP "Pairs well with" | Recommend **Frequently Bought Together** (needs conversion events); hide the rail until trained | Recommend |
| Cart drawer/page cross-sell | FBT on cart items; fallback: bestsellers in the cart's dominant family | Recommend / fallback |
| Home "Trending" | top `popularity_score`, in stock | Algolia query |
| Home "Because you viewed" | last-viewed product's Related Products (view history in `localStorage`, last 5 handles) | Recommend |
| Order confirmation | FBT on purchased items ("complete your collection") | Recommend |
| Empty search results | bestsellers + spell-corrected suggestion | Algolia |

All rails fire `view_item_list` / `select_item` with a distinguishing `item_list_id` ([tracking plan](../02-architecture/analytics-tracking-plan.md)) and Algolia Insights click/conversion events — Recommend quality depends on them.

## Acceptance

- "vanila", "channel no 5", "oudh" all return sensible results.
- Facet counts on PLP match Algolia dashboard for the same filters.
- Fallback recommendation query returns ≥4 in-stock items for every seeded product.
