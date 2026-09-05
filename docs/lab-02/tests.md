# Lab 2 Test Plan and Results

## 1. Test Strategy

Tests are written before implementation for each Issue (TDD): the planned
test is added first, confirmed failing for the expected reason, then the
smallest correct implementation is written to make it pass. Coverage spans
unit (business logic in isolation), API/integration (Supertest against the
Express app), UI component (Vitest + React Testing Library, API mocked),
UI style/visual (screenshot-based checklist), responsive (Playwright at
three viewports), and E2E (Playwright, full stack, real database).

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-01 | Ticket number generator format | Returns `TKT-{year}-{6-digit}`, zero-padded | `server/tests/lab-02/ticket-number.unit.test.ts` | Pending |
| UNIT-02 | Unit | BR-11 | Summary/Description length validator | Rejects <5 / >120 chars (summary), <10 / >2000 (description) | `server/tests/lab-02/validators.unit.test.ts` | Pending |
| API-01 | API | AC-01 | POST /api/tickets valid, no attachments | 201; Ticket saved; ticketNumber returned | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-02 | API | AC-04 | POST /api/tickets missing summary | 400 with field-level error, no Ticket persisted | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-03 | API | BR-12 | POST /api/tickets with inactive categoryId | 400 INVALID_REFERENCE | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-04 | API | AC-09, BR-08 | GET /api/tickets ownership scoping | Only current Requester's Tickets returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-05 | API | AC-11, AC-12 | GET /api/tickets search + empty vs no-results | Distinct empty payloads for zero-tickets vs zero-matches | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-06 | API | AC-13, BR-10 | GET /api/tickets pagination | page/pageSize honored, clamped at 50, correct totalPages | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-07 | API | AC-14, BR-24 | GET /api/tickets/:id cross-Requester access | 404 when Ticket belongs to another Requester | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |
| API-08 | API | AC-05, AC-06, AC-07 | POST attachment invalid cases | 413 oversize, 415 bad type, 409 over-limit | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-09 | API | AC-16, BR-20 | DELETE /api/attachments/:id soft removal | 200; removedAt/removedReason set; row retained | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-10 | API | AC-17 | GET download of removed attachment | 404, not the file bytes | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-11 | API | BR-21 | Soft-remove an attachment owned via a different Requester's Ticket | 404, no mutation occurs | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| UI-01 | UI | — | TokTickIT heading renders (carried over pattern from Lab 1) | Heading text present | `client/src/tests/lab-02/CreateTicket.test.tsx` | Pending |
| UI-02 | UI | AC-04 | Create Ticket: submit with empty Summary | Field-level message shown; API not called | `client/src/tests/lab-02/CreateTicket.test.tsx` | Pending |
| UI-03 | UI | AC-08, BR-15 | Create Ticket: API failure retains field values | Error banner shown; all entered values still in form | `client/src/tests/lab-02/CreateTicket.test.tsx` | Pending |
| UI-04 | UI | BR-14 | Create Ticket: Submit button busy state | Button disabled + "Submitting…" while request in flight | `client/src/tests/lab-02/CreateTicket.test.tsx` | Pending |
| UI-05 | UI | AC-11, AC-12 | My Tickets: empty vs no-results states | Correct distinct message/CTA rendered for each case | `client/src/tests/lab-02/MyTickets.test.tsx` | Pending |
| UI-06 | UI | AC-10 | My Tickets: reloads after Change Requester | List re-fetches and updates when Requester context changes | `client/src/tests/lab-02/MyTickets.test.tsx` | Pending |
| UI-07 | UI | AC-16 | Ticket Detail: soft-remove attachment flow | Confirmation + reason required; UI reflects removed state | `client/src/tests/lab-02/RequesterTicketDetail.test.tsx` | Pending |
| UI-08 | UI | section 14 (ui-spec.md) | Attachment section: removed attachment has no download control | Download button absent/disabled for removed items | `client/src/tests/lab-02/AttachmentSection.test.tsx` | Pending |
| UI-09 | UI | AC-18, AC-19 | Requester Selection: API failure and empty-list states | Safe error + retry; distinct empty-active-requesters message | `client/src/tests/lab-02/RequesterSelection.test.tsx` | Pending |
| STYLE-01 | UI Style | AC-20, ui-spec §17 | Required CSS classes / badge text / field states present | Assertions on class names and rendered badge text for all priority/status values | `client/src/tests/lab-02/CreateTicket.test.tsx`, `MyTickets.test.tsx` | Pending |
| RESP-01 | Responsive | AC-20 | Create Ticket at desktop/tablet/mobile | Screenshots match ui-spec.md layout rules, no clipping/overlap/scroll | `e2e/lab-02/responsive-create-ticket.spec.ts` | Pending |
| RESP-02 | Responsive | AC-20 | My Tickets at desktop/tablet/mobile (table vs. cards) | Correct layout per breakpoint, no horizontal scroll | `e2e/lab-02/responsive-my-tickets.spec.ts` | Pending |
| RESP-03 | Responsive | AC-20 | Ticket Detail at desktop/tablet/mobile | Correct layout, Attachments panel clearly separated | `e2e/lab-02/responsive-ticket-detail.spec.ts` | Pending |
| E2E-01 | E2E | AC-01, AC-02, AC-09 | Full flow: select Requester → create ticket with attachment → find it in My Tickets → open detail | Ticket Number shown at creation; same ticket appears in list and detail with attachment | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| E2E-02 | E2E | AC-10, AC-14 | Switch Requester mid-session and attempt cross-access | Requester B's list excludes A's tickets; direct URL to A's ticket 404s | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, E2E-01 |
| AC-02 | E2E-01 |
| AC-03 | UI-09 (Requester Selection gate; covered alongside empty/error states) |
| AC-04 | API-02, UI-02 |
| AC-05 | API-08 |
| AC-06 | API-08 |
| AC-07 | API-08 |
| AC-08 | UI-03 |
| AC-09 | API-04, E2E-01 |
| AC-10 | UI-06, E2E-02 |
| AC-11 | API-05, UI-05 |
| AC-12 | API-05, UI-05 |
| AC-13 | API-06 |
| AC-14 | API-07, E2E-02 |
| AC-15 | API-09 (covered as part of attachment lifecycle suite) |
| AC-16 | API-09, UI-07 |
| AC-17 | API-10 |
| AC-18 | UI-09 |
| AC-19 | UI-09 |
| AC-20 | STYLE-01, RESP-01, RESP-02, RESP-03 |

## 4. Responsive and Visual Checklist

See `ui-spec.md` §17 for the full checklist; it is executed and checked off
during Issue 9 alongside RESP-01–RESP-03, using the screenshot paths defined
in `ui-spec.md` §16.

## 5. Test Commands

```bash
# Backend (Supertest/Vitest)
cd server && npm run test -- tests/lab-02

# Frontend (Vitest/RTL)
cd client && npm run test -- src/tests/lab-02

# E2E (Playwright)
npx playwright test e2e/lab-02
```

## 6. Final Results

To be filled in once implementation is complete: paste the terminal output
(or a screenshot) of every command above passing on `main`, per Part 3 of
the submission requirements.

## 7. Known Limitations or Deferred Tests

- IT Priority and Ticket Owner fields are present in the schema but have no
  dedicated tests in Lab 2, since no UI or API path sets them yet (BR-04) —
  they will gain coverage in the lab that introduces IT Staff workflow.
- Load/performance testing of pagination at large ticket counts is out of
  scope for Lab 2.
