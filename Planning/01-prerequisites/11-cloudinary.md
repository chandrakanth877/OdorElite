# Cloudinary

Product image storage, transformation, and delivery. Editorial images live in Sanity's CDN; everything product-shaped (bottle shots, brand logos, swatches) lives here.

## What it's for

- One master upload per image; all sizes/formats derived on the fly (`f_auto,q_auto` → AVIF/WebP per browser).
- Named transformations so the storefront never hand-builds pixel math.
- Medusa admin uploads route here via the Cloudinary file provider.

## Tier & cost

**Free**: 25 monthly credits (≈25GB bandwidth or 25k transformations) — sufficient until real traffic. Plus plan (~$99/mo) later; revisit at launch metrics.

## Setup steps

1. Sign up at cloudinary.com → note the **cloud name** (pick `odorelite`).
2. Settings → Upload → create **upload preset** `odorelite-products`: mode *authenticated* (uploads only via API, not unsigned), auto-format off (handled at delivery), incoming transformation: limit to 2400×2400, strip EXIF.
3. Folder conventions:
   ```
   products/{product-handle}/main.jpg      # primary PDP shot, 1:1
   products/{product-handle}/alt-{n}.jpg   # gallery
   brands/{brand-slug}/logo.png            # transparent, monochrome-safe
   banners/{campaign}/…                    # home/PLP heroes
   ```
4. Named transformations to create:
   - `t_card` — 600×600, fill, `f_auto,q_auto` (PLP/recommendation cards)
   - `t_pdp` — 1200×1200, pad on white, `f_auto,q_auto`
   - `t_thumb` — 120×120 (cart rows, order history)
   - `t_og` — 1200×630, fill (social share images)
5. Configure Medusa's file service to use Cloudinary (community plugin `medusa-file-cloudinary` or an S3-compatible shim) so admin-uploaded product images land in the `products/` folder.
6. Storefront: use `next/image` with a Cloudinary loader (`res.cloudinary.com/odorelite/...`) instead of Vercel image optimization — cheaper and already transformed.

## Credentials to collect

| Env var | App | Where |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Medusa (+ storefront loader, value is public) | Dashboard |
| `CLOUDINARY_API_KEY` | Medusa | Dashboard |
| `CLOUDINARY_API_SECRET` | Medusa | Dashboard |

## You're done when…

- Uploading a product image in Medusa admin lands it under `products/{handle}/` in the Media Library.
- `https://res.cloudinary.com/odorelite/image/upload/t_card/products/<handle>/main.jpg` serves an AVIF/WebP at 600×600.
