# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal

Replace the Lab 2 Development Requester selector with real authentication
and role-based authorization, so TokTickIT supports three real user roles —
Requester, IT Staff, and Administrator — each enforced server-side. Deliver
an operational IT Staff Ticket Queue and Ticket Detail workflow, and a
minimalist Administrator screen to manage user accounts, while preserving
every Lab 2 Requester capability under the new authenticated identity.

## 2. Stakeholder Request Interpretation

The temporary Requester selector was a testing shortcut; the system now
needs real accounts. Users log in with email and password; anyone given a
temporary initial password must set a real one before using the app.
Requesters keep doing exactly what Lab 2 built, just as themselves instead
of a picked identity. IT Staff need a working queue to find and process
tickets, with ownership, priority, and status control plus a way to talk to
the Requester (public) and each other (private notes). Administrators need
only enough tooling to keep the user base correct — not a full identity
platform.

## 3. Scope

### Included
- Login, logout, current-user retrieval, mandatory first-login password
  change
- Server-side role-based authorization for every protected endpoint
- Migration of Development Requester records into real authenticated Users
- Full regression of Lab 2 Requester Ticket/Attachment functions under
  authenticated identity, plus Public Comments and "problem appears
  resolved" on the Requester Ticket Detail screen
- IT Staff Ticket Queue (search/filter/sort/pagination) and extended Ticket
  Detail (ownership, IT Priority, status transitions, Public Comments,
  Internal Notes)
- Minimalist Administrator User Management screen

### Excluded
- Email invitations, password-reset email, MFA, social login, SSO
- Self-registration
- Actions Taken (deferred to Lab 4)
- SLA calculation, escalation rules, notification services
- Dashboards/KPI analytics beyond simple queue counts
- Multi-tenant organizations, departments, customer administration
- Production deployment / cloud infrastructure changes
- Multiple roles per user
- User deletion, bulk operations, import/export, account-history screens
- Department, profile photo, and other extended profile fields
- Email delivery of passwords/reset links
- Account unlocking, admin-approval workflows, advanced identity management
- Mandatory pagination, multi-column sorting, or multiple simultaneous
  filters on the Administrator user list

## 4. Functional Requirements

- FR-01 A user can log in with email and password and receive an
  authenticated session.
- FR-02 A user can log out, immediately invalidating their session.
- FR-03 A user can retrieve their own current identity and role while
  authenticated.
- FR-04 A user whose account requires a password change cannot reach any
  other authenticated screen or API until a valid new password is saved.
- FR-05 Each authenticated user sees only navigation and actions permitted
  for their role.
- FR-06 A Requester can create, view, search, filter, sort, and page
  through only their own Tickets, using their authenticated identity.
- FR-07 A Requester can add and soft-remove Attachments on their own
  Tickets, per Lab 2 rules, under their authenticated identity.
- FR-08 A Requester can post a Public Comment on their own Ticket.
- FR-09 A Requester can mark their own Ticket as "problem appears
  resolved" without changing its formal Current Status.
- FR-10 IT Staff can retrieve a Ticket Queue covering all Tickets, with
  search, filters, sorting, and pagination.
- FR-11 IT Staff can open any Ticket's detail screen.
- FR-12 IT Staff can claim an unassigned Ticket or reassign an already
  assigned Ticket to themselves or another active IT Staff/Administrator.
- FR-13 IT Staff can set IT Priority on a Ticket.
- FR-14 IT Staff can change a Ticket's Current Status along the permitted
  transition matrix (section 5 below).
- FR-15 IT Staff can post Public Comments and Internal Notes on any Ticket.
- FR-16 Internal Notes are retrievable only by IT Staff and Administrator;
  a Requester's request for Internal Notes is rejected without leaking
  content or existence.
- FR-17 An Administrator can retrieve the user list, with search by name
  or email and an optional role filter.
- FR-18 An Administrator can create a user with name, email, one role,
  activation state, and an initial password.
- FR-19 An Administrator can edit a user's name, email, role, and
  activation state.
- FR-20 An Administrator can set a new initial password for a user,
  forcing a password change at that user's next login.
- FR-21 An Administrator cannot deactivate their own account.
- FR-22 The system never allows zero active Administrators to exist.

## 5. Business Rules

