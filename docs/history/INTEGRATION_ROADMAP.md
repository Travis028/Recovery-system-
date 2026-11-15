# LDRS Full Stack Integration Roadmap

## Already verified on the user's laptop

- Native development environment: Node 24, npm 12, Docker Engine and Compose, VS Code.
- PostgreSQL 16 in Docker on host port 5433 is healthy.
- V5 API health request returned HTTP 200 with `database: postgresql`.
- V5 pilot Owner/Finder records, audit entries and database volume survived restart.
- V5 returned 401 for anonymous `/api/matches` and 403 for an authenticated Finder calling that Owner endpoint.
- V6 source passed 21 Vitest tests and production build on the user's machine; user verified all four role dashboards render. React Router 7 upgrade had no production audit findings in their terminal logs.

**These results do not demonstrate production readiness or a complete auth/security audit.**

## Stage 7A: Preserve UI and test local API bridge — included now

- Retain original source and routes, add Vite `/api` development proxy.
- Check `/api/health` through port 5173; do not claim v6 records are in PostgreSQL.
- No changes to source components or demo role flows.
- **Acceptance:** 21 tests pass, build passes, all four dashboards render, proxy health GET returns 200.

## Stage 7B: Propose isolated schema — included now; applying migration is optional/manual

- Create 12 named entity tables, four internal support tables, one schema ledger in `ldrs_v6`.
- Do not touch six `public` tables or Docker volume.
- Do not use real identities until security/privacy work is finished.
- **Acceptance:** `tables_created=17`, migration ledger shows version 001, original `public` tables and record counts remain unchanged.

## Stage 7C: Four-role authentication — next coding milestone

- Server-owned cookies and sessions; roles Owner/Finder/Officer/Admin; authenticated `/me` contract.
- Officer approvals and station scoping; no public Admin registration.
- Real server challenge/OTP for privileged login, with development-only test mechanism clearly separated from production delivery.
- Port login/register screens to call actual server endpoints without redesigning them.
- **Acceptance:** 401 anonymous; 403 wrong role; officer pending approval cannot perform officer operations; admin-only settings enforced server-side; session expiry/logout works; no password hashes or code tokens returned in JSON.

## Stage 7D: Document and owner flows

- Registered found document + private image storage + OCR validated server-side.
- Loss report + verified phone / consent + masked search.
- Ensure records persist through DB and backend restart.
- **Acceptance:** same forms and photos work; repeated requests safely rejected; no other user can fetch raw documents.

## Stage 7E: Match, claim, officer and handover

- Persistent `Match` records; matching scores and review trail.
- Claims evidence, role-specific approval, secure single-use collection code and handover record.
- **Acceptance:** handover cannot occur without approved match and code; transactions rollback together on errors; audit covers every transition.

## Stage 7F: Admin and go-live hardening

- User approvals, pickup points, system settings, statistics, audit hash-chain verification, data requests and retention.
- Server-side validation, encryption in transit/at rest strategy, proper migrations, backups/restore and audit security.
- Accessibility, performance, deployment, legal/privacy and load testing.
- **Acceptance:** no real identity data until secure storage and access controls have been independently tested.

## Things NOT to do

- Do not replace full v6 frontend with the minimal pilot.
- Do not rename v5 database columns in `public` or overwrite existing pilot records.
- Do not copy original browser demo sessions/users directly into production tables.
- Do not make database credentials available to browser code.
- Do not use the `matches=0` pilot result to claim that persistent matching is complete.
