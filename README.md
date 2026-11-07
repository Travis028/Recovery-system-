# LDRS · Lost Documents Recovery System (Project 65)

A working web app built from the LDRS project folder and the guide *"LDRS – Functionalities,
Cybersecurity and What to Add"*. The original folder layout is kept (`Components/`, `entities/`,
`hooks/`, `lib/`, `pages/`, `index.css`, `tailwind.config.js`); the `.txt` exports were converted to
runnable `.jsx` / `.json` files, and the pieces the export referenced but did not include were added.

> **Prototype.** Everything runs in the browser. The security rules are real code and are enforced
> in the data layer, but browser storage is not a server. See **Moving to production** before any
> real use. Use mock documents only — never real people's documents without their consent.

---

## 1. Run it

Requirements: Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
# or
npm run build && npm run preview   # production build on http://localhost:4173
```

### Demo accounts (mock data)

| Role | Email | Password | Notes |
|---|---|---|---|
| Administrator | admin@ldrs.test | Admin@LDRS2026 | two-step login |
| Officer – Kisumu Central | officer.kisumu@ldrs.test | Officer@LDRS2026 | two-step login |
| Officer – Kondele | officer.kondele@ldrs.test | Officer@LDRS2026 | two-step login |
| Finder | finder@ldrs.test | Finder@LDRS2026 | |
| Owner | owner@ldrs.test | Owner@LDRS2026 | phone already verified |

SMS messages (login codes, phone checks, collection codes, alerts) appear in the **Demo SMS** phone
at the bottom right. To start again from scratch, clear the site's storage in the browser.

### Suggested walk-through

1. Sign in as the **Kisumu officer** → *Match review* → confirm the pending match for Mary Wanjiru Kamau.
2. *Start handover* → generate the code → read it from the Demo SMS phone → enter the reference code,
   ID number `28456713`, claimant details → approve → printable receipt with QR code.
3. Sign in as the **finder** → *Register found document* → upload a JPG/PNG → try OCR → register.
   Register the same document again to see duplicate detection.
4. Sign in as the **owner** → *Search* (CAPTCHA appears after 3 searches) and *Report a lost document*.
5. Sign in as the **admin** → *Audit trail* → *Verify chain*; *Users*; *Backups and data protection*.

---

## 2. Folder layout

| Folder / file | Contents |
|---|---|
| `api/` | **New.** Local stand-in for the Base44 SDK the code was written for: data store, access rules, auth, encrypted file store, audit store, server functions, demo seed data |
| `Components/` | Original components (`AppLayout`, `StatusBadge`, `claims/`, `owner/`, `documents/`, `dashboards/`) plus the missing ones (`ui/`, `matches/`, `security/`, Loader, PageHeader, EmptyState, StatCard, RoleGuard, PrivateImage, DocumentRow, other dashboards) |
| `entities/` | Entity schemas as JSON (validated on every create/update). Added: Match, Notification, PickupPoint, User, DataRequest, Setting |
| `hooks/` | `useLdrsUser` (now shared across screens), `useIdleLogout` (15-minute auto logout) |
| `lib/` | Original `ldrs`, `matching`, `claims`, `notifications`, `sms`, `audit` + new `image`, `ocr`, `validation`, `nav`, `utils` |
| `pages/` | Original 5 pages + Login, Dashboard, ReportFound, DocumentDetail, ReportLost, SearchDocuments, HandoverList, PickupPoints, Statistics, AuditTrail, Users, SystemSettings, MyData, VerifyReceipt, NotFound |
| `deploy/nginx.conf` | Example HTTPS server with security headers |
| `public/_redirects` | SPA routing for Netlify-style hosts |

---

## 3. The twelve functions and their security (as built)

| # | Function | What was implemented | Where |
|---|---|---|---|
| 1 | Found-document upload | JPG/PNG only, checked by file signature (not the name); 5 MB limit; photo redrawn to strip hidden data (GPS, phone model); stored AES-256-GCM encrypted with a non-extractable key; shown only to the uploader, the holding station and admins | `lib/image.js`, `api/fileStore.js`, `Components/documents/PhotoUpload.jsx`, `pages/ReportFound.jsx` |
| 2 | OCR extraction | Tesseract (tesseract.js) after grey-scale/contrast clean-up; number format checks per type (e.g. 7–8 digits for an ID); low-confidence fields highlighted and must be confirmed; temporary image discarded | `lib/ocr.js`, `lib/validation.js` |
| 3 | Owner search | Login + verified phone required; masked results; limit per user per hour; CAPTCHA after a few searches; every search logged | `api/functions.js` → `searchFoundDocuments`, `pages/SearchDocuments.jsx` |
| 4 | Automatic matching | Phone verified by SMS code before a loss report is accepted; limit of open reports per phone; exact number → confirmed; similar name → officer review; owners never see pending matches | `submitLossReport`, `lib/matching.js` |
| 5 | SMS notification | One sender name (`LDRS-KE`); masked number only, never the full name/ID; warning not to share codes; 3 retries with recorded delivery status; English or Kiswahili per owner | `lib/sms.js`, `lib/notifications.js`, `notifyOwner` |
| 6 | Pickup point management | Admin-only add/edit; new points unverified until confirmed with the station; every change logged; hours and contact shown; fake-point warning for the public | `pages/PickupPoints.jsx` |
| 7 | Identity verification at handover | 6-digit code, expires in 5 minutes, 3 attempts then locked; the officer never sees the code; officer confirms the physical ID; claimant ID type recorded | `generateCollectionCode`, `completeHandover`, `pages/SecureHandover.jsx` |
| 8 | Handover record | Single atomic step so a document cannot be released twice; record read-only after saving; receipt with QR code that opens a public verification page; automatic daily backup | `completeHandover`, `pages/HandoverReceipt.jsx`, `pages/VerifyReceipt.jsx`, `api/db.js` |
| 9 | Duplicate detection | Same type + number; identical photo (SHA-256); near-identical photo (perceptual hash); finder uploading many documents in an hour; officer sees the reasons | `registerFoundDocument`, `pages/DocumentDetail.jsx` |
| 10 | Station dashboard | Officers see only their own station (enforced in the data layer); auto logout after 15 minutes; numbers hidden in lists until a record is opened (opening is logged); two-step login for officers | `api/permissions.js`, `Components/dashboards/OfficerDashboard.jsx` |
| 11 | Statistics | Totals only; officers see their station, admins all; anonymised CSV export, admin-only and logged | `statistics`, `exportAnonymised`, `pages/Statistics.jsx` |
| 12 | Audit trail | Append-only, kept in separate storage; each entry linked to the previous by SHA-256 so tampering is detected; security alerts (failed logins, locked accounts, wrong codes, rate limits, rapid uploads); retention period | `api/auditStore.js`, `pages/AuditTrail.jsx` |
| + | Login and roles | PBKDF2-SHA256 hashed passwords (310 000 iterations); password rules; two-step login for officers/admins; lock after 5 failures; forgot-password by SMS code; officers need admin approval; role checked on every request | `api/base44Client.js`, `api/permissions.js`, `pages/Login.jsx`, `pages/Users.jsx` |

### Kenya Data Protection Act, 2019

Consent boxes on registration and loss reports; minimum data collected; owner page to view,
download, correct or request removal of their data (admin handles requests); configurable retention
for unclaimed documents and audit logs with a retention job; checklist (ODPC registration, 72-hour
breach reporting, DPIA) on the admin *Backups and data protection* page.

### Changes to the original code worth knowing

- **Handover:** the original showed the collection code to the officer and checked it in the browser,
  which defeats the check. The code is now visible only to the owner, verified server-side against a
  hash, and limited to 3 attempts (was 5) as the guide requires.
- **Lists:** document numbers are now hidden in lists for every role, not only owners.
- **Owner claims:** the claim dialog no longer downloads every held document; it uses the masked,
  rate-limited search.
- **Loss reports and found documents** are submitted through server functions so the checks cannot
  be skipped from the screen.

---

## 4. What is simulated, and moving to production

| Prototype | Production (per the LDRS design) |
|---|---|
| Data in browser `localStorage`; audit trail in a separate key | PostgreSQL + MongoDB on a secured server; audit log on a separate server, append-only |
| Access rules run in the browser (`api/permissions.js`) | Same rules in the API server for every request |
| PBKDF2 password hashing in the browser | bcrypt or Argon2 on the server; HTTPS everywhere |
| Images encrypted in IndexedDB | Object storage outside the web folder, key in a KMS, malware scan (e.g. ClamAV) |
| OCR with tesseract.js in the browser (downloads once; falls back to typing) | Internal Python service with Tesseract + OpenCV, not reachable from the internet |
| Demo SMS phone | Africa's Talking via `VITE_SMS_GATEWAY_URL` → your server (API key stays server-side) |
| Simple arithmetic CAPTCHA | Cloudflare Turnstile / hCaptcha verified on the server |
| Daily snapshot in browser storage | Daily encrypted database backups with a tested restore |

Still to do from the guide's "Can add later" list: penetration test before rollout, more document
types' official formats, links to official registries (only with a formal agreement), and full
Kiswahili screens (SMS and alerts are already bilingual — have a native speaker review the wording).
