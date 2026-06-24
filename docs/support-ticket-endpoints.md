# Ticket Endpoints

All ticket endpoints require:

```http
Authorization: Bearer <access-token>
```

## Statuses and categories

Statuses:

```text
open
in_review
waiting_on_customer
resolved
```

Categories:

```text
refund_and_payment
order_issue
delivery
account
general
```

Priorities:

```text
low
normal
high
urgent
```

## Create a ticket

```http
POST /tickets
Content-Type: multipart/form-data
```

Form fields:

```text
subject: Refund confirmation for ORD-24561
category: refund_and_payment
priority: high
message: I have not received my refund confirmation.
orderId: optional order UUID
attachments: optional repeated file field
```

Omit `orderId` for tickets that are not related to an order. When supplied,
the order must belong to the authenticated customer.

Up to five JPEG, PNG, WebP, PDF, DOC, or DOCX attachments are accepted. Each
file may be up to 10 MB.

Example response:

```json
{
  "message": "Support ticket created and assigned successfully.",
  "ticket": {
    "id": "ticket-uuid",
    "ticketNumber": "SUP-1000",
    "customerId": "customer-uuid",
    "assignedToId": "admin-uuid",
    "orderId": "order-uuid",
    "subject": "Refund confirmation for ORD-24561",
    "category": "refund_and_payment",
    "priority": "high",
    "status": "open",
    "assignedAt": "2026-06-24T10:00:00.000Z",
    "lastMessageAt": "2026-06-24T10:00:00.000Z",
    "resolvedAt": null,
    "createdAt": "2026-06-24T10:00:00.000Z",
    "updatedAt": "2026-06-24T10:00:00.000Z",
    "customer": {
      "id": "customer-uuid",
      "email": "customer@example.com",
      "fullName": "Customer Name",
      "role": "user"
    },
    "assignedTo": {
      "id": "admin-uuid",
      "email": "admin@example.com",
      "fullName": "Support Admin",
      "role": "admin"
    },
    "order": {
      "id": "order-uuid",
      "status": "processing",
      "paymentStatus": "paid"
    },
    "messages": [
      {
        "id": "message-uuid",
        "message": "I have not received my refund confirmation.",
        "senderType": "customer",
        "createdAt": "2026-06-24T10:00:00.000Z",
        "sender": {
          "id": "customer-uuid",
          "email": "customer@example.com",
          "fullName": "Customer Name",
          "role": "user"
        },
        "attachments": []
      }
    ],
    "assignmentHistory": [
      {
        "id": "assignment-uuid",
        "method": "auto",
        "reason": "Automatically assigned when the ticket was created",
        "previousAssignee": null,
        "newAssignee": {
          "id": "admin-uuid",
          "email": "admin@example.com",
          "fullName": "Support Admin",
          "role": "admin"
        },
        "assignedBy": null,
        "createdAt": "2026-06-24T10:00:00.000Z"
      }
    ]
  }
}
```

Ticket creation and automatic assignment are atomic. The least-loaded admin or
superadmin is selected. If no eligible staff exists, the API returns `503` and
does not create an unattended ticket.

`priority` is optional and defaults to `normal`.

## Get tickets created by the authenticated user

```http
GET /tickets/created?page=1&limit=20
```

Optional query parameters:

```text
status=open
priority=high
search=SUP-1000
page=1
limit=20
```

`search` checks ticket number, subject, and linked order ID. `page` defaults to
`1`; `limit` defaults to `20` and cannot exceed `100`.

Example response:

