# LDRS audit (version 3.1)

This is the review done before the version 1.0 upgrade. It records what the system does, how it is
organised and what was broken or missing at the start. Each item is fixed in the commit history.

## What the system does

LDRS (Lost Documents Recovery System) helps people recover lost identity documents in Kenya.
Finders and officers register documents that were handed in at police stations or chief's offices.
Owners report a loss or search the register. The system matches the two, alerts the owner, and an
officer releases the document after checking identity with a one-time collection code.

## Roles

| Role | Can do |
|---|---|
| Owner | Report a lost document, search found documents (masked), claim a document, see alerts and collection codes, manage their data |
| Finder | Register a found document with a photograph, see the documents they handed in |
| Officer | Everything at their own station: documents, match review, claims, handover, receipts, statistics |
| Admin | All stations, users and roles, pickup points, audit trail, backups, retention, statistics export |

## Pages

| Route | Page | Roles |
|---|---|---|
| `/login` | Sign in, register, two-step code, password reset | Public |
| `/verify-receipt/:id` | Public receipt check from the QR code | Public |
| `/dashboard` | Role dashboard | All |
| `/report-found` | Register a found document | Finder, Officer, Admin |
| `/documents`, `/documents/:id` | Document list and record | Finder, Officer, Admin |
| `/report-lost` | Report a lost document | Owner |
| `/search` | Masked search of the register | Owner |
| `/alerts` | Alerts, confirmed matches, report status | Owner |
| `/matches` | Claims and match review | Officer, Admin |
| `/handover`, `/handover/:matchId` | Awaiting collection, secure handover | Officer, Admin |
| `/receipt/:id` | Printable handover receipt | Officer, Admin |
| `/pickup-points` | Pickup points (admin can edit) | All |
| `/statistics` | Totals, charts, anonymised export | Officer, Admin |
| `/audit` | Hash-chained audit trail | Admin |
| `/users` | Accounts, officer approval | Admin |
| `/system` | Backups, limits, retention, data requests | Admin |
| `/my-data` | Data protection rights, language, phone | Owner, Finder |

## Data flow

The app has no separate server. `src/api/` plays that part inside the browser:

- `db.js` keeps every table in `localStorage`, validates records against `src/entities/*.json`
  and runs multi-record changes in a single transaction.
- `permissions.js` checks every read and write against the signed-in role and masks fields.
- `functions.js` holds operations that must not be trusted to the screen (search, matching,
  handover, exports, backups).
- `auditStore.js` is an append-only log where each entry carries the hash of the one before it.
- `fileStore.js` stores photographs encrypted (AES-256-GCM) in IndexedDB.

Screens call `api.entities.X`, `api.functions.invoke(name)` and `api.auth`. Nothing in `src/pages`
writes to storage directly.

## Problems found

### Security and access

- `markUnclaimed` could be invoked by anyone, including a signed-out visitor.
- An approved officer could send any message to any user through `notifyOwner`.
- Claims were created directly from the screen, so phone and name were never checked on the server.
- CSV exports did not neutralise cells starting with `=`, `+`, `-` or `@` (spreadsheet formula injection).

### Bugs

- Approving a claim created a second loss report, because officers cannot read the owner's
  existing report.
- Confirming or rejecting a match was four or five separate calls with no transaction, so a
  failure part-way left a match confirmed but the document not updated.
- Opening a document logged "Record opened" even when the record was not found or not allowed.
- The officer dashboard counted unclaimed documents as "held".
- Documents, Statistics, Handover, Audit trail, Users and My data stayed on the loading spinner
  forever if a request failed.
- The "Verify chain" button stayed disabled if the check threw an error.
- After signing in, users always went to the dashboard instead of the page they asked for.

### Interface

- No dark mode. The Tailwind config renamed `blue`, `violet` and `indigo` to teal shades, and
  around 600 class names were hard-coded colours, so a theme could not be applied.
- Two font families loaded from Google Fonts; heavy gradients on every dashboard.
- No tables: lists could not be sorted or paged; the audit trail was one long table.
- Validation messages appeared only after submitting, and only as one red line.
- No error boundary, no 500 page, a bare 404 page.
- Icon-only buttons and filters had no accessible names; no skip link.
- One 617 KB JavaScript bundle; every page loaded up front.

### Housekeeping

- Leftover Base44 `rls` blocks in every schema, unused helpers, an alias to work around the
  `Components/` folder name, demo credentials always visible on the sign-in page.
