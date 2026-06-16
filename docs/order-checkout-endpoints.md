# Order Checkout Endpoints

## 1. Request an order OTP

```http
POST /auth/order-otp/request
Content-Type: application/json
```

```json
{
  "email": "customer@example.com",
  "fullName": "Customer Name"
}
```

`fullName` is optional for an email that already belongs to a user. The OTP
expires after 10 minutes.

## 2. Verify the OTP

```http
POST /auth/order-otp/verify
Content-Type: application/json
```

```json
{
  "email": "customer@example.com",
  "otp": "123456"
}
```

The response contains an `orderToken`. It expires after 30 minutes and can be
used to create one order.

## 3. Quote an order

```http
POST /orders/quote
Authorization: Bearer <access-token>
Content-Type: application/json
```

Authenticated customers may submit a natural-language shopping list. The
customer and default delivery address are obtained from the JWT:

```json
{
  "orderText": "1 bottler palm oil, 1/4 basket of garri, two derica of rice"
}
```

When `deliveryAddress` is omitted, `null`, `{}`, or contains only blank values,
the authenticated customer's default address is used. A complete Google Maps
address may be supplied to quote delivery to another location. It is checked
with the same delivery-area resolver used by `POST /addresses`, but it is not
saved during quotation and does not require `recipientName` or `phoneNumber`.
Those contact fields are required when the order is created, at which point
the address is saved inside the order transaction. An explicitly supplied
address outside coverage stops the quote with
`422 ADDRESS_OUTSIDE_DELIVERY_COVERAGE`.

The server normalizes number words, common unit spelling mistakes, `1/2`, and
`1/4`. Each requested unit is checked against the product's active buy prices.
Unsupported units and uncertain products are returned as descriptive
item-level results, including the units currently available for that product.
Other fractions, including `1/3` and `3/4`, are rejected for that item.

The existing structured quote request remains supported:

```json
{
  "items": [
    {
      "buyPriceId": "00000000-0000-0000-0000-000000000000",
      "quantity": 2
    }
  ]
}
```

Clients without a JWT must include `customerEmail`. Item prices, service fees,
and delivery fees are calculated by the server. Configure the service fee
with `ORDER_SERVICE_FEE_PERCENT`.

## 4. Create the order

```http
POST /orders
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "items": [
    {
      "buyPriceId": "00000000-0000-0000-0000-000000000000",
      "quantity": 2
    }
  ],
  "deliveryAddress": {
    "recipientName": "Customer Name",
    "phoneNumber": "+2348012345678",
    "formattedAddress": "12 Admiralty Way, Lekki, Lagos",
    "addressLine1": "12 Admiralty Way",
    "country": "Nigeria",
    "googlePlaceId": "google-place-id",
    "latitude": 6.4474,
    "longitude": 3.4723
  },
  "note": "Please call on arrival."
}
```

For authenticated checkout, the server uses the user from the JWT and ignores
`email` and `orderToken` if they are supplied.

For checkout without a JWT, omit the `Authorization` header and include both
the verified email and the `orderToken` returned by the OTP verification
endpoint:

```json
{
  "email": "customer@example.com",
  "orderToken": "token-returned-by-the-verify-endpoint",
  "items": [
    {
      "buyPriceId": "00000000-0000-0000-0000-000000000000",
      "quantity": 2
    }
  ],
  "deliveryAddress": {
    "recipientName": "Customer Name",
    "phoneNumber": "+2348012345678",
    "formattedAddress": "12 Admiralty Way, Lekki, Lagos",
    "addressLine1": "12 Admiralty Way",
    "country": "Nigeria",
    "googlePlaceId": "google-place-id",
    "latitude": 6.4474,
    "longitude": 3.4723
  }
}
```

The fallback order token is consumed transactionally. Requests without either
a valid JWT or a valid order token receive `401 Unauthorized`.

## Database Setup

After configuring `DATABASE_URL`, apply the new `OrderOtpChallenge` model:

```bash
npm run prisma:push
```