- BR-01 Only an active user with valid credentials may authenticate.
- BR-02 A user marked as requiring a password change cannot enter the
  normal application until a new valid password is saved; this is enforced
  by backend middleware on every protected route except the password-change
  route itself.
- BR-03 The authenticated identity (from the session), not a client-supplied
  requesterId, determines ownership for every Requester operation.
- BR-04 Public Comments are visible to the Requester, IT Staff, and
  Administrator. Internal Notes are visible only to IT Staff and
  Administrator.
- BR-05 A Requester may indicate that the problem appears resolved
  (`requesterConfirmedResolved: true`), but only IT Staff or Administrator
  may set a Ticket's Current Status to Resolved, Closed, Cancelled, or
  Reopened.
- BR-06 Login failure (unknown email, wrong password) returns an identical
  generic message ("Invalid email or password.") to prevent account
  enumeration.
- BR-07 Login against an inactive account returns a distinct, clear message
  ("This account is inactive. Contact an administrator.") without
  revealing any other account detail.
- BR-08 Passwords are hashed with bcrypt (cost factor 12) and are never
  stored, logged, or returned in plaintext at any point.
- BR-09 A session is a random, non-sequential, server-stored token
  delivered via an httpOnly cookie; logout deletes the session row,
  invalidating it immediately and permanently.
- BR-10 Sessions expire 24 hours after last use; an expired session is
  treated identically to no session (401, not a special error).
- BR-11 Password requirements: minimum 8 characters, at least one
  uppercase letter, one lowercase letter, one digit, and one special
  character. The same rule applies to initial passwords set by an
  Administrator and to a user's own password change.
- BR-12 A Ticket's `requesterId` is set once at creation from the
  authenticated session and is immutable thereafter (unchanged from Lab 2
  BR-07).
- BR-13 A new Ticket has no Ticket Owner (`ticketOwnerId` null) and
  Current Status `New`.
- BR-14 Claiming an unassigned Ticket sets `ticketOwnerId` to the claiming
  IT Staff/Administrator's id; if the Ticket's Current Status is still
  `New`, claiming also auto-transitions it to `Open`.
- BR-15 A Ticket may be reassigned from one Ticket Owner to another active
  IT Staff or Administrator user at any time by IT Staff or Administrator;
  a Requester cannot change Ticket ownership.
- BR-16 IT Priority initially copies Requested Priority at Ticket creation
  and may thereafter be changed only by IT Staff or Administrator.
- BR-17 Current Status transitions follow the matrix in section 5.1; any
  transition not listed there is rejected with 400.
- BR-18 Public Comments and Internal Notes are append-only in Lab 3: no
  edit or delete endpoint exists for either.
- BR-19 Public Comment and Internal Note content is required, trimmed, and
  must be 1-2000 characters after trimming; whitespace-only content is
  rejected.
- BR-20 Every Comment/Note records its author (from the authenticated
  session) and server-generated creation timestamp; the client cannot set
  either.
- BR-21 An Administrator cannot assign more than one role to a user (Lab 3
  has no multi-role support).
- BR-22 Creating or editing a user with an email that already exists
  (case-insensitive) is rejected with 409.
- BR-23 An Administrator cannot deactivate their own account (self-service
  self-lockout prevention).
- BR-24 The system rejects any action (deactivation, role change away from
  Administrator) that would leave zero active Administrator accounts.
- BR-25 Deactivating a user does not delete or hide their historical
  Tickets, Comments, Notes, or ownership — deactivation only blocks future
  login and removes them from "active" selection lists (e.g. the IT Staff
  assignment dropdown).
- BR-26 An Administrator setting a new initial password immediately sets
  that user's `mustChangePassword` to true, regardless of its previous
  value.
- BR-27 Migrated Lab 2 Development Requester records become Users with
  role `REQUESTER`, `mustChangePassword: true`, and a documented seed
  initial password; no production or personal credentials are migrated or
  invented.

## 5.1. Status Transition Matrix

| From | Permitted To | Who |
|---|---|---|
| New | Open, In Progress, Cancelled | IT Staff, Administrator |
| New | Open (automatic) | triggered by claiming ownership |
| Open | In Progress, Waiting for Requester, Cancelled | IT Staff, Administrator |
| In Progress | Waiting for Requester, Resolved, Cancelled | IT Staff, Administrator |
| Waiting for Requester | In Progress, Resolved, Cancelled | IT Staff, Administrator |
| Resolved | Closed, Reopened | IT Staff, Administrator |
| Closed | Reopened | IT Staff, Administrator |
| Reopened | In Progress, Waiting for Requester, Cancelled | IT Staff, Administrator |
| Cancelled | (terminal — no further transitions) | — |

