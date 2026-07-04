# Catalogue Variants and Market Analysis Plan

## Status

Design agreed in principle. Implementation has not started.

This document is the source of truth for continuing the product catalogue,
market-price, and daily market-analysis work.

## Catalogue hierarchy

```text
Category
→ Product
→ Variant
→ Brand
→ Package
→ Product Offering
→ Market Price
```

Definitions:

- **Category:** broad grouping such as Grains or Vegetables.
- **Product:** base commodity such as Rice or Tomatoes.
- **Variant:** type, origin, or class such as Local Rice, Special Rice, North
  Tomatoes, or Yoruba Tomatoes.
- **Brand:** commercial identity such as My Choice, Brnder, or Pasl. Brand is
  optional for unbranded commodities.
- **Manufacturer:** optional owner/producer of one or more brands. Brand and
  manufacturer should remain separate.
- **Package:** selling size or presentation such as 50 kg bag, big basket,
  medium basket, crate, paint, or pan.
- **Product Offering:** the exact sellable item/SKU combining the relevant
  product, variant, brand, and package.
- **Market Price:** an observed price for an exact offering at a market and
  time.

The word **variant** should be used for product types. **Variance** remains a
statistical term.

## Examples

### Tomatoes

```text
Category: Vegetables
└── Product: Tomatoes
    ├── Variant: North
    │   ├── Big basket
    │   ├── Medium basket
    │   ├── Crate
    │   ├── Paint
    │   └── Pan
    └── Variant: Yoruba
        ├── Big basket
        ├── Medium basket
        ├── Crate
        ├── Paint
        └── Pan
```

Prices for different variants and packages must never be silently combined.

### Rice

```text
Category: Grains
└── Product: Rice
    ├── Variant: Local Rice
    ├── Variant: Imported Rice
    └── Variant: Special Rice
        ├── Brand: My Choice
        │   ├── 50 kg bag
        │   └── 25 kg bag
        ├── Brand: Brnder
        │   └── 50 kg bag
        └── Brand: Pasl
            ├── 50 kg bag
            └── 10 kg bag
```

Example exact offering:

```text
Rice → Special Rice → My Choice → 50 kg bag
```

Example market-price identity:

```text
Product Offering + Market + Observation Time
```

## Recommended data model

New models:

```text
ProductVariant
Manufacturer
Brand
ProductPackage
ProductOffering
```

Conceptual fields:

```text
ProductVariant
- id
- productId
- name
- code
- isActive
```

```text
Manufacturer
- id
- name
- isActive
```

```text
Brand
- id
- manufacturerId optional
- name
- isActive
```

```text
ProductPackage
- id
- name
- packageType
- baseUnit
- quantity
- isActive
```

```text
ProductOffering
- id
- productId
- variantId optional
- brandId optional
- packageId
- sku
- isActive
```

`ProductOffering` should become the primary identity of a sellable item.

## Compatibility strategy

The rollout must be additive.

Keep existing fields such as:

```text
productId
unit
quantity
```

Add nullable `productOfferingId` initially to:

```text
MarketPrice
BuyPrice
WishlistItem
PriceAlert
OrderItem
```

Do not immediately remove or rename existing request or response fields.

Existing records may temporarily have no offering. Existing consumers should
continue working while detailed catalogue support is introduced.

## Existing endpoint impact

### Critically affected: market prices

```http
POST   /market-prices
PATCH  /market-prices/:id
GET    /market-prices
GET    /market-prices/product/:productId
GET    /market-prices/market/:marketId
GET    /market-prices/:id
```

Required changes:

- Accept optional `productOfferingId` during transition.
- Add variant, brand, package, and offering filters.
- Return offering details.
- Validate offering/product consistency.
- Change uniqueness from the current product/market/unit/time identity to an
  offering/market/time identity for detailed records.

Current uniqueness:

```text
productId + marketId + unit + observedAt
```

Target uniqueness:

```text
productOfferingId + marketId + observedAt
```

### Critically affected: buy-price calculation

