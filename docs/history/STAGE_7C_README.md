# LDRS Version 7 — Stage 7C: real PostgreSQL authentication (LOCAL TEST KIT)

**This package contains working-source changes, not another redesigned application.** It starts from the full supplied Version 6/7 React application and adds a separate PostgreSQL-backed authentication API for all four roles.

> **LIMITATION:** Stage 7C integrates **authentication and sessions**, not the 12 entity APIs. Login can be tested against the actual `ldrs_v6.users`, `ldrs_v6.sessions`, and `ldrs_v6.challenges` tables. The other dashboards, uploads, OCR, claims, and handover **are not yet server-backed**. In server-auth mode, unfinished data operations deliberately return 501 instead of silently using browser-local records. Default mode retains your original interactive Version 4/6 demo and dashboards.
>
> Use **fictional records only**. This is a local development kit, not production-ready security, SMS, or identity storage.

## Folder/version map — read first

| Folder | What it is | Should it be changed? |
|---|---|---|
| Your existing `LDRS_Project_folder_ver5` | Docker Compose (`5433`) and old V5 API (`4000`) | **No. Leave untouched.** |
| Your existing `LDRS_Project_folder_ver6` | Previously verified full React app | **No. Leave untouched.** |
| Your existing `LDRS_Project_folder_ver7` | Previously verified Stage 7A starter | **No. Leave untouched.** |
| **New extracted folder: `LDRS_Project_folder_ver7_auth`** | **This Stage 7C integration kit** | Work here only |
| `LDRS_Project_folder_ver7_auth/backend-v7` | **New** authentication server, port `4001` | New work |
| `LDRS_Project_folder_ver7_auth/frontend` | Full original React UI + opt-in server-auth adapter | New work |
| `LDRS_Project_folder_ver7_auth/backend-v5-reference` | Snapshot of old V5 pilot; **do not run** | Reference only |
| `LDRS_Project_folder_ver7_auth/database` | Existing migration **reference** | **Do not re-run migration 001** — already applied |

## A. Start existing PostgreSQL — VERSION 5 main folder (only if not running)

1. Open VS Code in **your existing `LDRS_Project_folder_ver5`**.
2. Open terminal there (the main folder with `docker-compose.yml`).
3. Run **only if Docker PostgreSQL is stopped**:

```bash
docker compose up -d db
docker compose ps
```

Expected database service `db`, `healthy`, host port `127.0.0.1:5433`.

You already created 17 `ldrs_v6` tables. **Do not rerun the migration or drop/recreate the database.**

## B. Set up NEW authentication server — NEW `ver7_auth/backend-v7` folder

1. Extract this ZIP **beside** your existing folders and rename the extracted folder to `LDRS_Project_folder_ver7_auth`.
2. Open that **new** folder in VS Code.
3. In its Explorer, right-click **`backend-v7`**, choose **Open in Integrated Terminal**, and confirm that terminal's current folder ends in `backend-v7`.
4. Run:

```bash
cp .env.example .env
npm ci
npm test
```

5. In **`backend-v7/.env` only**, replace `CHANGE_ME` inside `DATABASE_URL` with the **same PostgreSQL password** you set in Version 5 Docker. Preserve hostname `127.0.0.1`, port **5433**, database `ldrs_local`. Do not share that password.

6. First-time ONLY, if **`ldrs_v6.users` is empty**, run from **`backend-v7`**:

```bash
npm run seed:dev
```

This inserts **fictional Owner, Finder, Officer, Admin users** and a demo station into `ldrs_v6` ONLY. It prints four **random passwords once**. Keep them private. It refuses to overwrite existing accounts. If it reports that users exist, **do not reset tables**; see the instructions in `docs/STEP_7C_AUTH.md`.

7. From **the same `backend-v7` folder**, start the server and **leave the terminal open**:

```bash
npm start
```

Expected: `LDRS Version 7 AUTH backend: http://127.0.0.1:4001/api/v7/health`.

8. In a **second terminal** (any folder), verify:

```bash
curl -i http://127.0.0.1:4001/api/v7/health
```

Expected HTTP 200, `"database":"postgresql"`, `"schema":"ldrs_v6"`.

To run read-only API tests, open another terminal in **`backend-v7`** and execute:

```bash
node scripts/smoke-check.mjs
```

Expected four checks: 200 `/health`, 200 `/pickup-points`, 401 `/auth/me`, 401 `/admin/officers`.

## C. Use your ORIGINAL React login screen with server authentication — NEW `ver7_auth/frontend` folder

