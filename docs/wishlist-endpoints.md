# Wishlist Endpoints

All wishlist endpoints require:

```http
Authorization: Bearer <access-token>
```

## Create a wishlist

```http
POST /wishlists
Content-Type: application/json
```

```json
{
  "name": "Monthly Groceries",
  "items": [
    {
      "productId": "c85846ad-4920-47ce-b6ca-19da73a0c663",
      "quantity": 1,
      "unit": "bag"
    }
  ]
}
```

## List and view

```http
GET /wishlists
GET /wishlists/:id
```

## Manage items

```http
POST /wishlists/:id/items
PATCH /wishlists/:id/items/:itemId
DELETE /wishlists/:id/items/:itemId
```

Add-item payload:

```json
{
  "productId": "product-uuid",
  "quantity": 0.5,
  "unit": "basket"
}
```

## Quote a wishlist

```http
POST /wishlists/:id/quote
Content-Type: application/json
```

```json
{
  "couponCode": "WELCOME10",
  "deliveryAddress": {
    "formattedAddress": "12 Herbert Macaulay Way, Yaba, Lagos, Nigeria",
    "addressLine1": "12 Herbert Macaulay Way",
    "locality": "Yaba",
    "state": "Lagos",
    "country": "Nigeria",
    "googlePlaceId": "google-place-id",
    "latitude": 6.5158,
    "longitude": 3.389
  }
}
```

Omit `deliveryAddress` to use the authenticated user's default address.
Wishlist prices are always resolved from current active buy prices.

## Convert to an order

```http
POST /wishlists/:id/convert
Content-Type: application/json
```

```json
{
  "deliveryAddress": {
    "recipientName": "Vincent Doe",
    "phoneNumber": "+2348012345678",
    "formattedAddress": "12 Herbert Macaulay Way, Yaba, Lagos, Nigeria",
    "addressLine1": "12 Herbert Macaulay Way",
    "locality": "Yaba",
    "state": "Lagos",
    "country": "Nigeria",
    "googlePlaceId": "google-place-id",
    "latitude": 6.5158,
    "longitude": 3.389
  },
  "note": "Please call before delivery."
}
```

Conversion uses the existing order flow and returns the created order plus
Paystack payment details. A converted wishlist cannot be edited or deleted.

## Database setup

Apply:

```text
prisma/add-wishlists.sql
```
