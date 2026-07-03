# OdorElite Design System — Design Spec

**Date:** 2026-07-02
**Status:** Approved (brainstorming complete)
**Goal:** Build `@odorelite/design-system` — the production component library for the future Next.js storefront — then sync it to claude.ai/design via `/design-sync` so the design agent builds every OdorElite screen from these real components.

## Context

- OdorElite is a perfume e-commerce store, fully specced in `Planning/` (19 page TRDs, architecture, cross-cutting docs). No application code exists yet; tech stack is decided: Next.js App Router + MedusaJS + Tailwind-friendly tooling (see `Planning/00-overview.md`).
- A TRD sweep identified 139 candidate components (60 core / 79 extended). This spec ships a curated 45; page-level sections (checkout steps, account panels, confirmation heroes) are compositions built *from* these parts, not library members.
- Role decision: **future production library**, not a throwaway prototype kit. API rigor, accessibility, and states matter.

## Visual direction (user-selected)

Adapted from the BestBrights design system (`/Users/chandrakanth/Projects/bestbrights/apps/storefront/DESIGN.md`), chosen over an ivory/espresso/champagne alternative after side-by-side page mockups. Mood: calm, trustworthy, premium, slightly luxurious. Light canvas with deep-navy brand moments.

### Colors

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#0A1931` | Deep navy — header, footer, hero, headings |
| `secondary` | `#B3CFE5` | Soft blue — subtext on navy, section tints |
| `accent` | `#4A7FA7` | CTAs, links, interactive states |
| `depth` | `#1A3D63` | Hover states, layered surfaces on navy |
| `surface` | `#F6FAFD` | Main light canvas |
| `gold` / `gold-light` / `gold-dark` | `#C9A96E` / `#E8D5A8` / `#A67C3D` | Star ratings, premium badges, dividers, emphasis |
| `gray-50…900` | per BestBrights table | Neutrals: surfaces, borders, text hierarchy |
| `success` / `warning` / `error` / `info` | `#2E7D5B` / `#C4841D` / `#C0392B` / `#4A7FA7` | Stock states, alerts, toasts |

Delivered as **both** a Tailwind preset and mirrored CSS custom properties (`--oe-*`) in the shipped stylesheet, so non-Tailwind consumers and the Claude Design style closure resolve identical values.

### Typography

- **Geist Sans** — headings, UI, body (400/500/600/700). **Geist Mono** — prices, SKUs, order numbers (400/500). Self-hosted woff2 (MIT), `@font-face` in the shipped CSS; the storefront may later swap to `next/font` without token changes.
- Scale per BestBrights: hero `text-5xl/6xl` bold `-0.02em`; section titles `text-3xl` 600; body `text-base` gray-800; captions `text-sm` gray-600; badges `text-xs` 500 uppercase `0.04em`; prices mono 600.

### Shape, depth, motion

- Radii: cards/images 12px, buttons/inputs 8px, badges full, modals 16px.
- Shadows: `card` / `card-hover` / `modal` (navy-tinted per BestBrights values) + `gold` glow for premium badges.
- Motion: colors 200ms, transforms 300ms, image scale 500ms; ease in/out; no springs; `prefers-reduced-motion` honored.

### Perfume-specific styling (not in BestBrights)

- `ConcentrationBadge` treatment for EDT/EDP/Parfum/EDC/Extrait.
- `NoteChip` tinting for fragrance notes; `NotePyramid` top/heart/base layout.
- Star gold standardized at `#C9A96E`.

## Repo & package structure

Repo becomes a pnpm monorepo (future `apps/storefront`, `apps/medusa` per Planning):

```
OdorElite/
├── Planning/                    (unchanged)
├── docs/superpowers/specs/      (this spec)
├── packages/design-system/
│   ├── src/
│   │   ├── tokens/              Tailwind preset + CSS variables + font-face
│   │   ├── components/<Name>/   Component.tsx + index.ts per component
│   │   ├── fonts/               Geist Sans + Mono woff2
│   │   └── index.ts             public API
│   ├── preview/                 local playground page
│   ├── tailwind.config.ts
│   ├── package.json             name: @odorelite/design-system
│   └── dist/                    ESM JS + .d.ts + styles.css + fonts/
├── pnpm-workspace.yaml
└── package.json
```

- Build: **tsup** (esbuild) → ESM + `.d.ts`; **Tailwind CLI** → `dist/styles.css` (tokens, font-face, all component styles baked in).
- React 18+ peer dependency. TypeScript strict.

## Component set — v1 (45)

### Primitives (12)

| Component | Key variants / states |
|---|---|
| `Button` | primary / secondary / ghost / gold; sm–lg; loading-locked (spinner + "Processing…", used by payment flows); disabled; full-width |
| `IconButton` | ghost / filled; badge-count overlay (cart) |
| `TextField` | label, inline error + `aria-live`, disabled, autocomplete attrs, prefilled read-only |
| `PasswordInput` | show/hide toggle; current/new/confirm autocomplete variants |
| `Select` | native-styled; label + error; (covers sort, country, etc.) |
| `Checkbox` | with label + linked terms line; consent default-unticked |
| `RadioGroup` | card-style options (shipping methods) |
| `Badge` | NEW (gold) / SALE (error) / BESTSELLER (primary) / niche / default / expired / expires-soon |
| `NoteChip` | display / selectable-facet / link modes |
| `RatingStars` | display (with count), input mode, sm/md; hidden-when-zero rule documented |
| `PriceBlock` | single / "from" range / sale (current + line-through original); Geist Mono; OOS greyed |
| `Skeleton` | text / card / image shapes |

