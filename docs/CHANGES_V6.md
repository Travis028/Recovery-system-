# LDRS v6 — changes from v5

All items below were requested or found during testing on 9 Nov 2026.

## New

| Area | Change |
|---|---|
| Register found document (Finder, Officer) | Section 3 now asks **County → Sub-county → Ward → Nearest landmark** (all required). Each list only shows the places inside the one above. `found_location` is filled from them automatically, e.g. "Kondele roundabout, Kondele Ward, Kisumu Central, Kisumu County". |
| Report lost document (Owner) | New section **Where it was lost** with the same four fields — optional, but must be consistent if given. Shown on the confirmation. |
| Kenya place data | `shared/kenya-admin-units.json`: 47 counties, 301 sub-counties (KNBS), 1,450 wards (IEBC). Source and corrections in `shared/README.md`. The backend rejects places that do not belong together. |
| Database | Migration `002_add_location_fields.sql` adds `county`, `sub_county`, `ward`, `landmark` to `documents` and `loss_reports` (columns only; existing rows untouched). |
| `npm run migrate` | Applies pending migrations once, in order, recorded in `ldrs_v6.schema_migrations`. The backend refuses to start until it has been run. |
| Audit trail | **Time** column now filled (also for old entries). Every new entry gets a SHA-256 fingerprint linked to the previous one; **Verify chain** works and reports tampering. Entries from before v6 show "before chain". |
| Settings / retention | Settings card shows the 4 settings the server applies; **Save settings** works and the owner search limit follows it. **Run retention now** works (unclaimed after 30 days, disposal incl. photo file after 180, audit entries after 365, chain stays verifiable). |
| Exports | **Anonymised CSV export** (Statistics) and **Download a copy of my data** (Owner) work on PostgreSQL. |
| Logout | Audit entry records the role. |

## Removed (on request)

- Login page notice "PostgreSQL mode (local development)…"
- Page-wide yellow banner after sign-in
- "Officer/Admin codes appear in the backend terminal (development only)." → now "Officers and administrators also confirm a six-digit code."
- Secure handover "LOCAL TEST ONLY: the code is printed in the backend terminal…" → now "The code goes to the owner, never to this screen…"

Codes still print in the backend terminal in development (there is no SMS yet) — only the on-screen text changed.

## Renamed to v6

| v5 | v6 |
|---|---|
| Folder `LDRS_Project_folder_ver5` | `LDRS_Project_folder_ver6` |
| API `/api/v5/...` | `/api/v6/...` (matches the `ldrs_v6` schema) |
| Packages `ldrs-v5-*` 5.0.0 | `ldrs-v6-*` 6.0.0 |
| `docker-compose.yml` without a project name | `name: ldrs_project_folder_ver5` pinned, so the v6 folder keeps using your existing data volume |

Kept unchanged: `.env`, `backend/.env` (same `DATABASE_URL`), photo and collection keys, the encrypted photo, all data.
The session cookie name is unchanged, but the path changed with the API, so sign in once more.

## Test results (build environment: PostgreSQL 16, Node 22, Chrome)

Run on a copy freshly extracted from the v6 zip, against a database migrated from the v5 schema with `npm run migrate`.

| Check | Result |
|---|---|
| Backend unit tests (incl. 5 location, 4 audit-chain tests) | 29/29 |
| Frontend unit tests / lint / build | 21/21 / clean / OK |
| Live API test, all 4 roles, real PostgreSQL | 104/104 |
| Browser test: every page for every role; match, claim, handover, receipt, settings, retention, exports, both location forms; development notices absent | 59/59, 0 errors |
| Audit trail in the browser: times shown, "before chain" label, Verify chain = intact | OK |
| Demo mode, built app with CSP through the proxy, smoke checks on `/api/v6` | OK |

Rerun the automated part any time with `bash scripts/check-all.sh`.
