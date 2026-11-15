# Stage 7C — Validation, evidence, and troubleshooting

## Database and version map

- **Version 5, main folder:** Existing Docker PostgreSQL container and original six `public` pilot tables. Never run the V7 authentication server from here.
- **Version 7 Auth Kit, `backend-v7`:** New authentication API, separate server on `127.0.0.1:4001`.
- **Version 7 Auth Kit, `frontend`:** Full original React interface. Normal demo mode uses original browser-only data; optional server auth mode uses `ldrs_v6.users` and `ldrs_v6.sessions`.
- **Version 5, `database/queries.sql`:** Existing VS Code PostgreSQL extension connected to `127.0.0.1:5433`, `ldrs_local`, where you can run the verification SQL shown below.

## Database verification query — run ONLY in VS Code connected to ldrs_local

```sql
SELECT role, ldrs_role, approved, COUNT(*) AS total
FROM ldrs_v6.users
GROUP BY role, ldrs_role, approved
ORDER BY role, ldrs_role;

SELECT COUNT(*) AS active_sessions
FROM ldrs_v6.sessions
WHERE expires_at > now();

SELECT action, COUNT(*) AS total
FROM ldrs_v6.audit_log
GROUP BY action
ORDER BY total DESC;
```

Do not run `SELECT * FROM ldrs_v6.users` or `SELECT * FROM ldrs_v6.sessions` and publish results. Those tables include secret hashes or session metadata.

## API read-only smoke tests — run in NEW ver7_auth/backend-v7

After `npm start` is running in another terminal:

```bash
node scripts/smoke-check.mjs
```

Expected status codes: health 200, pickup-points 200, unauthenticated me 401, unauthenticated admin 401. A failed test should be reported exactly, without changing the database.

## React browser test — run in NEW ver7_auth/frontend

```bash
env VITE_LDRS_AUTH_MODE=server npm run dev -- --port 5175
```

At `http://127.0.0.1:5175/login`, sign in with the random demo accounts from `seed:dev`. Expected:

1. Owner and Finder establish a cookie and can load their role navigation. Document/report data APIs deliberately show not-yet-integrated errors; they do not silently use the old browser database.
2. Approved Officer and Admin first see the existing two-step form. The development OTP appears in the **backend-v7** terminal, not in the React page or an SMS inbox.
3. After privileged sign-in, `GET /api/v7/auth/session-check` returns the authenticated role; `GET /api/v7/admin/officers` should reject Owner/Finder/Officer with 403.
4. Logout destroys the server session; `GET /api/v7/auth/me` then returns 401.
5. Unapproved Officer must get 403 for `/api/v7/officer/context`.

**Only after the frontend tests pass** should Stage 7D proceed.

## If you cannot sign in

- Use the random credentials printed by **NEW backend-v7** `npm run seed:dev`. The original v4 hard-coded demo passwords are for browser demo mode **only**.
- `LDRS_DEMO_OTP=1` must be present in `backend-v7/.env` for development-only Admin/Officer code generation. Never use real ID data while enabled.
- The code is printed in the `backend-v7` terminal running `npm start`, not in the V5 `backend` terminal.
- Verify `curl -i http://127.0.0.1:4001/api/v7/health` returns `schema: ldrs_v6`.
- Verify `curl -i http://127.0.0.1:5175/api/v7/health` reaches the same backend through the Vite proxy.
- If `seed:dev` says accounts already exist, do not delete them or rerun migration. Check role counts in VS Code as shown above and use existing credentials; request a controlled password recovery later if needed.

## Scope boundaries

This Stage 7C tests server-side authentication, sessions, two-step challenge, role gating, and officer approvals API. It does **not** implement uploads, OCR, matching persistence, claims, handover, or complete administration. Those integrations must be implemented separately. Do not run on a public interface or with personal identification information.
