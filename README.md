# LDRS v6 — Lost Documents Recovery System

React frontend + Node.js backend + PostgreSQL (Docker). Everything runs on this laptop only (127.0.0.1).

> **Local development only. Use fictional test data — never real ID numbers or real document photos.**
> Officer/Admin sign-in codes, phone codes and collection codes are printed in the backend terminal; no SMS is sent.

## Folder map

| Item | What it is | Port |
|---|---|---|
| `docker-compose.yml` + `.env` | PostgreSQL 16 (your existing container and data volume) | 5433 |
| `backend/` | API server, routes `/api/v6/...` | 4001 |
| `frontend/` | React app (Vite); `npm run dev` uses the backend through a proxy | 5175 |
| `shared/` | Kenya counties → sub-counties → wards list, used by backend and frontend | — |
| `database/` | Migrations (`npm run migrate` applies them), checks, read-only queries | — |
| `docs/` | `API.md`, `CHANGES_V6.md`, `history/` (earlier versions) | — |
| `scripts/check-all.sh` | Every automated check in one go | — |

Database: `ldrs_local` on `127.0.0.1:5433`, user `ldrs_app`, schema `ldrs_v6`.
`docker-compose.yml` pins the Compose project name to `ldrs_project_folder_ver5`, so it always reuses your existing
data volume `ldrs_project_folder_ver5_ldrs_pgdata`. **Do not change that name** and never run `docker compose down -v`.

Private files kept from your previous folder (they decrypt the photos and verify the receipts already in your database —
keep them with the project and out of Git): `.env`, `backend/.env`, `backend/.private-photo-key`,
`backend/.private-collection-key`, `backend/.private-document-photos/`.

## Moving from LDRS_Project_folder_ver5 (once)

Extract the zip next to the ver5 folder, e.g. into `~/MEGA/Coding_files/OUK/Project/LDRS Project folder/`. Then:

```fish
# 1. stop the ver5 backend and frontend (Ctrl+C in their terminals); free the ports if needed
fuser -k 4001/tcp 5175/tcp

# 2. hand the database over to the v6 folder (same container, same data)
cd ~/MEGA/Coding_files/OUK/Project/"LDRS Project folder"/LDRS_Project_folder_ver6
docker compose up -d db
docker inspect ldrs_project_folder_ver5-db-1 --format '{{range .Mounts}}{{.Name}}{{end}}'
#    must print: ldrs_project_folder_ver5_ldrs_pgdata

# 3. backend: install, update the database (adds the location columns), check
cd backend
npm ci
npm run migrate          # applies 002_add_location_fields once
npm run check:db         # 17 tables, your record counts, photo files present
npm test                 # 29 tests

# 4. frontend
cd ../frontend
npm ci
npm test                 # 21 tests
```

Keep the ver5 folder until you have checked v6, then archive it. Do not run both backends at once (same port and database).

## Run it every day — two terminals

**Terminal A** (`backend/`): `npm start` → `LDRS v6 backend: http://127.0.0.1:4001/api/v6/health`. Keep it visible — codes appear here.

**Terminal B** (`frontend/`): `npm run dev` → open **http://127.0.0.1:5175**.

PostgreSQL starts by itself with Docker (`restart: unless-stopped`). If not: `docker compose up -d db` in this folder.

Quick checks (backend running): `cd backend && npm run smoke` (direct) or `npm run smoke -- http://127.0.0.1:5175` (through the frontend).

## Commands

| Where | Command | What it does |
|---|---|---|
| project root | `docker compose up -d db` / `docker compose ps` | Start / check PostgreSQL |
| project root | `bash scripts/check-all.sh` | All automated checks |
| `backend/` | `npm start` | API on 127.0.0.1:4001 |
| `backend/` | `npm run migrate` (`-- --status`) | Apply pending database migrations (or list them) |
| `backend/` | `npm test` | Unit tests (no database needed) |
| `backend/` | `npm run check:db` | Read-only database check |
| `backend/` | `npm run smoke` | Read-only HTTP checks against the running backend |
| `backend/` | `npm run seed:dev` | Empty database only: creates 4 fictional accounts |
| `frontend/` | `npm run dev` / `npm run dev:demo` | App on PostgreSQL / browser-only demo |
| `frontend/` | `npm run build` / `npm run preview` | Production build / serve it on 5175 with the same proxy |
| `frontend/` | `npm test`, `npm run lint`, `npm run check:contrast` | Unit tests, lint, colour contrast |

## What works on PostgreSQL

- **Accounts:** register, login, two-step code for Officer/Admin, password reset, logout, officer approval, lockout after 5 wrong passwords
- **Finder/Officer:** register a found document with an encrypted photo and **county → sub-county → ward → nearest landmark** (all 47 counties, 301 sub-counties, 1,450 wards); duplicate detection
- **Owner:** phone verification, report a lost document (place optional), automatic match candidates, masked search, claims, alerts, download own data
- **Officer:** match and claim review, collection code, secure handover, signed receipt with QR, statistics for own station
- **Admin:** users, pickup points, audit trail with time and SHA-256 hash chain (**Verify chain**), statistics, anonymised CSV export,
  settings (search limit, retention periods), **Run retention now**, owner data requests (complete / decline / removal)

Not connected: browser snapshot backups (use `pg_dump` — see `database/README.md`), captcha, real SMS.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Database needs an update (migration 002…)` | `cd backend && npm run migrate` |
| `Unable to connect to PostgreSQL` | `docker compose up -d db` in this folder; check `DATABASE_URL` in `backend/.env` |
| `docker compose` makes a new empty database | `docker-compose.yml` lost its `name: ldrs_project_folder_ver5` line — put it back, `docker compose down` (no `-v`), `up -d db` |
| `Port 4001/5175 is already in use` | Another LDRS backend/frontend is running: `fuser -k 4001/tcp` or `fuser -k 5175/tcp` |
| `Cannot reach the LDRS v6 backend` | Terminal A is not running |
| `403 Origin not allowed` | Open `http://127.0.0.1:5175` or `http://localhost:5175` |
| Old photos show "Image not available" | Copy `.private-photo-key` and `.private-document-photos/` from the previous folder into `backend/` |

See `docs/CHANGES_V6.md` for everything that changed from v5.