### Product (9)

| Component | Key variants / states |
|---|---|
| `ProductCard` | in-stock / out-of-stock (greyed price, notify-me), quick-add vs "from"-price multi-variant, wishlist heart, concentration badge, skeleton |
| `ProductImage` | aspect-locked (4/5 default), rounded, hover-scale option |
| `ProductGallery` | main + thumbnail rail, active thumb state |
| `BuyBox` | brand link, title, rating summary, variant selector, price, qty, ATC, wishlist, stock, reassurance line; OOS "muted" state |
| `VariantSelector` | size × concentration pills; selected / out-of-stock (struck) pills |
| `NotePyramid` | fixed top/heart/base tiers of NoteChips |
| `ConcentrationBadge` | EDT / EDP / Parfum / EDC / Extrait |
| `StockStatus` | in stock / low stock / out of stock |
| `ProductRail` | title + eyebrow + horizontal card row |

### Commerce (9)

`QuantityStepper` (min/max/stock-cap disabled), `WishlistToggle` (idle/active/animating), `MiniCartDrawer` (line items + subtotal + CTA, empty state), `CartLineItem` (image, variant, qty, price, remove; OOS line), `OrderSummary` (subtotal/shipping/tax/discount/total, promo slot), `StatusChip` (pending/paid/shipped/delivered/cancelled/refunded), `OrderTimeline` (steps with current/past/future), `OrderCard` (order list row: number, date, status, thumbnails, total), `AddressBlock` (display card w/ default badges)

### Navigation (6)

`SiteHeader` (navy; logo, nav links w/ gold hover underline, search slot, wishlist/cart/account icons + badges; mobile drawer trigger), `SiteFooter` (navy; link columns, newsletter slot, gold divider, legal bar), `Breadcrumbs` (gold separators), `Pagination`, `FilterPanel` (facet groups: checkboxes, built-in price range min/max inputs; sidebar + mobile-drawer layouts), `FilterChips` (applied filters + clear-all)

### Search & feedback (5)

`SearchInput` (search icon, clear, loading; autocomplete-ready), `Toast` (success/error/info, `aria-live`), `EmptyState` (icon + title + body + CTA; cart/wishlist/search-zero presets), `InlineNotice` (info/warning/error banner), `ConfirmDialog` (modal, 16px radius, destructive variant)

### Merchandising & content (4)

`HomeHero` (navy radial gradient, gold eyebrow, headline, dual CTAs, media slot, trust line), `CategoryTile` (image, darkened overlay, gold flanking lines, count), `TrustBar` (icon + label row), `GuideCard` (editorial image, category, title, excerpt)

### Deliberately folded away

`SortSelect`→`Select` · `AddToCartButton`→`Button` · address/auth/newsletter forms → `TextField`+`Button` compositions · `AnnouncementBar` → styled bar · all 79 extended page-sections → composed by consumers from v1 parts.

## API conventions

- Every component exports `<Name>` + `<Name>Props`; TypeScript strict; no `any` in public API.
- Variants via props, never via consumer-authored CSS. `className` pass-through allowed for layout glue only.
- Controlled-friendly: stateful components take `value`/`onChange`; no data fetching inside components — all data via props (`ProductCard` takes a `product` object type exported from the package).
- Accessibility: WCAG AA contrast (per BestBrights ratios), visible focus rings (`ring-2 ring-accent/50 ring-offset-2`), 44px touch targets, `aria-live` on errors/toasts, semantic roles for dialogs/drawers, text alternatives for stars, `prefers-reduced-motion` respected.

## Testing & verification

- `pnpm typecheck` + `pnpm build` must pass clean.
- Vitest + Testing Library interaction tests for stateful components: `QuantityStepper`, `VariantSelector`, `WishlistToggle`, `MiniCartDrawer`, `ConfirmDialog`, `Toast`, `FilterPanel`, `PasswordInput`.
- Visual fidelity is verified by the design-sync preview grading (absolute rubric, package shape) — no snapshot tests in v1.
- `preview/` playground for local eyeballing during the build.

## Sync to claude.ai/design

- **Shape:** package (no Storybook in v1; stories can be added later without rework).
- Converter bundles the compiled `dist/` (never a reimplementation); previews authored from real usage examples for all 45 components and graded before upload.
- Target: a **new Claude Design project** (first sync → incremental upload path; one upfront approval).
- `.design-sync/config.json` records `projectId`, `pkg`, `shape: "package"`; `.design-sync/conventions.md` (the `readmeHeader`) teaches the design agent: wrap requirements (none beyond stylesheet import expected — fonts/tokens ride `styles.css`), the Tailwind vocabulary (`bg-primary`, `text-gold`, `shadow-card`, `rounded-xl`…), component composition idioms, and where truth lives.
- `.gitignore` gains `.superpowers/`, `node_modules/`, `dist/`.

## Out of scope (v1)

- Storybook, dark mode theme, i18n/RTL, Razorpay-specific payment UI, page-level templates, real Algolia/Stripe integrations (components accept data via props only).

## Sources

- `Planning/` TRDs (component inventory sweep, 2026-07-02)
- BestBrights `DESIGN.md` (visual tokens, component specs, a11y ratios)
- Brainstorm mockups: `.superpowers/brainstorm/45513-1783046753/content/` (theme-compare.html shows the chosen theme rendered on home + PDP)
