# Changelog

## 1.0.0

The first release after the upgrade of the version 3.1 prototype. Every feature of 3.1 is kept;
`docs/AUDIT.md` lists what was wrong before.

### Interface

- Design system in CSS variables: colour, type, spacing, radius and shadow tokens, with one
  primary colour, one accent and four status colours.
- Light and dark mode with a toggle, saved choice, device default and no flash on reload.
- New layout: grouped sidebar, drawer menu on tablets and phones, top bar with account menu,
  breadcrumbs, skip link.
- Sortable, searchable, paginated tables that stack into cards on phones.
- Every form validates field by field, explains each problem and confirms success with a toast.
- Error pages for 403, 404 and 500, and error states with retry on every screen.

### Fixes and hardening

- Match decisions, claims and handovers run as single server transactions.
- Approving a claim no longer creates a duplicate loss report.
- Internal server functions can no longer be called from the screen; reminders are built on
  the server.
- The data layer validates pickup points, claims, requests, settings and account names.
- CSV exports are protected against spreadsheet formula injection.
- Expired sessions return to sign-in, and sign-in returns to the page that was asked for.
- Routes are guarded by the same role list the menu uses.

### Performance

- Pages load on demand and libraries are cached separately; the entry bundle is 145 kB instead of 617 kB.
- The signed-in user is fetched once per visit instead of once per component.
- The font is self-hosted.

### Project

- Source under `src/`, ESLint, 21 unit tests, a contrast checker, README, setup guide and
  testing checklist.
