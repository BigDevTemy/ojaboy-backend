# GET Endpoints

## Health

```text
GET /health
GET /health-service
```

## Auth

```text
GET /auth/profile
```

## Access Control

```text
GET /access-control/roles
GET /access-control/permission
```

## Markets

```text
GET /markets
GET /markets/:id
```

## Products

```text
GET /products
GET /products?search=tomato
GET /products?category=Vegetables
GET /products/category/:category
GET /products/:id
```

## Users

```text
GET /users
GET /users/email/:email
GET /users/email/:email/orders
GET /users/email/:email/orders/last
```

## Market Prices

```text
GET /market-prices
GET /market-prices?productId=...
GET /market-prices?marketId=...
GET /market-prices?from=2026-06-04&to=2026-06-04
GET /market-prices/product/:productId
GET /market-prices/market/:marketId
GET /market-prices/:id
```

## Buy Prices

```text
GET /buy-prices
GET /buy-prices/product/:productId
GET /buy-prices/product/:productId/active
GET /buy-prices/market/:marketId
GET /buy-prices/:id
```

## Logistics

```text
GET /logistics/delivery-zones
GET /logistics/delivery-zones/:id

GET /logistics/market-delivery-costs
GET /logistics/market-delivery-costs?marketId=...
GET /logistics/market-delivery-costs?deliveryZoneId=...
GET /logistics/market-delivery-costs/:id

GET /logistics/market-route-costs
GET /logistics/market-route-costs?fromMarketId=...
GET /logistics/market-route-costs?toMarketId=...
GET /logistics/market-route-costs/:id
```

## Orders

```text
GET /orders
GET /orders/:id
GET /orders/user/:email/:orderId
```

## Payments

```text
GET /payments
GET /payments/user/:userId
GET /payments/order/:orderId
GET /payments/:id
```
