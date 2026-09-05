# Lab 2 API Contract

Base path: `/api`. All responses are JSON. All endpoints are scoped to the
Requester supplied via the `x-requester-id` header (sent by the client from
the selected Development Requester context) — this stands in for a session
until Lab 3 introduces real authentication.

## Common error shape

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Summary is required." } }
```

`code` is a stable machine-readable string; `message` is safe to show the
user and never leaks internal details (stack traces, SQL, file paths).

## Common statuses

| Status | Meaning |
|---|---|
| 200 | Successful retrieval |
| 201 | Resource created |
| 400 | Invalid input / validation failure |
| 404 | Resource not found or not owned by the current Requester |
| 409 | Conflict (e.g. duplicate submission detected) |
| 413 | Attachment exceeds the 5 MB size limit |
| 415 | Unsupported attachment file type |
| 500 | Unexpected server error (safe message only) |

---

## 1. GET /api/categories

Reuses the Lab 1 endpoint. Returns only categories (no `isActive` filter
needed — Lab 1 categories are always active).

**200** → `[{ "id": 1, "name": "Hardware" }, ...]`

## 2. GET /api/related-systems

Returns active Related Systems.

**200**
```json
[{ "id": 1, "name": "Corporate Laptop" }, { "id": 2, "name": "VPN" }]
```

## 3. GET /api/requesters

Returns active Development Requesters only.

**200**
```json
[{ "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.com" }]
```
**500** on DB failure — safe message, empty array is NOT substituted (client
must distinguish "zero active requesters" from "failed to load").

## 4. POST /api/tickets

Creates a Ticket for the Requester identified by `x-requester-id`.

**Request body**
```json
{
  "categoryId": 2,
  "relatedSystemId": 5,
  "summary": "Laptop battery drains quickly",
  "description": "Battery drains much faster than usual, started after last update.",
  "requestedPriority": "MEDIUM"
}
```
Attachments are uploaded via separate `POST /api/tickets/:id/attachments`
calls after the Ticket is created (see BR-16 — decoupled from the Ticket
transaction).

**201**
```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 5,
  "summary": "Laptop battery drains quickly",
  "description": "Battery drains much faster than usual, started after last update.",
  "requestedPriority": "MEDIUM",
  "itPriority": null,
  "currentStatus": "NEW",
  "createdAt": "2026-09-05T10:00:00.000Z",
  "updatedAt": "2026-09-05T10:00:00.000Z"
}
```
**400** — missing/invalid `categoryId`, `relatedSystemId`, `summary` (not
5–120 trimmed chars), `description` (not 10–2000 trimmed chars), or
`requestedPriority` (not one of `LOW`/`MEDIUM`/`HIGH`). Body lists every
failing field:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "One or more fields are invalid.",
  "fields": { "summary": "Summary must be 5-120 characters." } } }
```
**400** — `categoryId` or `relatedSystemId` references an unknown or
inactive record (`code: "INVALID_REFERENCE"`).
**404** — `x-requester-id` does not match an active Requester.

## 5. GET /api/tickets

Paginated, ownership-scoped list for the current Requester.

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | Case-insensitive match against `ticketNumber` and `summary` |
| `categoryId` | int | — | Filter |
| `requestedPriority` | `LOW`\|`MEDIUM`\|`HIGH` | — | Filter |
| `status` | `NEW` | — | Filter |
| `sortBy` | `createdAt`\|`updatedAt`\|`ticketNumber` | `createdAt` | |
| `sortOrder` | `asc`\|`desc` | `desc` | |
| `page` | int | `1` | 1-indexed |
| `pageSize` | int | `10` | Clamped to 1–50 |

Unknown `sortBy`/`sortOrder`/`status` values are ignored (fall back to
default) rather than rejected with 400, to keep the list resilient to
stale client links.

**200**
```json
{
  "data": [
    { "id": 42, "ticketNumber": "TKT-2026-000042", "summary": "Laptop battery drains quickly",
      "categoryId": 2, "requestedPriority": "MEDIUM", "itPriority": null,
      "currentStatus": "NEW", "createdAt": "2026-09-05T10:00:00.000Z",
      "updatedAt": "2026-09-05T10:00:00.000Z" }
  ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 1, "totalPages": 1 }
}
```

## 6. GET /api/tickets/:id

Returns one Ticket owned by the current Requester, including its
attachment list.

**200** — full Ticket object (as in POST response) plus:
```json
{
  "attachments": [
    { "id": 7, "originalFileName": "screenshot.png", "mimeType": "image/png",
      "sizeBytes": 204800, "uploadedAt": "2026-09-05T10:01:00.000Z", "removedAt": null }
  ]
}
```
Removed attachments are included with `removedAt` set and no download URL.

**404** — Ticket does not exist, or exists but `requesterId` does not match
the current Requester (BR-24: identical response either way).

## 7. POST /api/tickets/:id/attachments

Uploads one file (`multipart/form-data`, field name `file`) to an owned
Ticket.

**201**
```json
{ "id": 8, "originalFileName": "receipt.pdf", "mimeType": "application/pdf",
  "sizeBytes": 102400, "uploadedAt": "2026-09-05T10:05:00.000Z", "removedAt": null }
```
**404** — Ticket not owned by current Requester.
**409** — Ticket already has 5 active attachments (`code: "ATTACHMENT_LIMIT_REACHED"`).
**413** — file exceeds 5 MB.
**415** — file type not in JPG/JPEG/PNG/WEBP/PDF, checked by both extension
and declared MIME type.

## 8. GET /api/attachments/:id

Returns metadata only (no file bytes).

**200**
```json
{ "id": 7, "ticketId": 42, "originalFileName": "screenshot.png", "mimeType": "image/png",
  "sizeBytes": 204800, "uploadedAt": "...", "removedAt": null, "removedReason": null }
```
**404** — attachment does not exist, or its parent Ticket is not owned by
the current Requester.

## 9. GET /api/attachments/:id/download

Streams the file bytes for an **active** attachment only.

**200** — binary response, `Content-Disposition: attachment`.
**404** — attachment does not exist, is not owned (via its Ticket) by the
current Requester, **or has been soft-removed**. A removed attachment
returns the same 404 as a non-existent one — it must not be distinguishable
by response shape (prevents leaking that a removed file used to exist with
different content than "never existed").

## 10. DELETE /api/attachments/:id

Soft-removes an attachment owned (via its Ticket) by the current Requester.

**Request body**
```json
{ "reason": "Wrong screenshot, replaced with the correct one." }
```
**200**
```json
{ "id": 7, "removedAt": "2026-09-05T11:00:00.000Z", "removedReason": "Wrong screenshot, replaced with the correct one." }
```
**400** — `reason` missing or not 3–200 characters.
**404** — attachment not found / not owned.
**409** — attachment already removed (`code: "ALREADY_REMOVED"`).
