# LDRS Version 8 — PostgreSQL source patch (NOT a new version)

This modifies your **existing Version 8 folder**. It does not replace your React dashboards, does not touch your `.env` files and does not run any SQL migrations. It targets the **existing** Docker PostgreSQL `ldrs_local` database, `ldrs_v6` schema (17 tables), and the **existing** Version 8 authentication server on port 4001.

## Apply in the existing Version 8 project

1. Stop the **Version 8 backend** and **Version 8 frontend** using Ctrl+C in their terminals. Leave Docker PostgreSQL running (Version 5's Docker Compose project). You can leave the old Version 5 pilot backend separate on port 4000.
2. Extract the patch ZIP *inside* `LDRS_Project_folder_ver8`. In that Version 8 **main folder**, run:

   ```bash
   bash LDRS_V8_PostgreSQL_Patch/apply.sh .
   ```

   The script backs up original affected source files in a `.ldrs-pre-postgres-integration-*` folder inside Version 8. It does not touch database records or secrets.

3. Terminal **A — Version 8 / backend-v7**:

   ```bash
   cd backend-v7
   npm test
   npm start
   ```

   `npm test` should include six original auth tests and five new API permission tests. The backend uses the *existing* `.env` and serves on `127.0.0.1:4001`. Keep it running.

4. Terminal **B — Version 8 / frontend** (open separately from the Version 8 main folder):

   ```bash
   cd frontend
   npm test
   npm run build
   env VITE_LDRS_AUTH_MODE=server npm run dev -- --port 5175 --strictPort
   ```

   Open `http://127.0.0.1:5175`. Use the **existing Version 8 PostgreSQL test accounts**; do not run `seed:dev` again.

5. Check the backend and login first. You can run `curl -i http://127.0.0.1:5175/api/v7/health` from any terminal.

## What is actually wired now

- PostgreSQL table-backed reads for existing Owner, Finder, Officer, and Administrator dashboard entities, with server-side per-user / per-station access scopes.
- The **existing Finder/Officer document form**, including private JPEG/PNG photo upload (5 MB limit). Original client OCR remains in the form; image bytes are stored AES-256-GCM encrypted in private backend files, while upload metadata and document rows are in PostgreSQL.
- The **existing Owner lost report form**, server-side rate-limited phone verification (terminal OTP in local dev mode), database-backed reports, and pending match creation.
- The existing Officer **Match review** actions: confirm/reject and notification records; claim submission and review; Administrator account and station list/update and dashboard statistics.
- Masked owner document search with a server-side per-user hourly request limit, along with user alerts, data requests, and auditable writes. Exact-name/number matches are **pending** until Officer confirmation; no automatic collection notice is sent.

**Not wired / do not treat as production-ready:** collection-code issuance, full secure handover, receipt verification, external SMS delivery, comprehensive security audit-hash validation, backup/retention operations, and public deployment. These deliberately return an explicit error, not fake success.

## Try one genuinely persistent end-to-end flow (FICTIONAL TEST DATA ONLY)

1. **Finder:** sign in, open **Register found document**, select the seeded verified pickup point, upload a TEST JPEG/PNG, enter fictional document name/number and found location, submit. A Document row and an Upload row should be created in PostgreSQL.
2. **Owner:** sign in, report a lost document with the same type and name/number. The server saves a LossReport and creates a **Pending** match in PostgreSQL.
3. **Officer:** sign in, open **Match review**, confirm the match (for their station). The server records **Confirmed**, updates the document/report statuses and saves a notification for the Owner.
4. **Owner:** reopen dashboard/Alerts; the confirmed match and notification should now display from the database.

With VS Code PostgreSQL connected to port `5433`, query only counts:

```sql
SELECT 'documents' AS entity, COUNT(*) FROM ldrs_v6.documents
UNION ALL SELECT 'reports', COUNT(*) FROM ldrs_v6.loss_reports
UNION ALL SELECT 'matches', COUNT(*) FROM ldrs_v6.matches
UNION ALL SELECT 'uploads', COUNT(*) FROM ldrs_v6.uploads
UNION ALL SELECT 'notifications', COUNT(*) FROM ldrs_v6.notifications;
```

**Never use real national IDs, passport images or personal data in this local development build.** Keep `.private-photo-key` and `.private-document-photos/` together for restoration. The DB dump alone does not back up image bytes or the encryption key. Both paths are excluded from Git.

## Troubleshooting and rollback

- `Port 5175 in use`: stop the previous Version 8 Vite process and retry.
- `401`: login session expired. Sign in to the server-auth frontend again.
- `403`: the server is enforcing Owner/Finder/Officer/Admin scope or Officer approval.
- `501`: that particular workflow has not yet been implemented on the real backend.
- If backend returns `500`, inspect the **Version 8 backend-v7** terminal and use only fictional test records.
- To revert source changes, copy the affected files from the printed `.ldrs-pre-postgres-integration-*` backup into the same paths. Nothing in the patch script alters the database.

The patch's unit tests ran successfully in the package development environment; **a live PostgreSQL end-to-end test was not possible here**. Run the steps above on your laptop before trusting the new flow.
