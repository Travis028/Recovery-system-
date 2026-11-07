# Testing checklist

Work through this list against a production build (`npm run build && npm run preview`, then open
http://localhost:4173). Clear the site data first so the demo records are fresh. Do the
**Theme** section once, then repeat sections 2 to 7 once in light mode and once in dark mode.

Automated checks that should already pass: `npm run lint`, `npm test`, `npm run check:contrast`.

## 1. Theme

- [ ] On a first visit the app follows the device setting (switch the OS or browser between light
      and dark and reload).
- [ ] The toggle in the top bar (and on the sign-in page) switches instantly, with no reload.
- [ ] After choosing a theme, reload: the page comes back in the chosen theme with no white flash.
- [ ] After choosing a theme, changing the device setting no longer changes the app.
- [ ] In dark mode, print a handover receipt (or use print preview): it prints black on white.

## 2. Sign-in and access

- [ ] Sign in with nothing filled in: each field says what is missing.
- [ ] Sign in as the Kisumu officer: a code arrives in the Demo SMS phone; a wrong code says how
      many attempts are left; the right code opens the station dashboard.
- [ ] Five wrong passwords lock the account; the admin can unlock it under *Users and roles*.
- [ ] *Create an account*: leave the form empty and send, check every field shows its reason,
      then create an owner account.
- [ ] *Forgot password?*: the reset code arrives by SMS and the new password works.
- [ ] Signed in as the owner, open `/audit`: the *Error 403* page appears.
- [ ] Open `/no-such-page`: the *Error 404* page appears inside the layout.
- [ ] Signed out, open `/handover`, then sign in as the officer: you land on *Handover*, not the dashboard.
- [ ] The account menu (top right) shows the name, email and role; *Sign out* returns to sign-in.

## 3. Owner

- [ ] Dashboard: the stat cards, lost reports and latest alerts are readable.
- [ ] *Report a lost document*: empty send shows errors; a date in the future is refused; a valid
      report shows the success panel.
- [ ] *Search found documents*: results are partly hidden; after three searches the check question
      appears and a correct answer continues the search.
- [ ] *This is mine*: an invalid phone number is refused; a valid claim shows *Claim sent*.
- [ ] *Alerts* lists alerts with their channel and the status of each report.
- [ ] *My data and privacy*: download a copy, change the SMS language, send a removal request.

## 4. Finder

- [ ] *Register found document*: empty send shows errors for the type, photograph, name, number,
      place and pickup point.
- [ ] Upload a JPG or PNG under 5 MB; a PDF or a renamed file is refused with a clear message.
- [ ] *Read name and number* fills the fields (needs internet the first time); uncertain fields
      must be ticked as checked.
- [ ] Registering the same number twice flags it as a possible duplicate.

## 5. Officer

- [ ] *Match review*: the tabs show counts; confirming a match shows a toast and moves it to *Confirmed*.
- [ ] *Remind owner* sends an alert; *Reject* frees the document.
- [ ] *Ownership claims*: approving gives the owner a reference code; rejecting sends an alert.
- [ ] *Secure handover*: *Approve release* with nothing filled lists every failed check; a wrong
      collection code counts down the attempts; the correct details open the receipt.
- [ ] The receipt shows a QR code; opening its link shows *Genuine LDRS handover receipt*.
- [ ] Opening a document held at another station (sign in as the Kondele officer) says it was not found.

## 6. Administrator

- [ ] Dashboard: security alerts and the *Waiting for you* list link to the right pages.
- [ ] *Users and roles*: search, filter chips with counts, assign a station, approve an officer,
      disable and enable an account (the row menu holds the less common actions).
- [ ] *Pickup points*: add a point with a bad phone number (refused), then a valid one; verify,
      deactivate and edit it.
- [ ] *Audit trail*: sort, search, filter by action, page through; *Verify chain* reports intact;
      *Export view* downloads a CSV that opens cleanly in a spreadsheet.
- [ ] *Statistics*: the chart and *Show as table* agree; the anonymised CSV downloads.
- [ ] *Backups and data protection*: take a snapshot, download a backup, save settings (a value
      of 0 is refused), run retention, complete a data request.

## 7. Screens and keyboard

Check at about 390 px (phone), 768 px (tablet), 1024 px and 1440 px (desktop):

- [ ] Below 1280 px the sidebar becomes a drawer behind the menu button; it closes with Escape,
      on outside click and after choosing a page.
- [ ] No page scrolls sideways; below 768 px tables show as stacked cards.
- [ ] The Demo SMS button never covers a form button.
- [ ] With the keyboard only: *Tab* from the top shows *Skip to main content*; every button, link,
      field, menu and tab shows a visible focus ring; dialogs keep focus inside and close with Escape.
- [ ] With *reduce motion* turned on in the OS, dialogs and toasts appear without animation.
- [ ] In both themes, text in tables, badges, alerts, toasts, dropdowns, dialogs and charts is
      easy to read.
- [ ] The browser console shows no errors while working through this list.
