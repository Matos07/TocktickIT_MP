# Lab 3 Zen Green UI Specification

This extends — not replaces — the Lab 2 Zen Green specification. All
color tokens, typography, field states, button hierarchy, and responsive
breakpoints from Lab 2's ui-spec.md remain in force unchanged.

## 1. Application Shell Changes

- The Development Requester display and "Change Requester" button are
  removed entirely.
- Replaced by: authenticated user's name + role badge, and a "Logout"
  button, in the same top-right shell position.
- Navigation shows only role-permitted links:
  - Requester: My Tickets, Create Ticket
  - IT Staff: Ticket Queue (renamed from "My Tickets" position)
  - Administrator: Users (plus, if also acting on tickets — out of scope
    per spec §4.3, Administrator does not get Ticket Queue access unless
    the approved matrix changes this)
- A direct URL visit to a role-unpermitted route renders a "Forbidden"
  state (403), not a silent redirect that could be mistaken for a bug.

## 2. Login Screen

Per the handout mockup (§8.1): TikTockIT/TokTickIT title, email field,
password field (with show/hide toggle), Sign In button (busy state while
submitting), generic invalid-credentials message in the error banner
style (section "Error" token from Lab 2), "Forgot your password?" link
rendered but disabled/inert (password reset is out of scope — do not wire
it to a real flow, but keep the mockup element for visual fidelity).

States: initial, validation (empty fields), submitting (busy button),
error (generic invalid-credentials OR inactive-account message, both in
the same banner position), success (redirect to Change Password or main
app, depending on `mustChangePassword`).

## 3. Mandatory Change Password Screen

Per the handout mockup: current (temporary) password field, new password
field, confirm new password field, live-updating checklist of the four
BR-11 rules (min 8 chars, uppercase, lowercase, digit+special — each with
a checkmark that turns green as satisfied), Continue button (disabled
until all rules pass and confirm matches). This screen is unreachable from
navigation — it appears automatically when `mustChangePassword: true` and
cannot be dismissed or skipped.

## 4. IT Staff Ticket Queue

Reuses the Lab 2 My Tickets list pattern exactly (search box, filter
row, sortable columns, pagination, responsive table/card switch via the
same `useIsMobile` approach), with these differences:
- Not scoped to one Requester — shows Tickets from everyone.
- Additional columns: **Ticket Owner** (name, or "Unassigned" in muted
  italic text) and **IT Priority** badge alongside Requested Priority.
- Additional filter: Owner (dropdown of active IT Staff/Administrator +
  "Unassigned").
- A Ticket row with no owner shows a one-click "Claim" action inline (in
  addition to opening the full Detail screen).

## 5. IT Staff Ticket Detail

Extends the Lab 2 Ticket Detail layout:
- Ticket Owner becomes an editable dropdown (claim/reassign) instead of
  blank.
- IT Priority becomes an editable dropdown (was read-only/absent in
  Lab 2).
- Current Status becomes an editable dropdown, options restricted at
  render time to exactly the permitted transitions from the current value
  (per specification.md §5.1) — an impossible transition is never even
  offered as a choice, not just rejected after the fact.
- Two new panels below Attachments, in this fixed order: **Public
  Comments** (pale-green card header, same visual family as a success
  state) then **Internal Notes** (distinct — amber-tinted card header,
  the Warning token family, with a small "Internal — not visible to
  Requester" label) so the two are never visually confusable. Internal
  Notes panel does not render at all for a Requester viewing their own
  Ticket Detail (Lab 2 screen keeps Public Comments only, see section 6).

## 6. Requester Ticket Detail (Lab 2 screen, extended)

- Adds the same Public Comments panel as the IT Staff view (pale-green
  header), positioned below Attachments.
- Adds a "Mark problem as resolved" button, visible only while
  `requesterConfirmedResolved` is false; once set, replaced by a small
  pale-green confirmation line ("You indicated this problem appears
  resolved on {date}.").
- No Internal Notes panel, no Ticket Owner/IT Priority/Status controls —
  all remain exactly as read-only as in Lab 2.

## 7. Administrator User Management

Single screen, per the handout mockup: left side a user table (Name,
Email, Role badge, Status badge, Edit icon-button), search box and
optional role-filter dropdown above it; right side a slide-in panel
(Create or Edit mode) with Full Name, Email, Role dropdown, Active
toggle, and — create mode only — Initial Password field; edit mode
instead shows a "Set New Password" action that opens a small confirm
step. Save/Cancel at the panel bottom; a destructive "Deactivate User"
button appears in edit mode only, disabled with a tooltip explaining why
when the target is the caller's own account or the last active
Administrator (BR-23/BR-24 surfaced as an explained-disabled state, not
just a silent failure).

States: initial list load, search/filter applied, empty (no users —
unreachable in practice but handled), no-results (search/filter with zero
matches), validation (create/edit panel), saving (busy Save button),
success (toast or inline confirmation), duplicate-email conflict (field-
level message on Email), forbidden (non-Administrator direct access
attempt).

## 8. Badge Additions

| Badge | Values | Style family |
|---|---|---|
| Role | Requester / IT Staff / Administrator | Neutral gray-green outline, text always shown |
| Ticket Status | New / Open / In Progress / Waiting for Requester / Resolved / Closed / Reopened / Cancelled | Pale green (active-ish: New/Open/In Progress/Reopened), amber (Waiting for Requester), secondary-green solid (Resolved/Closed), muted gray (Cancelled) |

## 9. Responsive & Accessibility

Identical rules to Lab 2 (breakpoints, focus rings, label association,
non-color status indication). The Status dropdown on IT Staff Ticket
Detail must remain keyboard-operable with visible focus, since it is a
primary workflow control.
