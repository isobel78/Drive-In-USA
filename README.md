# Drive-In USA

A web app that catalogs drive-in theaters across the United States. Visitors can browse an interactive map, search by theater name, sort by distance, name, or state, and get driving directions. A password-protected admin page lets the site owner add, edit, and delete theater records.

Live site: https://driveinusa.atlantadaniel.com/

---

## Features

- Interactive dark-themed map (Leaflet) with one marker per theater
- Search by name; sort by **Nearest**, **A-Z**, or **By State**
- "Nearest" uses the browser's Geolocation API and an optional distance filter (calculated in the browser with the haversine formula)
- Theater details with a Google Maps directions link and the theater's website
- Admin page (`/admin`) for adding, editing, and deleting theaters
- Install instructions page (`/install`) for adding the site to a phone's home screen
- Installable as a web app through a manifest. There is no service worker, so there is no offline support.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7 |
| Map | Leaflet, react-leaflet |
| UI extras | `motion` (animation), `lucide-react` (icons) |
| Backend | PHP 8+ (no framework), MySQL through PDO |
| Auth | Session cookie, email plus bcrypt password, one admin account |
| Hosting | Apache on shared hosting (static build plus PHP) |

### External services used at runtime

- CARTO dark map tiles, with OpenStreetMap data. CARTO requires a free API key for these tiles (see Setup, step 3). Without one, the map shows an "API key required" watermark.
- Google Fonts (Bangers, Righteous, Inter)
- Google Maps, only as a directions link

The state-border outlines on the map are not fetched from an outside service. They are served from this project as `/data/us-states.json` (see Project structure).

---

## Project structure

```
index.html              Vite entry point
.env.example            Template for .env.local (holds the CARTO map key)
src/
  main.tsx              React entry point
  App.tsx               Routes: /, /admin, /install
  components/           Map, theater card, theater modal, add/edit form
  pages/                Home, Admin, Install
  services/
    theaterService.ts   All calls to the /api endpoints
  lib/utils.ts          Distance calculation and helpers
  types.ts              Shared TypeScript types
api/
  theaters.php          GET (public), POST/PUT/DELETE (admin only)
  auth.php              Login, logout, session check, login throttling
  config_template.php   Copy to config.php and fill in
  db_template.php       Copy to db.php and fill in
public/
  manifest.json         Web app manifest
  icons/                App icons and favicon
  data/
    us-states.json      State border outlines drawn on the map (MIT-licensed, from the folium project)
    us-states.NOTICE.txt  Copyright and license notice for that file; keep it with the data
schema.sql              MySQL tables (theaters, login_attempts)
import_theaters.sql     Loads the 288 theater records
```

`api/config.php` and `api/db.php` hold credentials and are never committed. Make sure both are listed in `.gitignore`.

---

## Local development

### Prerequisites

- Node.js 20.19+ (or 22.12+)
- XAMPP (Apache + MySQL), or any PHP 8+ and MySQL setup

### Setup

**1. Place the files where Apache can serve them**

Copy the project into your XAMPP `htdocs` folder at:

```
htdocs/Sites/Drive-In-USA
```

The Vite dev server proxies `/api` to that location (see `server.proxy.target` in `vite.config.ts`). Change either the folder or the config if yours differs.

**2. Create the credential files**

```bash
cp api/db_template.php api/db.php
cp api/config_template.php api/config.php
```

- In `api/db.php`, enter your MySQL credentials. XAMPP defaults are usually `root` with no password.
- In `api/config.php`, set `ADMIN_EMAIL`, then generate a password hash and paste it in as `ADMIN_PASSWORD_HASH`:

```bash
php -r "echo password_hash('your_password_here', PASSWORD_BCRYPT);"
```

**3. Add a map key**

CARTO's map tiles need a free API key. Request one at https://carto.com/basemaps/apikey/ (non-commercial use is free up to 5 million tile requests a month, commercial use up to 1 million, as of October 2026). Then copy `.env.example` to `.env.local` and paste the key in:

```
VITE_CARTO_API_KEY=your_key_here
```

`.env.local` is ignored by git. The key is built into the site's JavaScript, so anyone viewing the site can read it. Treat it as a public identifier, not a secret, and restrict it in the CARTO dashboard if the dashboard offers that. Rebuild after changing it, because Vite reads it at build time.

**4. Create the database**

In phpMyAdmin, create a database named `driveinusa`. The schema needs MariaDB 10.2+ or MySQL 8.0.13+, because it puts a default value on `TEXT` columns. The production host runs MariaDB 10.11. Then import these files in order:

1. `schema.sql` creates the `theaters` and `login_attempts` tables.
2. `import_theaters.sql` loads the 288 theater records. Run it once, on an empty `theaters` table. Its `TRUNCATE TABLE theaters` line is commented out, so importing a second time adds all 288 rows again as duplicates. To reload from scratch, uncomment that line first, knowing it deletes every theater, including any added through the admin page.

**5. Run it**

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

### Other commands

```bash
npm run lint     # TypeScript type-check
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

---

## API

| Endpoint | Method | Access | Purpose |
|---|---|---|---|
| `/api/theaters.php` | GET | Public | List all theaters, ordered by name |
| `/api/theaters.php` | POST | Admin | Create a theater |
| `/api/theaters.php?id=N` | PUT | Admin | Update fields on a theater |
| `/api/theaters.php?id=N` | DELETE | Admin | Delete a theater |
| `/api/auth.php` | GET | Public | Is the current session logged in? |
| `/api/auth.php` | POST | Public | `{"action": "login" or "logout", ...}` |

Responses are JSON. Errors look like `{"error": "message"}`.

---

## Security notes

- All database queries use prepared statements, and the public GET returns an explicit list of columns rather than `SELECT *`.
- Sessions use `HttpOnly` and `SameSite=Strict` cookies, and the session ID is regenerated at login.
- **Login throttling:** after 5 failed logins from one IP address in 15 minutes, further attempts from that address get a `429` response until the window passes. Failures are stored in the `login_attempts` table. IPv6 addresses are grouped by /64 network. If the throttle check fails, for example because the database is down, login is refused.
- **Input validation:** the API checks that coordinates are numeric and in range, that text fields fit their column sizes, that required fields are not blank, and that website addresses start with `http://` or `https://`.
- **Error handling:** the API returns generic error messages to the browser and writes details to the PHP error log. Make sure that log is not reachable from the web (see Deployment).
- CORS in `api/config.php` allows only localhost development origins. In production, requests are same-origin.

---

## Deployment (shared hosting)

The site is built on a development machine, and the result is uploaded.

1. Make sure `.env.local` contains your CARTO key, then run `npm ci` and `npm run build`. A build without the key still works, but the map shows a watermark.
2. Upload the **contents** of `dist/` to the site's web folder. Replace the old `assets/` folder, because file names change on every build.
3. Upload the `api/` folder. Create `api/config.php` and `api/db.php` on the server from the templates. Never overwrite them with local copies.
4. Do not delete the web folder before uploading. It holds files that are not in this repository: the real `api/config.php`, `api/db.php`, and the server's `.htaccess` files.

Server configuration that lives outside the repository:

- **Route fallback:** requests that are not real files must fall back to `index.html`, or `/admin` and `/install` fail on a page refresh. This is configured on the server and is not in the repository.
- **Blocked files:** `api/.htaccess` is part of this repository and denies web requests for `db.php`, `config.php`, and the PHP `error_log` file. Make sure it is uploaded with `api/`, and after deploying, confirm that `/api/error_log` returns 403. Better still, point PHP's `error_log` at a folder above the web root.
- Database changes (new tables or columns) are made in phpMyAdmin before the PHP that depends on them is uploaded.

---

## Known limitations

- The border file covers the 50 states only, so the District of Columbia and US territories have no outline.
- All content is rendered in the browser, so there is no per-theater page that search engines can index.