```http
POST /buy-prices
POST /buy-prices/calculate
POST /buy-prices/generate
POST /buy-prices/calculate-bulk
POST /buy-prices/generate-bulk
```

Current strategies group and compare records by `productId + unit`. That can
incorrectly mix variants and package sizes.

Required changes:

- Add offering identity to calculation requests and generated buy prices.
- Group bulk calculations by offering.
- Never calculate cheapest, average, median, preferred market, or landed cost
  across incompatible offerings.

### Affected: product catalogue

```http
GET  /products
GET  /products/:id
GET  /products/category/:category
POST /products
POST /products/bulk-upload
PATCH /products/:id
```

Product creation can remain product-level. Product responses should expose
variants and offerings.

Current responses group active prices only by `unit`. This would hide multiple
offerings sharing the same unit.

Suggested catalogue endpoints:

```http
POST   /products/:productId/variants
GET    /products/:productId/variants
PATCH  /product-variants/:id
DELETE /product-variants/:id

POST   /manufacturers
GET    /manufacturers
PATCH  /manufacturers/:id
DELETE /manufacturers/:id

POST   /brands
GET    /brands
PATCH  /brands/:id
DELETE /brands/:id

POST   /product-packages
GET    /product-packages
PATCH  /product-packages/:id
DELETE /product-packages/:id

POST   /product-offerings
GET    /product-offerings
GET    /product-offerings/:id
PATCH  /product-offerings/:id
DELETE /product-offerings/:id
```

### Affected: wishlists

```http
POST   /wishlists
POST   /wishlists/:id/items
PATCH  /wishlists/:id/items/:itemId
POST   /wishlists/:id/quote
POST   /wishlists/:id/convert
```

Wishlist identity currently uses `productId + unit`. It should move to
`productOfferingId`.

Legacy product/unit input may remain temporarily. If it matches several
offerings, return `needs_confirmation`; never select the first match silently.

### Affected: orders and quotation

```http
POST /orders/quote
POST /orders
```

Order creation already uses `buyPriceId`, which is relatively safe once buy
prices reference exact offerings.

Natural-language quotation currently matches product and unit only. It should
recognize variant, brand, and package, and return choices for ambiguous input.

Example ambiguous request:

```text
Two baskets of tomatoes
```

Expected result:

```text
needs_confirmation
```

Order items should snapshot:

```text
productName
variantName
brandName
packageName
offeringSku
```

This preserves historical readability after catalogue changes.

### Affected: price alerts

```http
POST   /price-alerts
GET    /price-alerts
GET    /price-alerts/:id
PATCH  /price-alerts/:id
DELETE /price-alerts/:id
```

Alerts currently use `productId + unit`. They should eventually reference
`productOfferingId`, and duplicate detection and triggering should use the
exact offering.

### Indirectly affected

These endpoints can retain their routes but should expose offering details:

```http
GET /buy-prices
GET /buy-prices/product/:productId
GET /buy-prices/product/:productId/active
GET /buy-prices/market/:marketId
GET /buy-prices/:id

GET /orders
GET /orders/:id
GET /orders/mine
GET /orders/mine/:orderId
GET /orders/current
GET /orders/export
```

### Unaffected areas

No material changes are expected for:

- Authentication
- Users and access control
- Payments
- Delivery zones and logistics
- Markets
- Addresses
- Coupons and promotions
- General notifications
- Support tickets
- Order feedback

## Handling broad price questions

Question:

```text
What is the price of tomatoes today?
```

The system should return prices grouped by variant and package, rather than
combining incompatible records.

Question:

```text
How much is imported rice?
```

The variant is known, but package is missing. Return available packages or ask
for clarification.

Question:

```text
How much is a 50 kg bag of My Choice Special Rice at Mile 12?
```

This is specific enough to resolve one offering and current market price.

## Daily landing-page market analysis

The landing page must not calculate analysis during page load.

Flow:

```text
Daily scheduled job
→ Read current and historical MarketPrice observations
→ Calculate configured benchmark movements
→ Save completed snapshot
→ Landing-page endpoint reads latest completed snapshot
```

