# Proposed v6 backend contract — implement/test before using in React

The current v6 frontend API is a browser-side shim in `frontend/src/api/client.js`. The contract below is a design target, **not** a claim that the endpoints already exist.

## Authentication / users

| Endpoint | Methods | Expected semantics |
|---|---|---|
| `/api/v6/auth/me` | GET | 401 if unauthenticated; return a safe user object with `id`, `full_name`, `email`, `role`, `ldrs_role`, `approved`, `pickup_point_id`, `phone_verified`, `language`, `disabled`; never return secret hashes or codes |
| `/api/v6/auth/login` | POST | Email+password; rate-limit; issue short-lived challenge if Officer/Admin; otherwise establish secure HttpOnly cookie |
| `/api/v6/auth/verify-two-step` | POST | Confirm server-stored hash, expiry and attempt limit; then create session |
| `/api/v6/auth/logout` | POST | Revoke server session and expire cookie |
| `/api/v6/auth/register` | POST | Permit Owner/Finder registration and Officer application (always unapproved); **never** allow public Admin creation |
| `/api/v6/auth/update-me` | PATCH | Allow only non-privileged profile fields; no self-escalation |
| `/api/v6/auth/reset-request` | POST | Same response regardless of account existence; rate-limit |
| `/api/v6/auth/reset-confirm` | POST | Validate challenge and revoke other sessions |

**Important:** V5's `/api/login` and `/api/me` are **not** v6-compatible and remain untouched in this starter.

## Role-based authorizations (backend, not just React `<RoleGuard>`)

| Role | Allowed scope |
|---|---|
| Owner | Own loss reports, own claims, privacy-masked potential match data and alerts |
| Finder | Own found documents and approved pickup points; never other users' private claims |
| Officer | Only after approval and two-step auth; station-specific documents/matches/handovers |
| Admin | Server-provisioned account and two-step auth; user approval, pickup points, settings, audit and data request administration |

## Entity layer

The v6 client needs `list`, `filter`, `get`, `count`, `create`, `update`, `delete` for 12 entities, with server-side per-entity permissions. For `Document`, `LossReport`, `Match`, `Claim` and `Handover`, create/update must follow named transactional workflows, **not** unrestricted generic CRUD. Filter/sort must be parsed through an allowlist and parameterized SQL.

## Specialized workflows

- `listPublicPickupPoints`, `submitLossReport`, `registerFoundDocument`, `searchStatus`, `searchFoundDocuments`, `submitClaim`.
- `confirmMatch`, `rejectMatch`, `sendCollectionReminder`, `generateCollectionCode`, `completeHandover`, `verifyReceipt`.
- `sendPhoneCode`, `verifyPhoneCode`, `statistics`, `securityAlerts`, `verifyAuditChain`, `exportAnonymised`.
- `exportMyData`, `runRetention`, `backupNow`, `downloadBackup`, `uploadBackup`, `restoreBackup`, `listBackups`, `completeDataRequest`.

Some of these operations have important security consequences. Integrate them individually, with validation, rate limits, audit trails, and role tests.

## Private photographs / OCR

- `POST /api/v6/files` — multipart JPEG/PNG upload with file-size and content verification, server-generated opaque storage ID, scanning and restricted metadata.
- `GET /api/v6/files/:id` — authenticated, authorized streaming; prohibit public document number disclosure.
- OCR worker may remain client-side initially, but server must validate all extracted fields. Do not expose a public image URL or place raw identity document bytes in PostgreSQL columns without a deliberate encrypted-storage design.

## Suggested integration sequencing

1. Implement backend authentication and 4-role sessions; write API tests (401/403, approval, station scope, disabled, lockout, OTP).
2. Update only `auth` in the v6 API adapter **after** entity reads and permissions can operate against the same server actor; avoid mixing server auth with browser-local data as though it were persistent.
3. Implement role-scoped entity operations and photographs.
4. Implement matching, claims, handover and administration in server-side transactions.

The v6 React interface must remain unchanged except where wiring or clarification of actual backend state is necessary.
