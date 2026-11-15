# LDRS Version 8: In-place collection code and handover fix

**No new project version. No SQL migration. No replacement UI.** Apply this to your **existing** `LDRS_Project_folder_ver8` with the prior PostgreSQL integration patch already installed.

## What this fixes

The red `generateCollectionCode is not yet connected to PostgreSQL` message is caused by an unimplemented backend function. This patch adds:

- Approved-Officer/Admin-only **collection code issuance** and status retrieval
- A **six-digit, five-minute, single-use** code, stored only as a keyed hash in the existing `ldrs_v6.otp_codes` table
- **Three-attempt lockout**, hourly issuance rate limit, and auditable events
- An atomic PostgreSQL **complete handover** operation: reference code, document number, officer's physical-ID attestation, claimant name/ID, collection code; then a receipt, status updates, and an audit record
- **Public receipt QR verification** with no personal data in public responses
- An honest local-test message in the existing handover screen: **the code is printed in the backend terminal; NO SMS is sent**

> THIS IS FOR FICTIONAL LOCAL TESTS ONLY. Real SMS delivery, backup of signing keys, additional security review, and end-to-end live testing are still required before any real identity-document handling.

## Exact installation (same Version 8)

1. **Working location: Version 8 project root** (`LDRS_Project_folder_ver8`, containing `backend-v7/` and `frontend/`).
2. Extract `LDRS_V8_Handover_Fix.zip` **inside that existing Version 8 folder**. This creates a patch subfolder; it is NOT another project version.
3. Stop your running **Version 8 backend** (port 4001) and **Version 8 frontend** (port 5175) with Ctrl+C. Keep **Version 5 Docker PostgreSQL** running.
4. In a terminal in the **Version 8 project root**, run:

```bash
python3 LDRS_V8_Handover_Fix/apply.py .
```

The patch backs up only the affected existing files to a hidden `.ldrs-pre-handover-YYYYMMDD-HHMMSS/` folder before modifying them. It preserves the previous SQL parameter-numbering fix in `records.mjs` and does not touch `.env` or PostgreSQL tables.

5. **Version 8 → backend-v7 terminal**:

```bash
cd backend-v7
node --check records.mjs
node --check handover.mjs
npm test
npm start
```

Use an additional terminal for step 6; keep the backend running.

6. **Version 8 → frontend terminal**:

```bash
cd frontend
npm test
npm run build
env VITE_LDRS_AUTH_MODE=server npm run dev -- --port 5175 --strictPort
```

7. Open http://127.0.0.1:5175. With an **approved Police Officer**, open an existing **Confirmed** match on the **Handover** screen. Click **Create six-digit code**. The code appears **only** in the **Version 8 backend-v7 terminal**, prefixed `[LDRS DEVELOPMENT COLLECTION CODE]`. **Do not expect an SMS**. Use fictional test details to enter reference/document number, code, collector ID, and physical-check attestation. Approve release, then inspect the receipt.

## Read-only PostgreSQL verification

**Version 5 → database/queries.sql**, PostgreSQL connection `LDRS Docker → ldrs_local`:

```sql
SELECT id, match_id, used, attempts, locked, expires_at
FROM ldrs_v6.otp_codes ORDER BY created_at DESC LIMIT 5;

SELECT id, document_id, match_id, officer_user_id, created_at
FROM ldrs_v6.handovers ORDER BY created_at DESC LIMIT 5;
```

There is no plaintext collection code in PostgreSQL. Never use actual identity numbers during testing.

## What is and is not validated

- JS syntax and seven new pure/security unit tests were verified in the packaging environment.
- The complete backend test suite passed in a reconstructed Version 8 source copy (13 tests in that reconstructed baseline; the actual installed Version 8 may have additional tests).
- The React build and **live PostgreSQL end-to-end release were not run here**. They must pass on your laptop before trusting handover results.
- **No database migration is needed**: uses your existing `ldrs_v6.otp_codes`, `handovers`, `notifications`, `rate_events`, `audit_log`, and document/match tables.

## Important safety and backup detail

`backend-v7/.private-collection-key` is created on first issue and is Git-ignored. **Do not delete or expose it**: old OTP hashes/receipt signatures depend on it. Protect it as you protect your database backups. Run only on localhost, with `LDRS_DEMO_OTP=1` for fictional test mode. When demo mode is off, code issuance and release fail closed because production SMS delivery is not integrated.

If patch application fails because a file differs from our reference, it refuses to apply. Share the exact error and the non-secret code around the affected line; do not discard your existing working Version 8 source.
