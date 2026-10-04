# Lab 3 API Contract

Base path: `/api`. All responses are JSON unless noted. Authentication is a
server-stored session delivered via an httpOnly, sameSite=lax cookie named
`tt_session`. There is no `x-requester-id` header anymore — the
authenticated session is the sole source of identity (BR-03).

## Common error shape

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Email is required." } }
```

## Common statuses

| Status | Meaning |
|---|---|
| 200 | Successful retrieval/update |
| 201 | Resource created |
| 400 | Invalid input / validation failure / disallowed status transition |
| 401 | Not authenticated (no/expired session) |
| 403 | Authenticated but forbidden for this role |
| 404 | Resource not found or not owned/visible to the caller |
| 409 | Conflict (duplicate email, already-removed, etc.) |
| 500 | Unexpected server error (safe message only) |

Every protected route returns 401 if there is no valid session, and 403 if
there is a valid session but the role/ownership check fails — these are
never conflated, so a client can tell "log in" from "you can't do that."

---

## 1. Authentication

### POST /api/auth/login
**Request** `{ "email": "...", "password": "..." }`
**200** `{ "id": 1, "name": "...", "role": "REQUESTER", "mustChangePassword": false }`
(sets `tt_session` cookie)
**400** — missing email/password.
**401** — invalid credentials (BR-06, generic message, identical for
unknown email vs wrong password): `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." } }`
**403** — valid credentials, inactive account (BR-07): `{ "error": { "code": "ACCOUNT_INACTIVE", "message": "This account is inactive. Contact an administrator." } }`

### POST /api/auth/logout
**200** `{ "success": true }` — deletes the session row server-side; the
cookie is cleared. Idempotent: calling with no session still returns 200.

### GET /api/auth/me
**200** `{ "id": 1, "name": "...", "email": "...", "role": "REQUESTER", "mustChangePassword": false }`
**401** — no valid session.

### PATCH /api/auth/password
Requires an authenticated session (even one with `mustChangePassword: true`
— this is the one route reachable in that state).
**Request** `{ "currentPassword": "...", "newPassword": "..." }`
**200** `{ "success": true }` — sets `mustChangePassword: false`.
**400** — `newPassword` fails complexity rules (BR-11), or
`currentPassword` is wrong.
**401** — no valid session.

---

## 2. Requester Ticket/Attachment APIs (Lab 2 carried forward)

All Lab 2 endpoints (`GET /api/categories`, `GET /api/related-systems`,
`POST /api/tickets`, `GET /api/tickets`, `GET /api/tickets/:id`,
`POST /api/tickets/:id/attachments`, `GET /api/attachments/:id`,
`GET /api/attachments/:id/download`, `DELETE /api/attachments/:id`)
continue to exist with identical shapes, except:
- The `x-requester-id` header is removed; the authenticated session
  supplies the Requester identity (BR-03).
- `GET /api/tickets` and `GET /api/tickets/:id` are scoped to
  `requesterId = session.userId`, as before — a Requester still only ever
  sees their own Tickets through these endpoints (IT Staff use the
  separate Queue endpoints in section 4).
- Every route requires an authenticated session with `role: REQUESTER`
  (401 if unauthenticated, 403 if authenticated as IT Staff/Administrator
  — they use the staff endpoints instead).

## 3. Public Comments & "Problem Appears Resolved"

### POST /api/tickets/:id/comments
Available to the Requester (owner), IT Staff, and Administrator.
**Request** `{ "content": "..." }`
**201** `{ "id": 5, "ticketId": 42, "authorId": 1, "authorName": "...", "authorRole": "REQUESTER", "content": "...", "createdAt": "..." }`
**400** — empty/whitespace-only or >2000 chars (BR-19).
**404** — Ticket not found, or Requester does not own it.

### GET /api/tickets/:id/comments
**200** — array of comments, ordered oldest-first. Same visibility rule as
the Ticket itself (Requester must own it; IT Staff/Administrator can view
any).

### PATCH /api/tickets/:id/resolved-by-requester
Requester only, on an owned Ticket.
**Request** `{}` (no body needed, or `{ "confirmed": true }`)
**200** `{ "requesterConfirmedResolved": true }`
**404** — not owned.

## 4. IT Staff Ticket Queue & Operations

### GET /api/staff/tickets
IT Staff/Administrator only (403 for Requester).

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | Matches `ticketNumber` and `summary` |
| `categoryId` | int | — | Filter |
| `requestedPriority` / `itPriority` | LOW\|MEDIUM\|HIGH | — | Filter |
| `status` | TicketStatus | — | Filter |
| `ownerId` | int \| "unassigned" | — | Filter |
| `sortBy` | createdAt\|updatedAt\|ticketNumber | createdAt | |
| `sortOrder` | asc\|desc | desc | |
| `page` | int | 1 | |
| `pageSize` | int | 10 | Clamped 1-50 |

**200** `{ "data": [...], "pagination": { "page": 1, "pageSize": 10, "totalItems": 87, "totalPages": 9 } }`
— each item includes `ticketOwnerName` (or null) alongside the Lab 2 fields.

### GET /api/staff/tickets/:id
**200** — full Ticket including attachments, comments, and internal notes.
**403** — caller is a Requester.
**404** — Ticket id does not exist.

### PATCH /api/staff/tickets/:id/claim
Sets `ticketOwnerId` to the caller; auto-transitions `New` → `Open`
(BR-14).
**200** — updated Ticket.
**409** — already owned by someone else (use reassign instead).

### PATCH /api/staff/tickets/:id/assign
**Request** `{ "ticketOwnerId": 7 }`
**200** — updated Ticket.
**400** — target user is not an active IT Staff/Administrator.

### PATCH /api/staff/tickets/:id/priority
**Request** `{ "itPriority": "HIGH" }`
**200** — updated Ticket.
**400** — invalid priority value.

### PATCH /api/staff/tickets/:id/status
**Request** `{ "status": "IN_PROGRESS" }`
**200** — updated Ticket.
**400** — transition not permitted from the current status (BR-17, section
5.1 of specification.md).

### POST /api/tickets/:id/internal-notes
IT Staff/Administrator only.
**Request** `{ "content": "..." }`
**201** — created note.
**403** — caller is a Requester (content never included in the error).

### GET /api/tickets/:id/internal-notes
**200** — array of notes, oldest-first.
**403** — caller is a Requester.

## 5. Administrator User Management

All endpoints below require `role: ADMINISTRATOR` (403 otherwise).

### GET /api/admin/users
**Query**: `search` (name/email, case-insensitive), `role` (optional
filter).
**200** `[{ "id": 1, "name": "...", "email": "...", "role": "IT_STAFF", "isActive": true }]`

### POST /api/admin/users
**Request** `{ "name": "...", "email": "...", "role": "IT_STAFF", "isActive": true, "initialPassword": "..." }`
**201** — created user (no `passwordHash` in response).
**400** — validation failure (missing field, weak password per BR-11).
**409** — duplicate email (BR-22).

### PATCH /api/admin/users/:id
**Request** (any subset) `{ "name": "...", "email": "...", "role": "...", "isActive": false }`
**200** — updated user.
**400** — attempting to deactivate the caller's own account (BR-23), or
the action would leave zero active Administrators (BR-24).
**409** — duplicate email.

### PATCH /api/admin/users/:id/reset-password
**Request** `{ "newPassword": "..." }`
**200** `{ "success": true }` — sets `mustChangePassword: true` (BR-26).
**400** — password fails complexity rules.
