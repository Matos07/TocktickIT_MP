# Lab 2 Zen Green UI Specification

## 1. Color Tokens

| Token | Value | Use |
|---|---|---|
| `--zg-primary` | `#006B3C` | App header, primary buttons, strong emphasis |
| `--zg-secondary` | `#0B7A46` | Active tab, focus ring, links, hover |
| `--zg-pale` | `#EAF6EF` | Selected row, success surface, subtle emphasis |
| `--zg-bg` | `#F5F7F6` | Page background |
| `--zg-surface` | `#FFFFFF` | Cards, panels (subtle border, restrained shadow) |
| `--zg-text` | `#1C2B24` | Body text (dark charcoal-green, not pure black) |
| `--zg-field-editable-bg` | `#FFFFFF` | Editable field background, neutral border |
| `--zg-field-readonly-bg` | `#F1F3EE` | Read-only field background (gray-green) |
| `--zg-error` | `#8A1F11` | Error text/border |
| `--zg-warning` | `#B36B00` | Warning callout/badge (amber) |
| `--zg-success` | `#0B7A46` | Success confirmation text |

Priority/status badges never rely on color alone — each badge always shows
its text label (`Low`/`Medium`/`High`, `New`).

## 2. Typography & Spacing

- Base font size 16px, headings use the existing Bootstrap scale (`h3` for
  page titles, matching Lab 1's `TokTickIT` heading style).
- Field labels: 14px, semi-bold, `--zg-text`, 4px margin above the control.
- Section spacing: 24px between form sections; 12px between a field and its
  validation message.
- Card/table row padding: 12px vertical, 16px horizontal.

## 3. Field States

| State | Style |
|---|---|
| Editable | White background, `1px solid #CCD6D0` border, `--zg-text` |
| Read-only | `--zg-field-readonly-bg` background, no border, not focusable |
| Invalid | `1px solid --zg-error` border, error message directly below |
| Disabled | `#E9E9E9` background, `not-allowed` cursor, no hover/focus styles |
| Focused | `2px solid --zg-secondary` outline, always visible for keyboard nav |

## 4. Required-Field Marker & Validation Placement

- Required fields show a red asterisk (`*`) immediately after the label
  text. The asterisk never substitutes for an actual validation message.
- Validation messages render directly under their field, in `--zg-error`
  text, 13px, with a small icon. Never collapse all errors into one banner
  at the top only — field-level messages are mandatory (BR/AC-04).
- A submission-level error (e.g. backend unreachable) appears as a banner
  above the form in addition to any field-level messages already shown.

## 5. Button Hierarchy

| Style | Use | Visual |
|---|---|---|
| Primary | Submit, Continue | Solid `--zg-primary`, white text |
| Secondary | Cancel, Change Requester | Outline `--zg-primary`, transparent bg |
| Tertiary | Clear Filters, inline text actions | Text-only, `--zg-secondary` |
| Destructive | Remove Attachment | Outline `--zg-error`, `--zg-error` text |
| Disabled | Any button mid-validation-failure or not applicable | `#D8D8D8` bg, `#999` text, no pointer events |
| Busy | Submit while request in flight | Primary style + spinner + disabled, label changes to "Submitting…" |

## 6. Attachment Selection & Errors

- Selected files render as a small list (name, size) before submission,
  each removable individually before upload.
- Per-file error (wrong type / too large) shows inline next to that file
  entry, not as a page-level banner, so the Requester can see exactly which
  file failed.
- A running count "`{active}/5 attachments`" is always visible; it turns
  amber (`--zg-warning`) at 5/5 and blocks adding more.

## 7. Screen States

Every screen that calls the API implements: **initial** (before any
action), **loading** (spinner/skeleton + disabled controls), **validation**
(field-level messages, no request sent), **submitting** (busy button,
inputs still visible but locked), **success** (confirmation + next action),
**failure** (safe error message + retry where applicable, form values
retained per BR-15).

## 8. Responsive Layout Rules

| Viewport | Behavior |
|---|---|
| Desktop ≥ 992px | Multi-column layout; content centered, max-width ~960px |
| Tablet 768–991px | Two-column where practical; Summary/Description get full width |
| Mobile < 768px | Single column, fields stack; buttons full-width and touch-sized (≥44px height); no horizontal scroll |

## 9. Accessibility

- Every input has an associated `<label>` (via `htmlFor`/`id`), not
  placeholder-only labeling.
- Icon-only controls (e.g. a trash icon for Remove Attachment) carry
  `aria-label` and a visible tooltip on hover/focus.
- Focus order follows visual order; focus ring (`--zg-secondary`, 2px)
  never suppressed.
- Status/priority badges pair color with text, never color alone.
- Error messages are associated to their field via `aria-describedby`.

## 10. Application Shell & Navigation

- Persistent header: TokTickIT title (left), My Tickets / Create Ticket
  nav links (center-left), current Requester name + "Change Requester"
  (right).
- Active nav item underlined/highlighted in `--zg-secondary`.
- Mobile: nav collapses into a hamburger/menu button; Requester identity
  and Change Requester remain reachable within one tap.

## 11. My Tickets — List Layout

**Desktop columns:** Ticket No., Created Date, Summary, Category, Requested
Priority (badge), Current Status (badge), Last Updated. (Chosen over
including IT Priority/Ticket Owner, which stay null/unassigned in Lab 2 and
would only add empty columns.)

**Mobile:** each Ticket renders as a stacked card — Ticket No. + Status
badge on the top row, Summary below, Category/Priority/Last Updated as
small meta text.

**Controls:** search box (Ticket No./Summary), Category filter, Requested
Priority filter, Status filter, sort dropdown, Clear Filters button,
pagination controls (Previous/page numbers/Next), Create Ticket button
top-right.

**Empty vs. no-results:** "empty" state (zero Tickets ever) shows an
illustration-free message plus a Create Ticket button. "No-results" state
(filters/search active, zero matches) shows a message plus a "Clear
Filters" action — visually distinct copy so the Requester isn't confused
into thinking they have no tickets at all.

## 12. Priority & Status Badge Rules

| Value | Badge color | Text |
|---|---|---|
| Requested/IT Priority: Low | `--zg-pale` bg, `--zg-secondary` text | "Low" |
| Requested/IT Priority: Medium | Amber bg (`#FCEFD8`), `--zg-warning` text | "Medium" |
| Requested/IT Priority: High | Light red bg (`#FBE7E4`), `--zg-error` text | "High" |
| Status: New | `--zg-pale` bg, `--zg-secondary` text | "New" |

## 13. Requester Ticket Detail — Read-Only Layout

- Header block (read-only fields, `--zg-field-readonly-bg` styling):
  Ticket No., Ticket Date, Requester, Category, Related System, Requested
  Priority (badge), IT Priority (badge or "Not yet assigned"), Current
  Status (badge), Summary, Description.
- Clearly separated **Attachments panel** below the header — visually
  distinct section with its own heading, so Ticket info and attachment
  actions are never visually merged.
- No Public Comments / Internal Notes / Actions Taken sections exist in
  Lab 2 (explicitly out of scope).

## 14. Attachment States (Detail screen)

| State | Presentation |
|---|---|
| Active | File name, size, uploaded date, Download + Remove buttons |
| Uploading | File name + progress spinner, actions disabled |
| Invalid (rejected) | Shown briefly with error reason, then dismissed — never persisted |
| Removed | Greyed-out row, "Removed" badge, removal reason shown, no Download button, Remove button hidden |
| Unavailable (download failed) | Toast/banner error, row stays in Active state (not silently marked removed) |

## 15. Desktop Table vs. Mobile Card / Attachment List

Desktop: attachments render as a compact table (Name, Size, Uploaded,
Status, Actions). Mobile: each attachment renders as a stacked row with
the same information, actions as full-width buttons below the metadata.

## 16. Screenshot Paths for Visual Checklist

```
artifacts/lab-02/screenshots/create-ticket/{desktop,tablet,mobile}.png
artifacts/lab-02/screenshots/my-tickets/{desktop,tablet,mobile}.png
artifacts/lab-02/screenshots/ticket-detail/{desktop,tablet,mobile}.png
```

## 17. Visual Checklist (to complete during Issue 9)

- [ ] No clipped labels or truncated badge text at any breakpoint
- [ ] No overlapping validation messages or buttons
- [ ] No unintended horizontal scrolling at 375px width
- [ ] Editable vs. read-only fields are visually distinguishable at a glance
- [ ] Badge colors match section 12 exactly, with text always present
- [ ] Busy/disabled button states are visually distinct from their active state
- [ ] Empty state and no-results state are visually distinguishable from each other
