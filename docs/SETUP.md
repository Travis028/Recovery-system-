# Setup and deployment

## 1. Run it on your computer

1. Install **Node.js 18 or newer** (it includes npm). Check with `node -v`.
2. Get the code:

   ```bash
   git clone https://github.com/Travis028/Recovery-system-.git
   cd Recovery-system-
   ```

3. Install the packages and start the development server:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:5173 and sign in with one of the demo accounts in the README.

To reach the dev server from a phone on the same Wi-Fi, use the *Network* address Vite prints
(the server listens on all interfaces).

## 2. Configure

Copy the example file and edit it:

```bash
cp .env.example .env
```

| Variable | When to set it |
|---|---|
| `VITE_SMS_GATEWAY_URL` | When you have a server endpoint that sends SMS through Africa's Talking. The browser posts `{ to, message, from }` to it. The API key must stay on that server. |
| `VITE_SHOW_DEMO_ACCOUNTS` | Set to `false` for anything other than a demonstration. |

Restart `npm run dev` after changing `.env`; for a production build, run `npm run build` again.

## 3. Check before you deploy

```bash
npm run lint
npm test
npm run check:contrast
npm run build
npm run preview      # then work through docs/TESTING.md at http://localhost:4173
```

## 4. Deploy the static build

`npm run build` writes a static site to `dist/`. Any web server that can serve files and send
unknown paths to `index.html` will do.

### Nginx

1. Copy `dist/` to the server, for example to `/var/www/ldrs/dist`.
2. Copy `deploy/security-headers.conf` to `/etc/nginx/snippets/ldrs-security-headers.conf`.
3. Use `deploy/nginx.conf` as the site file, change the domain and certificate paths, then
   `sudo nginx -t && sudo systemctl reload nginx`.

The security headers live in a snippet because Nginx ignores server-level `add_header` lines in
any `location` that sets headers of its own.

### Netlify and similar hosts

`public/_redirects` already sends every path to `index.html`. Set the build command to
`npm run build` and the publish directory to `dist`.

### What the build already does

- Adds a Content Security Policy to `index.html`. The only inline script, the theme bootstrap, is
  allowed by its SHA-256 hash, which is computed at build time, so editing that script needs
  no manual CSP change.
- Splits each page and the large libraries into separately cached files.
- Self-hosts the Inter font, so no request goes to Google.

OCR downloads its engine and English language data from jsDelivr the first time it is used. If
that is blocked, finders simply type the details.

## 5. Data and backups

All records live in the browser that uses the app (`localStorage` and IndexedDB). A snapshot is
taken once a day and the last seven are kept; administrators can download a full backup and
restore it from *Backups and data protection*. Photographs are not part of the backup file.

Before real use, move the data layer to a server as described under *Moving to production* in
the README, and work through the checklist on the *Backups and data protection* page (ODPC
registration, retention periods, breach plan, impact assessment).
