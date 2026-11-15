# LDRS v6 ↔ v5 compatibility analysis (actual supplied archives)

## Finding

The original Version 6 frontend is **not a client for the tested Version 5 API**. It implements a full browser-side imitation of the backend. The Version 5 backend is a separate, narrower PostgreSQL pilot. A direct `DATABASE_URL` change in the React app is **not possible or safe**: the browser cannot hold database credentials, and the apps have different user, session, document and matching contracts.

## Verified architecture

| Concern | Original v6 React frontend | V5 PostgreSQL pilot | Integration requirement |
|---|---|---|---|
| UI | Full React screens with Owner, Finder, Officer, Admin navigation | Separate minimal HTML/JS pilot | Keep React UI completely intact |
| Data API | `src/api/client.js` implements `api.entities.X.{list,filter,get,count,create,update,delete}` | HTTP routes `/api/{register,login,logout,me,documents,reports,matches,health}` | Implement V6 API functions on server, not just rename methods |
| Data persistence | `src/api/db.js` uses `localStorage`, key `ldrs.db.v1` | Six PostgreSQL tables in `public` | New `ldrs_v6` schema and tested migration strategy |
| Sessions | `src/api/client.js` uses `sessionStorage` key `ldrs.session` and a browser-local `Session` table | HttpOnly `ldrs_session` cookie and PostgreSQL `sessions` table | Unified server-owned session design |
| Passwords | Browser code in `src/api/crypto.js` | Server-side PBKDF2-SHA256 | Keep passwords and verification only on the server |
| Login roles | `role='admin'` for Admin, or `role='user'` + `ldrs_role` Owner/Finder/Officer | V5 `users.role` CHECK allows only Owner/Finder | Implement four-role server representation and migration |
| Officer approval | Pending/approved, station-specific permissions | No Officer role or pickup point schema | Add pickup-point management, approval and scope checks |
| Privileged two-step login | Demo code delivered via browser fake SMS | No Officer/Admin flow | Real server challenge/OTP and provider or explicitly isolated dev mechanism |
| Document uploads | `src/api/fileStore.js` IndexedDB image encryption; `UploadPrivateFile` interface | No private file endpoints | Secure image storage and signed retrieval in backend |
| OCR | Browser `tesseract.js` with CSP allowances | Not present | Preserve UI, decide protected server/client OCR flow |
| Matching | Browser functions with score/status and review | Dynamic SQL JOIN for Owner; `public.matches` table never written | Server transaction, persistence and officer review |
| Claims/handovers | Rich `Claim`, `Handover`, `OtpCode`, `Match` workflows | Not present | Implement review, OTP, confirmation, audited handover |
| Audit | Browser-local append-only hash chain | PostgreSQL basic audit events | Server append-only audit, verifiable chain and permissions |
| Settings/backups/data requests | Admin functions on browser storage | Not present | Separate administration services with least privilege |

## Entity compatibility inventory

Twelve named entities are defined under `frontend/src/entities/`: `AuditLog`, `Claim`, `DataRequest`, `Document`, `Handover`, `LossReport`, `Match`, `Notification`, `OtpCode`, `PickupPoint`, `Setting`, `User`.

Four internal tables occur in `frontend/src/api/db.js`: `Session`, `Challenge`, `Upload`, `RateEvent`.

The v5 pilot has six tables under `public`: `users`, `sessions`, `documents`, `loss_reports`, `matches`, `audit_log`. Similar table names do **not** imply compatible columns or semantics. In particular:

- V5 uses `finder_id`, v6 uses `finder_user_id`.
- V5 stores `document_number_last4`; v6 captures richer `document_number` data (sensitive).
- V5 `matches` has `report_id`, `score`, `status` but v6 uses `loss_report_id`, `match_score`, `match_type`, `match_status`.
- V5 supports only Owner/Finder; v6 additionally includes Officer/Admin, station scope and approval.
- V5 `/api/matches` returns on-demand candidates, while v6 reviews saved `Match` records.
- V6 browser-side `AuditLog` has a chain hash and sequence; v5 audit logging is non-chain-based.
- V6 OTP schema includes `otp_code` for the demo; production should **not** store the plaintext OTP. Stage 7 SQL uses `otp_hash` only.

## Compatibility verdict

**No safe one-line backend swap exists.** Port each contract to protected Node.js endpoints, test the role and privacy rules, then switch a UI function only when its server implementation passes tests.

## Stage 7 contents and modifications

- All 143 original v6 files are present; 142 remain byte-for-byte identical. The only changed original file is `frontend/vite.config.mjs` (development API proxy). One new file, `frontend/src/api/backendTransport.js`, adds a read-only backend health helper.
- V5 `backend/server.mjs`, its package files and static pilot UI are preserved unchanged.
- The new `ldrs_v6` database schema is **not** applied automatically. Nothing migrates existing localStorage data and nothing alters V5's `public` tables.

**This is a preparation/infrastructure milestone, not authentication completion.**
