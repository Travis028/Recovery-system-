# LDRS — Lost Documents Recovery System

A locally runnable **React + Vite + Node/Express** demonstration, visually based on the uploaded LDRS blue/white sidebar layout and functionally based on the supplied cybersecurity requirements.

## Run

1. Install Node.js 20+ and npm.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`, **change all passwords and secret**, and save it. Node.js loads this file automatically using `--env-file`.
5. Run `npm run dev` and visit **http://localhost:5173**.
6. Sign in as admin with phone `0700000001` and the configured `LDRS_DEMO_ADMIN_PASSWORD`; officer uses `0700000002` and `LDRS_DEMO_OFFICER_PASSWORD`.
7. Owner/Finder accounts are created through Register. Owner must use the explicitly labelled **Simulate phone verification** action (requires `LDRS_DEMO_MODE=true`).
8. Optional: as admin select **Load fictional sample documents**.

`npm run build` creates the static frontend. `npm start` serves the API and built frontend on port 3001.

## What works locally

- Registration and password-hashed authentication, signed sessions, server-side roles, officer station isolation, idle logout.
- Found document registration with JPG/PNG magic-byte check and SHA-256 image fingerprint (images are intentionally **not stored**).
- Masked owner search, search/report rate limits, consent checkbox, automatic exact-number matching and officer review.
- In-app alerts, pickup point approvals, OTP demonstration with 5-minute expiry and 3-attempt lockout, single handover and printable receipts.
- Role-specific dashboards, aggregate statistics, hash-linked read-only audit API.

## Important limits — not production-ready

**Never upload real identity documents or real personal data to this demo.** Data is stored in `server/data/store.json` and is **not encrypted at rest**. This demo does **not** implement real phone verification, real SMS gateway, OCR/Tesseract/OpenCV, image malware scanning, photo EXIF stripping, encrypted photo storage, QR-signed receipts, officer two-factor authentication, account recovery, backups, PostgreSQL/MongoDB, or independent append-only audit storage. There is no public role assignment for privileged users: privileged accounts are provisioned from environment variables only. Deployment requires TLS/HTTPS, secure database, proper session handling, account lockout and MFA, data retention/rights workflows, ODPC/privacy review and DPIA, penetration testing, backup/restore testing, and a real SMS provider.

## Source structure

- `src/`: runnable frontend
- `server/`: runnable API and local JSON persistence
- `pages/`, `Components/`, `hooks/`, `entities/`, `lib/`, `index.css`, `tailwind.config.js`: original supplied source/reference files retained unchanged (many rely on unavailable Base44 platform components and cannot run standalone as provided).
- `LDRS_Functionalities_and_Cybersecurity.docx`: supplied requirements document.

This is a runnable adaptation rather than a claim that the original Base44 platform dependencies were recovered.
