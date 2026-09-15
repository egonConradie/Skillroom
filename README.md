# SkillRoom course studio

The public website and the private course manager run through Express. Courses are saved in `data/courses.json`. The eight original workshops have been preserved.

## Start locally

From this project folder, run:

```powershell
npm start
```

- Public website: http://localhost:3000
- Admin sign-in: http://localhost:3000/admin/login
- Course manager: http://localhost:3000/admin/dashboard

Use the admin account already configured in your local `.env`. This file is private. The old browser-only demo credentials no longer provide access. Required settings are listed in `.env.example`: ADMIN_EMAIL, ADMIN_PASSWORD_HASH (bcrypt), and SESSION_SECRET. Do not put an actual password in the source code.

If port 3000 is busy, stop the earlier SkillRoom server before starting this one. An alternative port can be set with the PORT environment variable. Open the site through Express, not by double-clicking index.html or through Live Server.

## Add and manage a course

1. Sign in and click the **+ Add course** card.
2. Upload a PNG, JPEG or WebP image (up to 4 MB), choose an existing site image, or enter an HTTPS image URL.
3. Enter the title, category, descriptions, price, date/time, venue, host and optional availability label.
4. Watch the live card preview as you type.
5. Leave **Publish on the website** off to save a private draft, or turn it on and save to publish.
6. Click any admin course card to edit it. Turn publishing off and save to unpublish it. Delete requires confirmation.

Dates are entered in South African time. Availability is a manually maintained label, not an automatic booking inventory. A new course requires a title, category and price; publishing also requires descriptions, a host, location and date/time.

The editor warns before leaving unsaved changes. If a save fails, the entered details stay on the page. Concurrent edits are detected so an older browser window cannot silently overwrite a newer save.

## How the parts fit together

- `server.js`: sessions, protected admin pages, validation, course APIs, image upload and public file allowlist.
- `course-ui.js`: shared card renderer for the public site, admin collection and editor preview; course text is escaped.
- `app.js`: public course loading, filters, details and saved cards.
- `admin-dashboard.html`, `admin-course-new.html`, `admin.js`, `admin.css`: visual course manager and editor.
- `admin-login.html`, `admin-login.js`: server-authenticated sign-in.
- `data/courses.json`: saved catalogue.
- `uploads/`: uploaded images (excluded from Git).

Back up both the catalogue and uploads. Uploaded images are retained when courses are deleted so a shared image is not accidentally removed. Existing public page structure and styling are retained.

## Verification

```powershell
npm test
```

Tests use a temporary catalogue and test credentials. They cover sign-in, protected files, cross-site request protection, validation, drafts, publishing, editing, persistence, uploads, deletion, logout and safe card rendering. They never modify your real courses.

`node tests/preview-server.js` starts an isolated visual test copy on port 3101. It is a development-only helper using fixture credentials in that file, separate from the real account. Stop it with Ctrl+C after testing.

## Local-version boundaries

This is a working local Express course manager. JSON storage supports one Node process, and login sessions use in-memory storage; a server restart signs administrators out. Before public production hosting, use a database, a persistent session store, persistent image storage, HTTPS and a reviewed deployment configuration. The production cookie requires HTTPS.

Online payments, reservations, automatic seat counts and email delivery are not implemented. Public forms give contact instructions rather than pretending to save enquiries or bookings.
