# Customer Order Endpoints

All endpoints in this document require:

```http
Authorization: Bearer <access-token>
```

The backend obtains the user ID from the JWT. Clients must not supply another
user's ID.

## Order statistics

```http
GET /orders/stats
```

```json
{
  "totalOrders": 10,
  "totalMoneySpent": 250000,
  "totalCompletedOrders": 6,
  "totalPendingOrders": 3,
  "averageRating": 4.5
}
```

`totalMoneySpent` sums payment records whose status is `successful`. Completed
means `delivered`. Pending includes `pending`, `confirmed`, `processing`, and
`out_for_delivery`. Cancelled orders remain in `totalOrders` but are excluded
from completed and pending totals.

## Current orders

```http
GET /orders/current
```

Returns the authenticated user's orders with one of these statuses:
`pending`, `confirmed`, `processing`, or `out_for_delivery`.

## All customer orders

```http
GET /orders/mine?page=1&limit=50
```

Returns orders belonging to the authenticated user, newest first. `page`
defaults to `1`, `limit` defaults to `50`, and the maximum limit is `100`.

```json
{
  "orders": [],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 0,
    "totalPages": 0
  }
}
```

## Customer order details

```http
GET /orders/mine/:orderId
```

Returns one order with its items, products, payment attempts, delivery details,
and feedback. The order must belong to the authenticated user. A missing order
or an order owned by another user returns `404 Order not found`.

## Submit order feedback

```http
POST /orders/:orderId/feedback
Content-Type: application/json
```

```json
{
  "rating": 5,
  "comment": "The order arrived in good condition."
}
```

The rating must be an integer from 1 to 5. A customer can submit feedback only
once, only for their own order, and only after its status becomes `delivered`.