A Requester never directly sets Current Status; their only status-adjacent
action is `requesterConfirmedResolved` (FR-09, BR-05), which IT Staff sees
as a hint, not a status change.

## 6. UI Specification Summary

See ui-spec.md for the full specification. Summary: the application shell
replaces the Development Requester display with the authenticated user's
name and role, plus Logout. Navigation shows only role-permitted
destinations. Login and the mandatory Change Password screen follow the
provided mockup (§8.1 of the handout). The IT Staff Ticket Queue reuses the
Lab 2 My Tickets table/card pattern across all Tickets. The IT Staff Ticket
Detail screen extends the Lab 2 Ticket Detail with ownership, IT Priority,
status controls, and two visually distinct panels for Public Comments and
Internal Notes. The Administrator screen is a single list + create/edit
panel, no multi-screen flow.

## 7. Data Changes

The existing `DevelopmentRequester` table is extended in place (not
replaced) to become `User`, preserving all existing `Ticket.requesterId`
foreign keys:

```prisma
enum Role {
  REQUESTER
  IT_STAFF
  ADMINISTRATOR
}

enum TicketStatus {
  NEW
  OPEN
  IN_PROGRESS
  WAITING_FOR_REQUESTER
  RESOLVED
  CLOSED
  REOPENED
  CANCELLED
}

model User {
  id                 Int       @id @default(autoincrement())
  name               String
  email              String    @unique
  passwordHash       String
  role               Role
  isActive           Boolean   @default(true)
  mustChangePassword Boolean   @default(true)
  createdAt          DateTime  @default(now())

  tickets         Ticket[]        @relation("RequesterTickets")
  ownedTickets    Ticket[]        @relation("TicketOwner")
  publicComments  PublicComment[]
  internalNotes   InternalNote[]
  sessions        Session[]
}

model Session {
  id        String   @id
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}

model PublicComment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  content   String
  createdAt DateTime @default(now())

  @@index([ticketId])
}

model InternalNote {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  content   String
  createdAt DateTime @default(now())

  @@index([ticketId])
}
```

