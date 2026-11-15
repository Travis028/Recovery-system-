# LDRS v6 backend API

Base: `http://127.0.0.1:4001/api/v6` (the browser uses `http://127.0.0.1:5175/api/v6` through the Vite proxy).
Session: HttpOnly, SameSite=Strict cookie `ldrs_session`, 8 hours, stored hashed in `ldrs_v6.sessions`.
POST/PATCH from a browser must come from an origin listed in `APP_ORIGINS` (`backend/.env`).

## Public (no login)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{status, version:"v6", database:"postgresql", schema:"ldrs_v6", registered_users}` |
| GET | `/pickup-points` | Active, verified pickup points |
| POST | `/auth/register` | Owner, Finder, or Officer application (always unapproved). Admin cannot be self-registered |
| POST | `/auth/login` | Owner/Finder: session. Approved Officer/Admin: `{status:"two_step", challenge_id}`; code printed in backend terminal |
| POST | `/auth/verify-two-step` | `{challenge_id, code}` — 5 minutes, 3 attempts |
| POST | `/auth/request-reset` | Same answer whether or not the email exists; code printed in backend terminal |
| POST | `/auth/reset-password` | `{challenge_id, code, password}` — revokes all sessions |
| POST | `/auth/logout` | Revokes the session |
| GET | `/public/receipts/:handoverId?h=<16 hex>` | Receipt QR check. Returns only `valid`, receipt number, document type, date, pickup point |

## Signed in

| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/auth/me` | Own profile (PATCH: `full_name`, `language`) |
| GET | `/auth/session-check` | Role and approval |
| GET | `/officer/context` | Approved officer + station |
| GET | `/admin/officers` | Admin: officer applications |
| POST | `/admin/officers/:id/approve` | Admin: `{approved: true|false}` |
| POST | `/uploads` | Finder/Officer/Admin: raw JPEG/PNG body (≤5 MB), stored AES-256-GCM encrypted → `{file_uri}` |
| GET | `/uploads/:id` | Decrypted photo for uploader, station officer or admin. Owners never get photos |
| POST | `/entities/:Entity/filter` | `{query, options:{sort, limit, skip}}` → `{items, total}` |
| POST | `/entities/:Entity/count` | `{query}` → `{total}` |
| GET | `/entities/:Entity[/:id]` | List / one record |
| POST | `/entities/:Entity` | Create: Claim, DataRequest, PickupPoint (admin), Notification (admin), AuditLog (client event) |
| PATCH | `/entities/:Entity/:id` | Allow-listed fields only; match/claim decisions must use the workflows below |
| POST | `/functions/invoke` | `{name, args}` — workflows below |

Settings (`/entities/Setting`): `search_limit_per_hour` (1–100, default 10), `unclaimed_after_days` (1–3650, 30), `document_retention_days` (7–3650, 180), `audit_retention_days` (30–3650, 365). Missing settings are added with their defaults when the backend starts; saved values are never overwritten.

Entities: Document, LossReport, Match, Claim, Notification, Handover, PickupPoint, User, DataRequest, Setting, AuditLog, OtpCode.
Every query is scoped on the server by role (owners: own records, masked documents; officers: their station only; admins: all).

## Workflows (`/functions/invoke`)

| Name | Who | Status |
|---|---|---|
| `listPublicPickupPoints` | anyone signed in | ✅ |
| `sendPhoneCode`, `verifyPhoneCode` | signed in | ✅ 3 codes / 15 min |
| `submitLossReport`, `closeLossReport` | Owner (verified phone) | ✅ creates pending match candidates; optional `county`, `sub_county`, `ward`, `landmark` (must be consistent) |
| `registerFoundDocument` | Finder, Officer, Admin | ✅ requires uploaded photo and `county`, `sub_county`, `ward`, `landmark` (checked against `shared/kenya-admin-units.json`); `found_location` is built from them; duplicate check |
| `searchStatus`, `searchFoundDocuments` | Owner (verified phone), Admin | ✅ masked results, 10 / hour |
| `submitClaim` | Owner | ✅ |
| `confirmMatch`, `rejectMatch`, `sendCollectionReminder` | Approved Officer (own station), Admin | ✅ |
| `approveClaim`, `rejectClaim` | Approved Officer (own station), Admin | ✅ |
| `getCollectionCodeStatus`, `generateCollectionCode`, `completeHandover` | Approved Officer (own station), Admin | ✅ code printed in backend terminal (`LDRS_DEMO_OTP=1`) |
| `verifyReceipt` | public | ✅ (maps to `/public/receipts/...`) |
| `statistics` | Approved Officer (own station), Admin (all) | ✅ fixed in v5 cleanup — full screen shape |
| `securityAlerts` | Admin | ✅ |
| `completeDataRequest` | Admin | ✅ new in v6 — Removal anonymises the owner's reports and pending claims |
| `verifyAuditChain` | Admin | ✅ new in v6 — SHA-256 hash chain; older unfingerprinted entries reported as "before chain" |
| `exportAnonymised` | Admin | ✅ new in v6 — CSV with hashed record IDs, no names or numbers; logged |
| `exportMyData` | Owner, Finder | ✅ new in v6 — own account and records as JSON (no password data); logged |
| `runRetention` | Admin | ✅ new in v6 — uses the saved retention settings; disposed documents lose name/number and their photo file; old audit entries removed with the chain anchored |
| `backupNow`, `listBackups`, `downloadBackup`, `uploadBackup`, `restoreBackup`, `getCaptcha` | — | ❌ 501 — backups use `pg_dump` instead (see `database/README.md`); captcha not built |

Status codes: 401 not signed in · 403 role/station not allowed · 409 conflict (already done) · 415 wrong file type · 422 invalid input · 423 account locked · 429 rate limit · 501 not built yet.
