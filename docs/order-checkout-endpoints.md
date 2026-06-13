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
  "deliveryZoneId": "00000000-0000-0000-0000-000000000000"
}
```

`deliveryZoneId` is optional. Item prices, service fees, and delivery fees are
calculated by the server. Configure the service fee with
`ORDER_SERVICE_FEE_PERCENT`.

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
