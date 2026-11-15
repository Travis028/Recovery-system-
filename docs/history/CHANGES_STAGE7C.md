# Detailed source changes from Stage 7A package

Original Version 6 React screens from the supplied source are still present. No role dashboard, form, image component or OCR module was deleted or replaced.

| File / folder | Change |
|---|---|
| `backend-v7/security.mjs` | Password hashing, role-validation, cookie, token and OTP helper functions |
| `backend-v7/server.mjs` | New localhost auth API on port 4001 writing only to `ldrs_v6` schema |
| `backend-v7/scripts/seed-dev.mjs` | One-time fictional Owner/Finder/Officer/Admin seed with random passwords; refuses nonempty accounts |
| `backend-v7/test/security.test.mjs` | Six isolated tests, no database required |
| `backend-v7/scripts/smoke-check.mjs` | Read-only HTTP checks against live backend |
| `frontend/src/api/serverAuth.js` | Opt-in V7 auth HTTP adapter via Vite proxy |
| `frontend/src/api/client.js` | Switch auth client only when configured, block unintegrated entities in that mode |
| `frontend/src/pages/Login.jsx` | Same React login screen, dev auth-mode notification, hide incompatible original demo credentials |
| `frontend/src/components/AppLayout.jsx` | Banner states document workflows are not yet integrated; no dashboard redesign |
| `frontend/vite.config.mjs` | Add `/api/v7` proxy to 4001 before existing `/api` proxy to 4000 |

**No database migration is necessary:** The user's `ldrs_v6` 17-table migration was already applied successfully. The new backend reads and writes existing tables only. The original `public` pilot tables remain untouched.
