# Haven Realty — property platform

A web version of the JavaFX "Milan" desktop app: **React + Vite + Tailwind** frontend (`../frontend`), **Spring Boot 3** REST backend (`src/`), **MySQL** (H2 in memory for quick local runs). The Python ActionLab service in `app/` is unrelated and untouched.

## What it does

| Area | Highlights |
|---|---|
| **Accounts** | One customer account is a buyer and can later become a seller (no second account). Exactly one agent, provisioned from environment variables — there is **no agent signup**. |
| **Auth** | Multi-step signup, email + mobile one-time codes, JWT, BCrypt, login/reset rate limiting, forgot/reset password, suspended accounts blocked everywhere. |
| **Seller verification** | ID, address proof, photo, consent → agent reviews (approve / reject with reason / request resubmission) → only then can the customer list. Full history kept. |
| **Listings** | Draft → Submitted → Under review → Published (or Rejected) → Inactive / Suspended / Sold. Only Published listings are public. |
| **Buyer** | Search, filters, sorting, pagination, detail pages, wishlist, recently viewed, recommendations, compare, enquiries, site-visit requests, enquiry tracking, notifications. |
| **Agent console** | Dashboard (Recharts), customers, seller verification, property approval, enquiry pipeline, site visits, offers, sales (the old "Deals"), rentals, Excel and PDF export, audit log. |
| **Privacy** | Buyer ↔ seller contact is impossible: public DTOs contain no owner data, buyer and seller each have a separate agent-only message channel, internal agent notes are hidden from buyers. Enforced in the API and covered by tests. |

### Old desktop logic that was kept
Customer type Seller/Customer/Both → buyer/seller flags · property fields (facing, approved-by, plot/constructed, listing status) · deal fields (final amount, down payment, commission, advance/balance received, registry date) · **completing a deal marks the property Sold** · property filters · deals-by-status and properties-by-type analytics · Excel and PDF export.
Bugs from the desktop code (8-values-into-9-columns insert, photos wiped on update, null registry date crash, unset image parameters, hardcoded login/DB password) are not carried over.

## Run it

Requirements: JDK 17+, Maven 3.9+, Node 20+.

```powershell
# 1) backend  (http://localhost:8080)  — demo data + visible one-time codes
$env:SEED_DEMO = "true"
mvn spring-boot:run

# 2) frontend (http://localhost:5173)  — /api is proxied to the backend
cd ..\frontend
npm install
npm run dev
```

Demo logins (only with `SEED_DEMO=true`): buyer `priya@haven.test`, seller `meera@haven.test` (both `Demo@12345`), agent `agent@haven.test` / `Agent@12345` (use the **Agent** tab on the login page).
Demo photos are generated placeholders, not real properties.

### Using MySQL
```powershell
$env:SPRING_PROFILES_ACTIVE = "mysql"
$env:DB_USERNAME = "root"; $env:DB_PASSWORD = "your-password"
```
This uses a **new** database `haven_realty` (created by Flyway), so it never touches the old desktop database. To bring old desktop data across, see `docs/import_from_desktop.sql` (read the assumptions at the top first).

### Configuration (environment variables)
| Variable | Purpose |
|---|---|
| `AGENT_EMAIL`, `AGENT_PASSWORD` | Creates the single agent at startup if none exists (required for a real deployment) |
| `JWT_SECRET` | **Set a long random value outside local development** |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | Database |
| `STORAGE_DIR` | Private upload folder (default `./storage`, never web-served) |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` | Real email. Without `MAIL_HOST`, emails are only logged |
| `DEV_EXPOSE_OTP` | `true` returns one-time codes in API responses (demo only — set `false` for real use) |
| `CORS_ORIGINS`, `PUBLIC_URL` | Allowed browser origins / site URL |
| `SEED_DEMO` | `true` loads the demo data once |

SMS is a log stub (no gateway): the mobile code is printed in the backend log and, in demo mode, shown on screen.

## Tests
```powershell
mvn test        # 8 tests: auth/portal separation, seller verification, listing workflow, privacy, IDOR, deals -> sold, suspension
```

## Layout
```
backend/src/main/java/com/example/properity_project/
  config/      security, JWT filter, rate limiter, agent bootstrap, demo seeder
  controller/  Auth, Account, Me (buyer), Seller, Agent, Property (public), File
  service/     business rules (PropertyService, EnquiryService, SellerVerificationService, RecordsService, ...)
  entity/ repository/ dto/ exception/ util/
backend/src/main/resources/db/migration/V1__core_schema.sql   Flyway schema (20 tables)
frontend/src/  pages/{customer,seller,agent}, components/, api.js, auth.jsx
```

## Notes for your evaluation
- **Why JWT + role checks twice:** URL rules in `SecurityConfig` are the first gate; every service method re-checks ownership. A customer typing `/agent` is bounced by the UI, but the API itself returns 403 either way.
- **Why `users` has `buyer_enabled`/`seller_enabled`:** one identity, two capabilities. `seller_enabled` is switched on only by the agent's approval, never by uploading documents.
- **Documents** are stored under random names outside any public folder and streamed only to their owner or the agent; each open is audit-logged. No ID numbers are collected, so there is nothing to mask.
- **Known limits:** rate limiting and notifications polling are in-memory / per-instance; SMS is a stub; the MySQL migration was written to be portable and verified on H2 (MySQL mode) — run it once on your MySQL to confirm.



## Deploy

**Option A - single jar (any server with Java 17+ and MySQL 8)**
```powershell
.uild-release.ps1                      # -> backend	arget\haven-realty.jar (API + web app together)
$env:SPRING_PROFILES_ACTIVE="mysql"; $env:DB_PASSWORD="..."; $env:JWT_SECRET="<48+ random chars>"
$env:AGENT_EMAIL="you@domain.com"; $env:AGENT_PASSWORD="<strong>"; $env:DEV_EXPOSE_OTP="false"
java -jar backend	arget\haven-realty.jar   # http://localhost:8080
```
**Option B - Docker:** copy `.env.example` to `.env`, fill it in, then `docker compose up -d --build` (app + MySQL + persistent uploads).

Put it behind HTTPS (e.g. Caddy/nginx or your host's TLS) and set `PUBLIC_URL`/`CORS_ORIGINS` to your domain. Back up the MySQL database and the uploads folder (`STORAGE_DIR`). Never deploy with `SEED_DEMO=true`.
The single-jar run was verified locally in production mode (no demo data, codes hidden, agent from env vars, SPA routes served, API still locked). The Docker files and MySQL path are written but were not run here (no Docker/MySQL installed).
