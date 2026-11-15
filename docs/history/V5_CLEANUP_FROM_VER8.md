# What changed from `LDRS_Project_folder_ver8` to the clean v5 project

## Source: what the ver8 folder actually contained

| ver8 item | State found | In v5 |
|---|---|---|
| `backend-v7/` | Live backend, with **both** patches (PostgreSQL records + handover) already applied | → `backend/` |
| `frontend/` | Live React app, patches applied; plus `dist/` and `node_modules/` | → `frontend/` (no `dist/`, no `node_modules/`) |
| `LDRS_V8_PostgreSQL_Patch/`, `LDRS_V8_Handover_Fix/` | Patch kits, already applied | Removed (notes kept in `docs/history/`) |
| `.ldrs-pre-postgres-integration-*/`, `.ldrs-pre-handover-*/` | Hidden backups of files from before the patches | Removed |
| `backend-v5-reference/` | Copy of the old pilot server ("do not run") | Removed — your original stays in `LDRS_Project_folder_ver5` |
| `scripts/verify-backend-bridge.mjs` | Checked the old pilot on 4000/5173 | Replaced by `backend/scripts/smoke-check.mjs` and `scripts/check-all.sh` |
| `database/` | Migration 001, checks, pilot schema | Kept, organised into `migrations/`, `checks/`, `queries/`, `reference/` |
| `docs/` + old `README.md` | Stage 7A–7C notes | Moved to `docs/history/`; new `README.md`, `docs/API.md` |

## Kept exactly

- `backend/.env` — same `DATABASE_URL` (host `127.0.0.1`, port `5433`, database `ldrs_local`, user `ldrs_app`), port 4001, dev OTP on.
  Only the comments changed, and `http://localhost:5175` was added to `APP_ORIGINS`.
- `backend/.private-photo-key`, `backend/.private-collection-key`, `backend/.private-document-photos/` — needed to read photos and verify receipts already in your database.
- Database schema `ldrs_v6` and all 17 tables — **no SQL migration, nothing renamed in the database.**
- All React screens, components and the browser-only demo mode.
- Dependency versions (lockfiles regenerated only for the new package names; 0 version changes).

## Renamed / aligned to v5

| Before | After |
|---|---|
| `backend-v7/` | `backend/` |
| API path `/api/v7/...` | `/api/v6/...` |
| Cookie `ldrs_v7_session` | `ldrs_session` (you sign in again once) |
| Labels "Stage 7C", "Version 7", "Version 8", "backend-v7 terminal" | "LDRS v6", "backend terminal" |
| Frontend dev port 5173 (default) / 5175 (by flag) | 5175 always (`strictPort`) |
| `env VITE_LDRS_AUTH_MODE=server npm run dev -- --port 5175 --strictPort` | `npm run dev` (PostgreSQL mode via `frontend/.env.server`) |
| `npm run dev` (browser demo) | `npm run dev:demo` |
| Vite proxy `/api/v7 → 4001` and `/api → 4000` (old pilot) | `/api/v6 → 4001` only |
| `frontend/src/api/backendTransport.js` (unused probe of old pilot) | Removed |

## Bugs fixed (found by the browser test of every screen)

1. **Statistics page crashed** for Officer and Admin in PostgreSQL mode ("Something went wrong"). The server returned only five totals;
   the screen needs matched/unclaimed counts, six-month trend, by-type and by-station tables, OCR accuracy and average recovery time.
   `statistics` now returns the full shape from PostgreSQL, still scoped to the officer's own station.
2. **Backups and data protection page failed to load** for Admin ("Settings could not be loaded") because it called `listBackups` (not built).
   In PostgreSQL mode the page now loads, shows owner data requests, and explains backups use `pg_dump` (see `database/README.md`).
3. **Owner data requests could not be completed** from that page (`completeDataRequest` was not built). Implemented on PostgreSQL:
   admin only, one decision per request, audited; a completed Removal request anonymises the owner's open reports and pending claims.
4. Settings rows now carry an `id`, so the settings form can save them.
5. **Audit trail had no time** (the server sent `logged_at`, the screen read `created_date`) — every entry now shows its date and time, including old entries.
6. **Audit trail had no fingerprints and "Verify chain" failed** — new module `backend/auditChain.mjs`: every new entry stores `prev_hash` + SHA-256 `hash`; Verify chain detects edited, deleted or inserted entries. Entries written before v5 show "before chain". No database migration needed (columns already existed).
7. Logout entries now record the user's role.
8. **Settings card was empty and "Run retention now" failed** — the 4 settings the server applies are created with defaults at startup, are validated when saved, and the search limit follows the saved value. `runRetention` works on PostgreSQL (unclaimed marking, disposal incl. photo file, audit purge that keeps the chain verifiable).
9. **"Anonymised CSV export" (Statistics) and "Download a copy of my data" (My data) failed** — both now work on PostgreSQL.
10. Misleading banners ("other workflows are NOT migrated", "handover still requires integration") replaced with an accurate one.

## Added

- `backend/scripts/check-db.mjs` (`npm run check:db`) — read-only connection and data check, including whether photo files exist for every upload.
- `npm run smoke` now accepts the proxy URL and explains failures.
- Clear startup errors when PostgreSQL is unreachable or port 4001 is taken.
- `database/README.md` (backup/restore of database **and** photo keys), `database/queries/useful_queries.sql`.
- Backend unit tests for the statistics fix (20 tests, up from 18).

## Test results in the build environment (PostgreSQL 16.15, Node 22, Chrome)

| Check | Result |
|---|---|
| Original ver8 backend, same live test (baseline) | 74/74 passed before any change |
| Backend unit tests | 20/20 |
| Live API end-to-end test, all 4 roles, real PostgreSQL | 79/79 |
| Browser test: UI login for all roles, every menu page, match/claim/handover/receipt flows clicked in the UI | 49/49, 0 console or server errors |
| Frontend unit tests / lint / build / contrast | 21/21 / clean / OK / all pairs pass WCAG AA |
| Built app (`npm run build` + `npm run preview`) through proxy, with CSP | OK |
| Browser-only demo mode (`npm run dev:demo`) | OK |

The test database was a fresh PostgreSQL 16 cluster with the same user, password, database name, port and migration as yours.
Your real records were not available here, so run `npm run check:db` and sign in on your laptop to confirm your own data.