```json
{
  "data": [
    {
      "id": "ticket-uuid",
      "ticketNumber": "SUP-1000",
      "subject": "Refund confirmation for ORD-24561",
      "category": "refund_and_payment",
      "priority": "high",
      "status": "open",
      "assignedAt": "2026-06-24T10:00:00.000Z",
      "lastMessageAt": "2026-06-24T10:00:00.000Z",
      "customer": {
        "id": "customer-uuid",
        "email": "customer@example.com",
        "fullName": "Customer Name",
        "role": "user"
      },
      "assignedTo": {
        "id": "admin-uuid",
        "email": "admin@example.com",
        "fullName": "Support Admin",
        "role": "admin"
      },
      "order": null,
      "messages": [
        {
          "id": "message-uuid",
          "message": "I have not received my refund confirmation.",
          "senderType": "customer",
          "createdAt": "2026-06-24T10:00:00.000Z",
          "attachments": []
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

Only tickets created by the authenticated user are returned.

## Get tickets assigned to the authenticated staff member

Admin or superadmin only:

```http
GET /tickets/assigned?page=1&limit=20
```

Optional query parameters:

```text
status=in_review
priority=urgent
search=refund
page=1
limit=20
```

The response uses the same `data` and `pagination` structure as
`GET /tickets/created`. Only tickets whose current `assignedToId` is the
authenticated staff member are returned.

## Get all tickets for administration

Admin or superadmin only:

```http
GET /tickets/admin?page=1&limit=20
```

Optional query parameters:

```text
status=waiting_on_customer
priority=high
search=ORD-24561
assignedToId=admin-uuid
page=1
limit=20
```

The response uses the same paginated structure as `GET /tickets/created`.

## Get creator dashboard totals

```http
GET /tickets/summary
```

Response:

```json
{
  "activeCases": 3,
  "needsYourReply": 1,
  "resolved": 1,
  "total": 4,
  "byStatus": {
    "open": 1,
    "in_review": 1,
    "waiting_on_customer": 1,
    "resolved": 1
  }
}
```

`activeCases` combines `open`, `in_review`, and `waiting_on_customer`.
`needsYourReply` is the `waiting_on_customer` count.

## Get one ticket

```http
GET /tickets/:id
```

There is no payload. The response is:

```json
{
  "ticket": {
    "id": "ticket-uuid",
    "ticketNumber": "SUP-1000",
    "subject": "Refund confirmation for ORD-24561",
    "category": "refund_and_payment",
    "priority": "high",
    "status": "in_review",
    "customer": {},
    "assignedTo": {},
    "order": null,
    "messages": [],
    "assignmentHistory": []
  }
}
```

Creators can access only their tickets. Admins and superadmins can access any
ticket.

## Reply to a ticket

```http
POST /tickets/:id/messages
Content-Type: multipart/form-data
```

Form fields:

```text
message: Here is the requested information.
status: waiting_on_customer
attachments: optional repeated file field
```

`status` is optional and may be sent only by an admin or superadmin:

- `waiting_on_customer`: the customer needs to reply.
- `in_review`: support is continuing work.
- `resolved`: close the ticket.
- Omitted: keep the ticket's current status.

Response:

```json
{
  "message": "Reply added successfully.",
  "reply": {
    "id": "message-uuid",
    "ticketId": "ticket-uuid",
    "senderId": "customer-uuid",
    "senderType": "customer",
    "message": "Here is the requested information.",
    "createdAt": "2026-06-24T11:00:00.000Z",
    "sender": {
      "id": "customer-uuid",
      "email": "customer@example.com",
      "fullName": "Customer Name",
      "role": "user"
    },
    "attachments": []
  },
  "status": "in_review"
}
```

Staff choose the resulting status by sending the optional `status` field.
Customer replies automatically change the ticket to `in_review`; customers
cannot submit a status. There is no separate response-required flag.

## Download an attachment

```http
GET /tickets/attachments/:attachmentId/download
```

There is no payload. The response is the original binary file with download
headers. Only the ticket creator or an admin/superadmin can download it.

## List assignable staff

Admin or superadmin only:

```http
GET /tickets/admin/staff
```

Response:

```json
{
  "data": [
    {
      "id": "admin-uuid",
      "email": "admin@example.com",
      "fullName": "Support Admin",
      "role": "admin",
      "activeTicketCount": 3
    }
  ]
}
```

## Reassign a ticket

Admin or superadmin only:

```http
PATCH /tickets/:id/assignee
Content-Type: application/json
```

Payload:

```json
{
  "assignedToId": "new-admin-uuid",
  "reason": "Transferred to payment support"
}
```

Response:

```json
{
  "message": "Support ticket reassigned successfully.",
  "ticket": {
    "id": "ticket-uuid",
    "ticketNumber": "SUP-1000",
    "assignedToId": "new-admin-uuid",
    "assignedTo": {
      "id": "new-admin-uuid",
      "email": "payments@example.com",
      "fullName": "Payments Admin",
      "role": "admin"
    },
    "assignmentHistory": []
  }
}
```

The new assignee must be an admin or superadmin. A ticket cannot be unassigned.

## Update ticket status

Admin or superadmin only:

```http
PATCH /tickets/:id/status
Content-Type: application/json
```

Payload:

```json
{
  "status": "waiting_on_customer"
}
```

Response:

```json
{
  "message": "Support ticket status updated successfully.",
  "ticket": {
    "id": "ticket-uuid",
    "ticketNumber": "SUP-1000",
    "status": "waiting_on_customer"
  }
}
```

## Database setup

Apply `prisma/add-support-tickets.sql` to the target PostgreSQL database before
deploying the ticket endpoints.
