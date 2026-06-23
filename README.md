# Drive-In USA

A web application cataloging drive-in theaters across the United States. Users can browse an interactive map, search by state or theater name, and view details on each location. The admin interface allows authorized users to add, edit, and remove theater records.

---

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Leaflet (interactive map), react-leaflet
- **Backend:** PHP 8+, MySQL (PDO)
- **Auth:** Session-based email/bcrypt login (no third-party auth)
- **PWA:** Web app manifest + service worker for installability

---

## Project Structure

```
index.html              # Vite entry point (references src/main.tsx)
src/
  main.tsx              # React entry point
  App.tsx               # Root component + routing
  components/           # Reusable UI components
  pages/                # Home, Admin, Install pages
  services/
    theaterService.ts   # All API calls (/api endpoints)
  types.ts              # Shared TypeScript types
api/
  theaters.php          # REST endpoints: GET/POST/PUT/DELETE theaters
  auth.php              # Login / logout / session check
  config_template.php   # copy to config.php and fill in credentials
  db_template.php       # copy to db.php and fill in credentials
public/
  icons/                # PWA icons and favicons
  manifest.json         # PWA manifest
schema.sql              # MySQL table definitions
```

---

## Local Development (XAMPP)

### Prerequisites
- Node.js 18+
- XAMPP (Apache + MySQL)

### Setup

**1. Place the files in XAMPP**

Copy the files into your XAMPP htdocs directory:
```
htdocs/Sites/Drive-In-USA
```
The path must match the proxy `target` in `vite.config.ts`. Adjust either the folder location or the config if yours differs.

**2. Configure credentials**

```bash
cp api/db_template.php api/db.php
cp api/config_template.php api/config.php
```

Fill in `api/db.php` with your local MySQL credentials (typically `root` / no password for XAMPP).

In `api/config.php`, set `ADMIN_EMAIL` and generate a bcrypt hash for your password:
```php
echo password_hash('your_password_here', PASSWORD_BCRYPT);
```
Paste the output as `ADMIN_PASSWORD_HASH`.

**3. Create the database**

In phpMyAdmin, create a database (e.g. `driveinusa`), then import:
- `schema.sql` — creates the tables
- `import_theaters.sql` — loads the 288 theater records (not in repo; generate from your Firestore export)

**4. Run the dev server**

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The Vite dev server proxies `/api` requests to XAMPP.

---

## Security Notes

- All database queries use PDO prepared statements.
- Sessions use `httponly` and `SameSite=Strict` cookies.
- CORS in `api/config.php` is restricted to `localhost` origins — in production requests are same-origin so no CORS header is needed.