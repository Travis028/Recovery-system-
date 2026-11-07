# LDRS · Lost Documents Recovery System

LDRS helps people in Kenya get lost identity documents back. Finders and officers register IDs,
passports and certificates handed in at police stations or chief's offices; owners report a loss or
search the register; the system matches the two and alerts the owner; an officer releases the
document only after checking identity with a one-time collection code.

> **Prototype.** The whole system, including the part that plays the server, runs in the browser
> (see [How it is built](#how-it-is-built)). The security rules are real code and are enforced in
> the data layer, but browser storage is not a server. Use mock documents only, never real people's
> documents without their consent.

---

## Quick start

Requirements: **Node.js 18 or newer** and npm.

```bash
npm install
npm run dev          # http://localhost:5173
```

Production build:

```bash
npm run build        # writes dist/
npm run preview      # serves dist/ on http://localhost:4173
```

The first visit creates the demo data. To start again from scratch, clear the site's storage in the
browser (DevTools → Application → Clear site data).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build in `dist/`, with the Content Security Policy added to `index.html` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | ESLint over `src/` (React and hooks rules) |
| `npm test` | Unit tests with Vitest |
| `npm run check:contrast` | Checks WCAG AA contrast of the colour tokens in light and dark mode |

## Environment variables

Copy `.env.example` to `.env` and adjust. All variables are optional.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SMS_GATEWAY_URL` | empty | An endpoint on **your** server that forwards SMS to Africa's Talking. Keep the API key on that server. When empty, messages appear in the in-app *Demo SMS* phone. |
| `VITE_SHOW_DEMO_ACCOUNTS` | `true` | Set to `false` to hide the demo account shortcuts on the sign-in page. |

Vite only exposes variables that start with `VITE_`, and they end up in the browser bundle, so
never put secrets in them.

## Demo accounts

All data is invented.

| Role | Email | Password | Notes |
|---|---|---|---|
| Administrator | admin@ldrs.test | Admin@LDRS2026 | two-step sign-in |
| Officer, Kisumu Central | officer.kisumu@ldrs.test | Officer@LDRS2026 | two-step sign-in |
| Officer, Kondele | officer.kondele@ldrs.test | Officer@LDRS2026 | two-step sign-in |
| Finder | finder@ldrs.test | Finder@LDRS2026 | |
| Owner | owner@ldrs.test | Owner@LDRS2026 | phone already verified |

Sign-in codes, phone codes and collection codes arrive in the **Demo SMS** phone at the bottom left.

### A five-minute walk-through

1. **Officer (Kisumu)** → *Match review* → *Possible matches* → confirm the match for Mary Wanjiru Kamau.
2. *Confirmed* → *Start handover* → *Create six-digit code* → read it in the Demo SMS phone → enter the
   reference code, ID number `28456713`, the code and the collector's details → *Approve release* →
   print the receipt and scan its QR code.
3. **Finder** → *Register found document* → upload a JPG or PNG → try *Read name and number* →
   register. Register the same document again to see duplicate detection.
4. **Owner** → *Search found documents* (a check question appears after three searches), *Report a
   lost document*, and *This is mine* to send a claim.
5. **Admin** → *Audit trail* → *Verify chain*; *Users and roles*; *Backups and data protection*.

## Features by role

| Role | Screens |
|---|---|
| Owner | Dashboard with collection code, report a lost document, masked search, claims, alerts, pickup points, my data and privacy |
| Finder | Dashboard, register a found document (photo, OCR), my documents, pickup points, my data |
| Officer | Station dashboard, documents, match and claim review, secure handover, receipts, statistics |
| Admin | Everything above across all stations, plus users and roles, pickup point management, audit trail, backups, retention and data protection requests |

## Interface

- **Design tokens** in `src/styles/tokens.css`: neutral surfaces, one primary colour (teal), one
  accent (violet), four status colours, a type scale, spacing, radii and shadows, all CSS
  variables. Tailwind maps its colour names to them in `tailwind.config.js`, so components never
  use raw colours.
- **Light and dark mode** from the toggle in the top bar. The first visit follows the device
  setting; a choice is saved in `localStorage` under `ldrs.theme`. A small inline script in
  `index.html` applies the theme before the first paint, so a reload never flashes white. Printed
  receipts always use the light colours.
- **Layout**: sidebar from 1280 px, a drawer menu below that, a top bar with the page name, theme
  toggle and account menu, breadcrumbs on record pages.
- **Tables** sort, search and page; below 768 px rows turn into stacked cards.
- **Forms** show the reason under each field after it is left or when the form is sent, and move
  focus to the first problem. Results and failures appear as toasts or alerts.
- **Accessibility**: skip link, visible focus rings, labelled controls, `aria-sort` on tables,
  live regions for toasts and errors, reduced-motion support, and contrast checked by
  `npm run check:contrast`.

## Project structure

```
src/
  api/            The "server": data store, access rules, auth, server functions, audit log, file store
  components/
    data-table/   DataTable, pagination, row actions
    layout/       Sidebar, top bar, drawer, user menu, account notices
    ui/           Buttons, inputs, select, dialog, badge, alert, card, tabs, toasts and other primitives
    ...           Feature components (dashboards, matches, claims, owner, security, documents)
  entities/       JSON schemas, checked on every create and update
  hooks/          useLdrsUser, useResource, useFieldErrors, useIdleLogout
  lib/            Domain helpers: masking, matching, validation, OCR, images, SMS, CSV, navigation
  pages/          One file per route, loaded on demand
  styles/         Design tokens
  theme/          Theme provider and toggle
docs/             Audit, setup and deployment guide, testing checklist
scripts/          Contrast checker
deploy/           Example Nginx configuration
```

## How it is built

React 18, React Router 6, Vite 5, Tailwind CSS 3 with Radix UI primitives, lucide-react icons,
date-fns, qrcode and tesseract.js.

There is no separate backend. `src/api/` plays that part inside the browser:

| Piece | What it does |
|---|---|
| `client.js` | `api.entities.X`, `api.auth`, `api.functions.invoke()`; every call is checked against the signed-in role |
| `db.js` | Tables in `localStorage`, schema checks, transactions for multi-record changes, daily snapshots |
| `recordChecks.js` | Field rules applied on every write (the same checks the forms run) |
| `permissions.js` | Who may read or change each record, and which fields are masked |
| `functions.js`, `reviewFunctions.js` | Operations that must not be trusted to the screen: search, matching, claims, handover, exports, backups |
| `auditStore.js` | Append-only audit log; each entry carries the SHA-256 of the one before it |
| `fileStore.js` | Photographs encrypted with AES-256-GCM in IndexedDB |

Passwords are hashed with PBKDF2-SHA256 (310 000 iterations), officers and admins use a two-step
code, accounts lock after five failures, sessions sign out after 15 idle minutes, and the
production build ships a strict Content Security Policy.

### Moving to production

| Prototype | Production |
|---|---|
| Data in `localStorage`, audit log under a separate key | PostgreSQL for records; the audit log on a separate append-only store |
| Access rules in the browser (`src/api/permissions.js`) | The same rules in an API server for every request |
| PBKDF2 in the browser | bcrypt or Argon2 on the server, HTTPS everywhere |
| Photographs in IndexedDB | Object storage outside the web root, keys in a KMS, malware scanning |
| OCR with tesseract.js in the browser | An internal OCR service not reachable from the internet |
| Demo SMS phone | Africa's Talking through `VITE_SMS_GATEWAY_URL` and your server |
| Arithmetic check question | Cloudflare Turnstile or hCaptcha verified on the server |

`docs/SETUP.md` covers installation and deployment in more detail, and `docs/TESTING.md` is the
checklist for testing a release in both themes.
