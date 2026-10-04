# Lab 3 Test Plan and Results

## 1. Test Strategy

Same TDD discipline as Lab 2: the planned test is written first, confirmed
failing for the expected reason, then the smallest correct implementation
follows. Lab 3 adds two coverage levels not present in Lab 2:
**security/authorization** (direct API calls proving a role cannot do what
it shouldn't, independent of any UI) and **migration/regression** (every
Lab 2 Requester test still passes under real authentication). Coverage
spans unit, API/integration, UI component, UI style, responsive,
authorization, regression, and E2E.

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-08 | Password hashing/verification | bcrypt hash verifies correct password, rejects wrong one | server/tests/lab-03/auth.api.test.ts (inline) | Pending |
| UNIT-02 | Unit | BR-11 | Password complexity validator | Rejects short/no-digit/no-special/no-case passwords | server/tests/lab-03/auth.api.test.ts (inline) | Pending |
| UNIT-03 | Unit | BR-17 | Status transition matrix function | Returns allowed set per current status; rejects unlisted pairs | server/tests/lab-03/staff-ticket-detail.api.test.ts (inline) | Pending |
| API-01 | API | AC-01 | POST /api/auth/login valid credentials | 200, session cookie set, correct identity/role returned | server/tests/lab-03/auth.api.test.ts | Pending |
| API-02 | API | AC-05, BR-06 | POST /api/auth/login invalid credentials | 401, identical generic message for unknown email vs wrong password | server/tests/lab-03/auth.api.test.ts | Pending |
| API-03 | API | AC-06, BR-07 | POST /api/auth/login inactive account | 403, distinct inactive-account message | server/tests/lab-03/auth.api.test.ts | Pending |
| API-04 | API | AC-07, BR-09 | POST /api/auth/logout then protected call | Session deleted server-side; subsequent call 401 | server/tests/lab-03/auth.api.test.ts | Pending |
| API-05 | API | AC-02, BR-02 | Protected route with mustChangePassword=true | 403/redirect-equivalent on any route except /api/auth/password | server/tests/lab-03/auth.api.test.ts | Pending |
| API-06 | API | BR-11 | PATCH /api/auth/password weak new password | 400, mustChangePassword remains true | server/tests/lab-03/auth.api.test.ts | Pending |
| AUTH-01 | Security/Authorization | AC-04, BR-04 | Requester calls GET /api/tickets/:id/internal-notes | 403, no note content in response body | server/tests/lab-03/authorization.api.test.ts | Pending |
| AUTH-02 | Security/Authorization | AC-03, BR-03 | Requester POSTs a ticket with a different requesterId in body | Ticket created with session's own id, supplied id ignored | server/tests/lab-03/authorization.api.test.ts | Pending |
| AUTH-03 | Security/Authorization | — | Requester calls GET /api/staff/tickets directly | 403 | server/tests/lab-03/authorization.api.test.ts | Pending |
| AUTH-04 | Security/Authorization | — | IT Staff calls POST /api/admin/users directly | 403 | server/tests/lab-03/authorization.api.test.ts | Pending |
| AUTH-05 | Security/Authorization | — | Unauthenticated client calls any protected endpoint | 401, not 403 or 500 | server/tests/lab-03/authorization.api.test.ts | Pending |
| REGR-01 | Regression | AC-08 | All Lab 2 create-ticket.api.test.ts cases, session-auth instead of x-requester-id | All still pass unmodified in behavior | server/tests/lab-02/create-ticket.api.test.ts (re-run under Lab 3 auth) | Pending |
| REGR-02 | Regression | AC-08 | All Lab 2 my-tickets.api.test.ts, attachments.api.test.ts cases | All still pass | server/tests/lab-02/my-tickets.api.test.ts, attachments.api.test.ts | Pending |
| API-07 | API | AC-09, BR-19 | POST /api/tickets/:id/comments | 201 saved with author+timestamp; empty content 400 | server/tests/lab-03/comments-notes.api.test.ts | Pending |
| API-08 | API | AC-10 | PATCH /api/tickets/:id/resolved-by-requester | requesterConfirmedResolved true, status unchanged | server/tests/lab-03/comments-notes.api.test.ts | Pending |
| API-09 | API | AC-16, BR-04 | POST/GET internal-notes as IT Staff | 201/200; Requester's view of same Ticket never includes notes | server/tests/lab-03/comments-notes.api.test.ts | Pending |
| API-10 | API | AC-11 | GET /api/staff/tickets search/filter/sort/pagination | Covers all Requesters' Tickets, same query contract as Lab 2 | server/tests/lab-03/staff-queue.api.test.ts | Pending |
| API-11 | API | AC-12, BR-14 | PATCH /api/staff/tickets/:id/claim on New Ticket | ticketOwnerId set, status auto New->Open | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pending |
| API-12 | API | AC-13, BR-15 | PATCH /api/staff/tickets/:id/assign | ticketOwnerId updates to target active staff user | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pending |
| API-13 | API | AC-14, BR-17 | PATCH .../status with a disallowed transition | 400, status unchanged | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pending |
| API-14 | API | AC-15, BR-16 | PATCH .../priority | itPriority updated, visible read-only to Requester | server/tests/lab-03/staff-ticket-detail.api.test.ts | Pending |
| API-15 | API | AC-17 | GET /api/admin/users?search= | Only matching name/email rows returned | server/tests/lab-03/users-admin.api.test.ts | Pending |
| API-16 | API | AC-18, BR-22 | POST /api/admin/users duplicate email | 409, no user created | server/tests/lab-03/users-admin.api.test.ts | Pending |
| API-17 | API | AC-19, BR-23 | PATCH /api/admin/users/:id self-deactivation | 400, account remains active | server/tests/lab-03/users-admin.api.test.ts | Pending |
| API-18 | API | AC-20, BR-24 | Deactivate/role-change the last active Administrator | 400, rejected | server/tests/lab-03/users-admin.api.test.ts | Pending |
| API-19 | API | AC-21, BR-26 | PATCH /api/admin/users/:id/reset-password | mustChangePassword true; next login forces change (covered end-to-end in E2E-03) | server/tests/lab-03/users-admin.api.test.ts | Pending |
| UI-01 | UI | AC-01, AC-05 | Login form validation + submit success/failure | Field validation; generic error banner; busy state | client/tests/lab-03/Login.test.tsx | Pending |
| UI-02 | UI | AC-06 | Login with inactive account | Distinct inactive-account message rendered | client/tests/lab-03/Login.test.tsx | Pending |
| UI-03 | UI | AC-02 | ChangePassword live rule checklist | Each rule toggles satisfied/unsatisfied as typed; Continue disabled until all pass | client/tests/lab-03/ChangePassword.test.tsx | Pending |
| UI-04 | UI | AC-11 | StaffTicketQueue renders queue across Requesters | Table/cards show Owner + IT Priority columns | client/tests/lab-03/StaffTicketQueue.test.tsx | Pending |
| UI-05 | UI | AC-12 | StaffTicketQueue Claim action | Clicking Claim calls claim API and updates row | client/tests/lab-03/StaffTicketQueue.test.tsx | Pending |
| UI-06 | UI | AC-14 | StaffTicketDetail status dropdown | Only permitted transitions offered as options for a given current status | client/tests/lab-03/StaffTicketDetail.test.tsx | Pending |
| UI-07 | UI | AC-16 | StaffTicketDetail Internal Notes panel | Visually distinct from Public Comments; posts via internal-notes API | client/tests/lab-03/StaffTicketDetail.test.tsx | Pending |
| UI-08 | UI | AC-17, AC-18 | UserManagement search + duplicate-email handling | Search filters list; duplicate email shows field-level error | client/tests/lab-03/UserManagement.test.tsx | Pending |
| UI-09 | UI | AC-19, AC-20 | UserManagement self/last-admin deactivation guard | Deactivate button disabled with explanatory tooltip in both cases | client/tests/lab-03/UserManagement.test.tsx | Pending |
| STYLE-01 | UI Style | AC-22, ui-spec.md §8 | Role/Status badge rendering | Correct color family + text for every role/status value | client/tests/lab-03/StaffTicketQueue.test.tsx | Pending |
| RESP-01..04 | Responsive | AC-22 | Login, Ticket Queue, Staff Ticket Detail, User Management at 3 viewports | Screenshots, no clipping/overlap/scroll | e2e/lab-03 responsive specs (see §5) | Pending |
| E2E-01 | E2E | AC-01, AC-07 | Login -> use app -> logout -> blocked | Full session lifecycle | e2e/lab-03/authentication.spec.ts | Pending |
| E2E-02 | E2E | AC-02 | Login with initial password -> forced Change Password -> normal app | Normal app unreachable until password changed | e2e/lab-03/authentication.spec.ts | Pending |
| E2E-03 | E2E | AC-12, AC-14, AC-16 | IT Staff claims a Ticket, changes status/priority, posts a Note | Full staff workflow, visible end state | e2e/lab-03/staff-ticket-flow.spec.ts | Pending |
| E2E-04 | E2E | AC-18, AC-19, AC-21 | Administrator creates a user, attempts self-deactivation, resets a password | Full admin workflow with guardrails enforced | e2e/lab-03/user-administration.spec.ts | Pending |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-05, UI-03, E2E-02 |
| AC-03 | AUTH-02 |
| AC-04 | AUTH-01 |
| AC-05 | API-02, UI-01 |
| AC-06 | API-03, UI-02 |
| AC-07 | API-04, E2E-01 |
| AC-08 | REGR-01, REGR-02 |
| AC-09 | API-07 |
| AC-10 | API-08 |
| AC-11 | API-10, UI-04 |
| AC-12 | API-11, UI-05, E2E-03 |
| AC-13 | API-12 |
| AC-14 | API-13, UI-06, E2E-03 |
| AC-15 | API-14 |
| AC-16 | API-09, UI-07, E2E-03 |
| AC-17 | API-15, UI-08 |
| AC-18 | API-16, UI-08, E2E-04 |
| AC-19 | API-17, UI-09, E2E-04 |
| AC-20 | API-18, UI-09 |
| AC-21 | API-19, E2E-04 |
| AC-22 | STYLE-01, RESP-01..04 |