Use `MarketPrice`, not `BuyPrice`, for public market movement. `BuyPrice`
contains margins, logistics, and risk buffers.

For each configured benchmark offering:

1. Select the latest observation for each selected market within the official
   daily collection window.
2. Compare only the same exact offering.
3. Calculate the median across markets.
4. Compare with the previous successful day's median.
5. Save the movement in the daily snapshot.

Do not mix variants, brands, packages, quality grades, quantities, or units.

### Snapshot models

```text
MarketAnalysisSnapshot
- id
- analysisDate unique
- status: processing | completed | failed
- startedAt
- completedAt
- errorMessage
- createdAt
```

```text
MarketAnalysisSnapshotItem
- id
- snapshotId
- productId
- productOfferingId
- productName snapshot
- variantName snapshot
- brandName snapshot
- packageName snapshot
- currentPrice
- previousPrice
- changePercentage
- trend
- currency
- observationCount
- lastPriceAt
```

Public endpoint:

```http
GET /market-analysis/latest
```

It should:

- Return only the latest completed snapshot.
- Never trigger analysis.
- Continue serving the previous snapshot if today's job fails.
- Return a valid empty response if no completed snapshot exists.

### Scheduling

For Cloud Run, use Google Cloud Scheduler:

```text
Cloud Scheduler
→ POST /internal/jobs/market-analysis/daily
→ Protected with internal API token
```

The job must be idempotent and concurrency-safe.

Recommended sequence:

```text
Collect and validate daily market prices
→ Mark import batch completed
→ Generate analysis snapshot
→ Publish through latest endpoint
```

The analysis should ideally depend on a completed daily price-import batch, not
only a clock time.

## Implementation phases

### Phase 1: Catalogue rules

- Confirm terminology and optional relationships.
- Decide manufacturer/brand rules.
- Decide package ownership/reuse rules.
- Define unbranded products.
- Prepare real examples and landing-page benchmarks.

### Phase 2: Additive schema

- Add variant, manufacturer, brand, package, and offering models.
- Add nullable offering references to dependent tables.
- Preserve current fields and records.

### Phase 3: Catalogue management APIs

- Implement CRUD for variants, manufacturers, brands, packages, and offerings.
- Add validation and activation/deactivation rules.

### Phase 4: Product responses

- Expose nested variants and offerings through product endpoints.
- Preserve legacy response fields.
- Stop grouping offerings by unit alone.

### Phase 5: Market-price integration

- Accept and return offering identity.
- Add detailed filters.
- Update uniqueness safely.
- Preserve legacy records during transition.

### Phase 6: Buy-price integration

- Calculate and generate prices for exact offerings.
- Update bulk grouping.
- Prevent cross-offering comparisons.

### Phase 7: Wishlist integration

- Add offering identity.
- Retain legacy input temporarily.
- Return confirmation choices for ambiguous matches.

### Phase 8: Order integration

- Snapshot offering details on order items.
- Update natural-language quotation and ambiguity handling.

### Phase 9: Price-alert integration

- Add offering identity.
- Update duplicate detection and triggering.

### Phase 10: Backfill

- Map records where identity is known.
- Create explicit legacy/default offerings where appropriate.
- Never guess unknown variant or brand data.
- Produce a migration report.

### Phase 11: Deprecate ambiguous writes

- Require offering identity for new detailed market-price and calculation
  writes.
- Maintain legacy reads during the agreed transition.

### Phase 12: Daily market analysis

- Add benchmark configuration.
- Add snapshots and snapshot items.
- Implement idempotent daily job.
- Add `/market-analysis/latest`.
- Configure Cloud Scheduler.

## Recommended next milestone

Complete Phases 1–5 first:

```text
Catalogue decisions
→ Additive schema
→ Catalogue APIs
→ Product responses
→ Exact market-price collection
```

This establishes accurate data collection before changing checkout, alerts,
subscriptions, or daily analysis.