1. In **the new `LDRS_Project_folder_ver7_auth`**, open another terminal specifically in **`frontend`**.
2. Execute:

```bash
npm ci
npm test
npm run build
```

3. Start the **opt-in authentication test mode** on an intentionally separate port, `5175`:

```bash
env VITE_LDRS_AUTH_MODE=server npm run dev -- --port 5175
```

4. In Chrome open **`http://127.0.0.1:5175/login`** (not `4000`, `5173`, or `5174`).
5. Test **Owner** and **Finder** using the random passwords printed by `seed:dev`. They sign in with PostgreSQL sessions.
6. Log out, then test **Officer** and **Admin**. After entering email/password, a six-digit **development-only** code appears in the **`backend-v7` terminal on port 4001**. Enter it on the existing two-step React login screen.
7. The dashboard header will display a prominent notice that document/claims/etc. are not yet migrated. This is **intentional** and prevents false claims that your browser demo records are in PostgreSQL.

### Verify the two local APIs don't conflict

| URL | Served by | Expected |
|---|---|---|
| `http://127.0.0.1:4000/api/health` | **Existing V5 backend** | Existing Owner/Finder pilot, unchanged |
| `http://127.0.0.1:4001/api/v7/health` | **NEW V7 auth backend** | PostgreSQL auth schema `ldrs_v6` |
| `http://127.0.0.1:5175/api/v7/health` | V7 React Vite proxy → **V7 auth** | 200, `"schema":"ldrs_v6"` |
| `http://127.0.0.1:5175/api/health` | V7 React Vite proxy → **V5 pilot** | 200, `"database":"postgresql"` |

### Return to unchanged original demo UI

Stop the `frontend` terminal with Ctrl+C, then **from `ver7_auth/frontend`** run **without the flag**:

```bash
npm run dev -- --port 5175
```

This retains the detailed original browser prototype; it does not migrate records.

## What changed in source

- **Added:** `backend-v7/` (PostgreSQL auth server, dev fixture seeder, security tests, HTTP smoke checks).
- **Added:** `frontend/src/api/serverAuth.js` (actual cookie-based auth adapter, opt-in).
- **Modified:** `frontend/src/api/client.js` (switchable auth; fail-closed 501 for unintegrated entity operations in server-auth mode).
- **Modified:** `frontend/vite.config.mjs` (proxy `/api/v7` to `4001`; preserve `/api` on V5 `4000`).
- **Modified:** `frontend/src/pages/Login.jsx`, `frontend/src/components/AppLayout.jsx` (visible stage notices and hide old hard-coded demo passwords in server-auth mode). **No dashboard component was deleted or redesigned.**
- `database/migrations/001_create_isolated_v6_schema.sql` remains as reference; **do not rerun**.
- **No code writes to the original Version 5 `public` tables**. The dev seed only writes to `ldrs_v6`.

## Security and realistic limitations

- Session cookie is HttpOnly and SameSite=Strict, backed by a hashed token in `ldrs_v6.sessions`.
- Passwords use PBKDF2-SHA256 on the server. Password hashes/salts never appear in the `/me` response.
- Public registration can create Owner, Finder or **unapproved** Officer. It **cannot** create Admin accounts. Only a logged-in Admin can approve an Officer using the separate backend endpoint.
- Approved Officer and Admin require a second code. **For this local development stage, the code is printed in the backend terminal** and expires after 5 minutes. **Do not use this configuration for production or real identity documents.** With `LDRS_DEMO_OTP=0`, privileged login is disabled until a real SMS/TOTP provider is added.
- Server-managed records/permissions outside authentication are **not implemented yet**. Do not use browser prototype data as proof of server-side security.
- Don't upload `.env` files, password dump, logs, real ID numbers, or real document photographs.
- Never run `docker compose down -v` in Version 5.

## Tests performed before packaging

- `backend-v7`: JavaScript syntax verified and six pure security unit tests passed.
- Original React source from Stage 7 package preserved; additions are opt-in.
- **Not performed here:** Real PostgreSQL integration test or React `npm run build` because this environment lacks the npm packages and access to your running Docker. **Run the exact commands above on your CachyOS laptop** and share any errors.

## What is next after Stage 7C passes

**Stage 7D:** migrate Owner/Finder records, officer-scoped queries, real document uploads and access-controlled image retrieval. Then claims, matching, handover and admin functions. **Do not overwrite Version 6 or Version 7 as you proceed.**