## 4. Responsive and Visual Checklist

Same checklist structure as Lab 2 (ui-spec.md §17 equivalent, to be added
to this Lab 3 ui-spec.md if not already present), executed against
screenshots at `artifacts/lab-03/screenshots/{authentication,staff-queue,
staff-ticket-detail,user-management}/`.

## 5. Test Commands

```bash
# Backend (Supertest/Vitest) — includes Lab 2 regression suite
cd server && npm run test -- tests/lab-02 tests/lab-03

# Frontend (Vitest/RTL)
cd client && npm run test -- tests/lab-02 tests/lab-03

# E2E + responsive (Playwright, from repo root)
npx playwright test
```

Running the Lab 2 suite alongside Lab 3 on every CI/local run is
intentional — it is the regression evidence required by AC-08 and the
handout's "evolve an existing data model and API without breaking the
completed Lab 2 increment" learning outcome.

## 6. Final Results

[Paste terminal output / screenshot of every command above passing on main]

## 7. Known Limitations or Deferred Tests

- No automated test for session expiry at the full 24-hour boundary
  (BR-10) — verified by code inspection and a shortened-expiry manual
  check instead, since waiting 24h in CI is impractical.
- Rate limiting / brute-force login protection is not implemented or
  tested in Lab 3 (not required by the handout; BR-06's generic message
  is the only mitigation in scope).
- Actions Taken, SLA, and notification-related tests are out of scope per
  the handout and are not planned here.