`Ticket` gains: `ticketOwnerId Int?` (FK to `User`, nullable),
`currentStatus` re-typed to the new `TicketStatus` enum (migrated from
Lab 2's single-value `NEW` enum), `requesterConfirmedResolved Boolean
@default(false)`. `Ticket.requesterId` now references `User` instead of
`DevelopmentRequester`.

## 8. API Contract

See api-spec.md for the full endpoint-by-endpoint contract.

## 9. Acceptance Criteria

- AC-01 Given an active user with valid credentials, when they log in,
  then the backend establishes an authenticated session and returns their
  permitted identity and role.
- AC-02 Given a user who must change their password, when login succeeds,
  then every other authenticated screen/API remains unavailable until a
  valid new password is saved.
- AC-03 Given an authenticated Requester, when the client supplies a
  different requesterId in a request body, then the backend still applies
  the authenticated identity and ignores the supplied value.
- AC-04 Given a Requester account, when an Internal Notes endpoint is
  requested, then the operation is rejected (403) without exposing note
  content or confirming the Ticket's existence beyond what the Requester
  already has access to.
- AC-05 Given invalid credentials, when a user attempts to log in, then a
  generic "Invalid email or password." message is shown, identical whether
  the email exists or not.
- AC-06 Given an inactive account's correct credentials, when login is
  attempted, then a distinct "account inactive" message is shown and no
  session is created.
- AC-07 Given a logged-in user, when they log out and then attempt to
  access a protected page, then they are redirected to Login and the old
  session is rejected by the backend (not just hidden client-side).
- AC-08 Given an authenticated Requester, when they open My Tickets,
  Create Ticket, or Ticket Detail, then all Lab 2 behavior (ownership
  scoping, search/filter/sort/pagination, attachment lifecycle) continues
  to work identically under their authenticated identity.
- AC-09 Given an owned Ticket, when the Requester posts a Public Comment,
  then it is saved with their identity and creation time, and is visible
  to IT Staff on the same Ticket.
- AC-10 Given an owned Ticket, when the Requester marks it as "problem
  appears resolved", then `requesterConfirmedResolved` becomes true while
  Current Status is unchanged.
- AC-11 Given IT Staff opens the Ticket Queue, then Tickets from all
  Requesters are listed (not scoped to one Requester), with working
  search, filters, sort, and pagination.
- AC-12 Given an unassigned Ticket, when IT Staff claims it, then
  `ticketOwnerId` is set to that IT Staff member and, if still `New`,
  Current Status becomes `Open`.
- AC-13 Given a Ticket assigned to IT Staff member A, when IT Staff member
  B reassigns it to themselves, then `ticketOwnerId` updates to B.
- AC-14 Given a status transition not listed in the permitted matrix, when
  IT Staff attempts it, then the request is rejected with 400 and the
  Ticket's status is unchanged.
- AC-15 Given a Ticket, when IT Staff sets IT Priority, then the new value
  is saved and visible to the Requester as read-only.
- AC-16 Given a Ticket, when IT Staff posts an Internal Note, then it is
  saved and visible only to IT Staff/Administrator, never to the
  Requester's view of the same Ticket.
- AC-17 Given the Administrator User Management screen, when a search term
  is entered, then only matching users (by name or email) are shown.
- AC-18 Given a new user form with an email that already exists
  (case-insensitive), when submitted, then the request is rejected with a
  clear duplicate-email message and no user is created.
- AC-19 Given an Administrator viewing their own account row, when they
  attempt to deactivate it, then the action is blocked with a clear
  message.
- AC-20 Given exactly one active Administrator, when an attempt is made to
  deactivate them or change their role away from Administrator, then the
  action is rejected to preserve at least one active Administrator.
- AC-21 Given an Administrator sets a new initial password for a user,
  then that user's next login requires a password change before reaching
  any other screen.
- AC-22 Given desktop, tablet, and mobile viewports, when Login, Change
  Password, Ticket Queue, IT Staff Ticket Detail, and User Management are
  rendered, then no label is clipped, no message overlaps another element,
  and no horizontal page scrolling occurs.

## 10. Definition of Done

**Product Definition of Done**
- All FR-01-FR-22 and BR-01-BR-27 implemented as specified.
- Every AC above has at least one passing, traceable automated test.
- No required test is skipped, disabled, or commented out on `main`.
- Every Lab 2 Requester test still passes under real authentication
  (regression, not just "new feature works").
- Every protected endpoint is authorized server-side; no authorization
  decision relies solely on a hidden or disabled frontend control.
- API responses conform exactly to api-spec.md; UI conforms to ui-spec.md.
- README setup/test instructions are current for Lab 3 (including seeded
  credentials, clearly marked as local-dev-only).

**Course Delivery Requirements**
- All work on feature branches merged into `lab3-staging` via
  peer-reviewed Pull Requests, then released to `main` via one PR.
- `docs/lab-03/reviewer.md`, `ai-use.md`, and all four contract documents
  complete and committed.
- Required PDF evidence (Answer Part 1-9) submitted.

## 11. Assumptions and Decisions

- Session-based auth (server-stored, httpOnly cookie) was chosen over JWT
  specifically because the handout requires real logout invalidation —
  trivial with a server-stored session, non-trivial with stateless JWT.
- bcrypt (cost 12) was chosen over argon2 to avoid native-module
  compilation issues in the course's Windows/VS Code environment; both are
  acceptable per the handout's "secure approach suitable for this course
  stack."
- The `DevelopmentRequester` table is extended/renamed in place rather
  than replaced, specifically to preserve existing `Ticket.requesterId`
  foreign keys without a data-migration script.
- The status transition matrix (section 5.1) was not fully specified by
  the handout; the version here was designed so every non-terminal status
  has a path forward and Cancelled is the only true dead end, matching
  common support-ticket conventions.
- `requesterConfirmedResolved` is modeled as a separate boolean rather than
  a Current Status value, since BR-05 explicitly forbids a Requester from
  setting formal Resolved/Closed status.
- Password complexity rules (BR-11) were not specified by the handout; a
  conventional minimum (8 chars, upper/lower/digit/special) was chosen and
  is enforced identically for admin-set and self-set passwords.
