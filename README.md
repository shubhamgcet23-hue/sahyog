# Sahyog — Hyperlocal Community Resource-Sharing Platform

Sahyog connects individuals, hospitals, schools, NGOs and neighbourhoods so they can **lend, borrow, donate and share** what they already own, and ask the community for help in urgent situations.
It is a full-stack **MERN** application: React + Vite + Tailwind on the front, Express + MongoDB (Mongoose) + Socket.IO on the back.

> Sahyog is a community coordination platform, **not** an emergency-response service. In immediate danger, call 112 (India) or your local emergency number.

---

## Contents

1. [Quick start (VS Code)](#quick-start-vs-code)
2. [Features](#features)
3. [Project structure](#project-structure)
4. [Configuration](#configuration)
5. [Demo accounts & seed data](#demo-accounts--seed-data)
6. [Running tests](#running-tests)
7. [Architecture notes](#architecture-notes)
8. [Deployment (Vercel + Render + Atlas)](#deployment-vercel--render--atlas)
9. [Troubleshooting](#troubleshooting)
10. [More documentation](#more-documentation)

---

## Quick start (VS Code)

**Prerequisites:** Node.js 18.17+ (20 or 22 recommended) and either Docker *or* a MongoDB Atlas free cluster *or* nothing at all (see option C).

1. **Open the folder** — `File → Open Folder…` and choose `sahyog/`. Accept the "install recommended extensions" prompt.
2. **Install everything** (installs root, `server/` and `client/` packages):
   ```bash
   npm install
   ```
3. **Choose a database** — the project ships with a working `.env` for local development (`MONGODB_URI=mongodb://127.0.0.1:27017/sahyog`).
   - **A. Local MongoDB with Docker:** `docker compose up -d`
   - **B. MongoDB Atlas:** put your `mongodb+srv://…` string in `.env` as `MONGODB_URI`.
   - **C. Zero setup:** skip the database, run `npm run dev:memory` (step 4). It starts a throw-away in-memory MongoDB pre-loaded with demo data. The first run downloads a MongoDB binary (~100 MB, then cached).
4. **Start the app**
   ```bash
   npm run seed        # options A/B only: load demo data once
   npm run dev         # API on :5000 + web app on :5173
   # or, with option C:
   npm run dev:memory
   ```
5. Open <http://localhost:5173> and sign in with a [demo account](#demo-accounts--seed-data).

VS Code shortcuts: `Terminal → Run Task…` has **Start Sahyog**, **Seed demo data**, **Run all tests**; `Run and Debug` has **Debug API server**.

---

## Features

| Area | What is implemented |
|---|---|
| **Accounts** | Register/login/logout, bcrypt-hashed passwords, JWT in an `httpOnly` cookie (plus Bearer support), profile + password change, "sign out of all devices", optional email verification & password reset (links are logged to the console when SMTP is not configured), account suspension checks |
| **Roles** | Individual, Organization (admin-verified), Administrator — enforced by server middleware and mirrored in protected React routes |
| **Listings** | Create / edit / delete with up to 5 images (JPEG/PNG/WebP, 5 MB each), category + subcategory, condition, BORROW / DONATE / SHARE, quantity, availability dates, privacy-preserving approximate location |
| **Discovery** | Text search, category / type / condition filters, radius, sort by newest or nearest, pagination, **list ⇄ map** views (Leaflet + OpenStreetMap), browser geolocation only on request, manual location picker, `2dsphere` geospatial index |
| **Requests** | Quantity, message, intended use, pickup/delivery, return date. Server-enforced state machine: `PENDING → APPROVED → IN_PROGRESS → COMPLETED` (+ `REJECTED`, `CANCELLED`), overdue flag for borrows, atomic inventory reservation |
| **Chat & notifications** | One-to-one chat per request (REST for history, Socket.IO for live delivery), unread counts, typing indicator, reconnection handling, in-app notifications for every key event, scheduled return reminders |
| **Emergency assistance** | Requests with urgency & category, map + filters, donor/volunteer responses, accept/decline, status workflow (`OPEN → UNDER_REVIEW → MATCHED → FULFILLED → CLOSED`), admin moderation, prominent "not an emergency service" notice |
| **Trust & rewards** | Reviews only after completed exchanges (one per participant), abuse reporting, configurable trust formula, reward-point ledger (earn / reverse, no duplicates, daily cap, non-monetary), appeals against moderation decisions |
| **Dashboards** | Member dashboard, organization dashboard (verification, inventory, stats), admin overview with live counts, analytics charts and audit log |
| **Impact** | Public community-impact page: completed donations/borrows/shares, items reused, contributors, emergencies resolved, weekly/monthly/yearly charts, a **clearly labelled, configurable CO₂e estimate** |
| **Admin** | Users (search, suspend/reactivate), organization verification queue, report & appeal decisions, listing moderation, emergency oversight, category management, audit trail |
| **Security** | Helmet, restrictive CORS, rate limiting, Zod validation on every route, NoSQL-injection sanitising, CSRF header requirement for cookie auth, upload type/size limits, room-level Socket.IO authorisation, no stack traces in production, env validation on boot, graceful shutdown |

All 26 required pages exist (see `client/src/App.jsx` for the route table).

---

## Project structure

```
sahyog/
├─ package.json            root scripts (dev, seed, test, build, dev:memory)
├─ .env / .env.example     server configuration (loaded from the project root)
├─ docker-compose.yml      optional local MongoDB
├─ .vscode/                recommended extensions, tasks, debugger config
├─ docs/                   API.md, DEMO_WALKTHROUGH.md
├─ server/
│  ├─ src/
│  │  ├─ config/           env validation, db, scoring & impact formulas, categories
│  │  ├─ models/           User, Resource, ResourceRequest, Review, Notification, Conversation,
│  │  │                    Message, EmergencyRequest, RewardTransaction, Report, OrgVerification,
│  │  │                    AuditLog, Category
│  │  ├─ controllers/      thin HTTP handlers
│  │  ├─ services/         business logic (requests, inventory, rewards, trust, impact, …)
│  │  ├─ middleware/       auth, roles, validation, uploads, rate limits, errors, audit
│  │  ├─ routes/           /api/v1 route table
│  │  ├─ sockets/          Socket.IO auth + rooms
│  │  ├─ validators/       Zod schemas
│  │  ├─ utils/            state machine, geo, pagination, seed, logger, …
│  │  ├─ app.js            Express app (importable by tests)
│  │  ├─ server.js         HTTP + Socket.IO + jobs + graceful shutdown
│  │  └─ devMemory.js      zero-setup dev mode (in-memory MongoDB)
│  └─ tests/               Jest + Supertest + socket.io-client
└─ client/
   ├─ src/
   │  ├─ pages/            all screens (+ pages/admin/)
   │  ├─ components/       ui kit, cards, map, charts, dialogs
   │  ├─ layouts/          MainLayout, AdminLayout
   │  ├─ context/          Auth, Socket (notifications & chat), Location
   │  ├─ hooks/ services/ utils/ routes/
   │  └─ App.jsx, main.jsx
   └─ vercel.json          SPA rewrite for Vercel
```

---

## Configuration

Server variables live in **`.env` at the project root** (a `server/.env` also works and takes precedence). Only variables the code actually reads are listed:

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | no | `development` (default) / `production` / `test` |
| `PORT` | no | default `5000` |
| `MONGODB_URI` | **yes** | local URI or Atlas `mongodb+srv://…` |
| `JWT_SECRET` | **yes** | ≥ 32 characters. Production refuses placeholder values. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | no | default `7d` |
| `CLIENT_URL` | no | allowed browser origin(s) for CORS + Socket.IO, comma-separated. default `http://localhost:5173` |
| `SERVER_URL` | no | public API origin (used in generated links). default `http://localhost:PORT` |
| `COOKIE_SAMESITE` | no | `lax` (dev default) / `none` (production default, requires HTTPS) / `strict` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | no | when all three are set images go to Cloudinary; otherwise they are saved to `server/uploads/` (fine for development, not for hosts with ephemeral disks) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | no | SMTP for verification / reset emails. Without them the links are printed in the server console |
| `LOG_LEVEL` | no | `info` default |

Client variables (`client/.env`, see `client/.env.example`): `VITE_API_URL` and `VITE_SOCKET_URL`. Leave both **empty in development** — Vite proxies `/api`, `/uploads` and `/socket.io` to `localhost:5000`, so cookies stay same-origin.

**Tunable business rules** (no other code needs to change): `server/src/config/scoring.js` holds reward points, the daily reward cap, the trust-score formula weights and the CO₂e-per-item factors. The CO₂e figures are **illustrative placeholders, not audited data**; the UI labels them as estimates.

---

## Demo accounts & seed data

`npm run seed` (or `npm run dev:memory`) creates sample users, listings around Greater Noida / Delhi-NCR, requests in different states, reviews, an emergency request and a pending organization application. `npm run seed:reset` wipes and rebuilds.

| Email | Role | Password |
|---|---|---|
| `admin@sahyog.local` | Administrator | `Sahyog@123` |
| `asha@sahyog.local`, `ravi@sahyog.local`, `meera@sahyog.local`, `karan@sahyog.local` | Individual | `Sahyog@123` |
| `ngo@sahyog.local` | Verified organization | `Sahyog@123` |
| `clinic@sahyog.local` | Organization, verification **pending** (approve it as admin) | `Sahyog@123` |

These are demo credentials for local use only. Never seed a production database with them.

---

## Running tests

```bash
npm test                # server (Jest) + client (Vitest)
npm run test:server
npm run test:client
```

* **Server** — unit tests (state machine, trust formula, impact maths, geo, validators) and integration tests that run the real Express app against an in-memory MongoDB (`mongodb-memory-server`; the binary is downloaded on first use). The workflow suite covers: register/login, create listing, nearby discovery, borrow request, owner approve/reject, messaging between participants only, completing an exchange, review, rewards earned **exactly once**, inventory consistency under concurrent requests, emergency request + response, organization verification by an admin, and authorisation failures. `socket.test.js` checks Socket.IO room access control.
* **Client** — Vitest + Testing Library: formatting helpers and the registration form's validation messages.
* **Manual responsive / empty / error-state checks** — see the checklist in `docs/DEMO_WALKTHROUGH.md`.

---

## Architecture notes

* **Response envelope:** `{ success: true, data, meta? }` or `{ success: false, message, errors? }`.
* **Auth:** the JWT is set in an `httpOnly` cookie. For cross-site hosting (Vercel ↔ Render) where third-party cookies may be blocked, Socket.IO authenticates with a short-lived token from `GET /auth/socket-token`. Each token carries a `tokenVersion`, so changing the password or "sign out everywhere" revokes all sessions.
* **CSRF:** state-changing API calls must carry `X-Requested-With`, which a cross-site form cannot send; CORS only allows `CLIENT_URL` origins.
* **Inventory consistency:** quantity reservation uses single-document conditional updates (`findOneAndUpdate` with `availableQuantity >= n`), which are atomic on every MongoDB deployment — including standalone local servers where multi-document transactions are unavailable.
* **Reward integrity:** every ledger entry carries a unique dedupe key (user + exchange + reward type), so a completion can never pay out twice even if the endpoint is retried; a daily cap limits farming; confirmed violations can reverse points.
* **Privacy:** public listing coordinates are rounded to roughly 1 km. The exact pickup detail is stored separately and revealed only to the owner and an approved requester.
* **Geo search:** GeoJSON `Point` + `2dsphere` index; proximity queries use `$geoNear` and return the distance per result.

---

## Deployment (Vercel + Render + Atlas)

1. **MongoDB Atlas** — create a free cluster, a database user, and allow the Render outbound IPs (or `0.0.0.0/0` for a demo). Copy the connection string.
2. **Render (API)** — New → *Web Service* from your GitHub repo.
   * Root directory: `server` · Build: `npm install` · Start: `npm start`
   * Environment: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` (random, 32+ chars), `CLIENT_URL=https://<your-app>.vercel.app`, `SERVER_URL=https://<your-api>.onrender.com`, Cloudinary variables (Render's disk is ephemeral, so use Cloudinary for images). `COOKIE_SAMESITE` defaults to `none` in production, which is what a separate-domain frontend needs.
   * Health check path: `/api/v1/health`
   * Seed once from the Render shell if you want demo data: `npm run seed`.
3. **Vercel (web)** — Import the repo, **Root Directory `client`**, framework *Vite*. Set `VITE_API_URL=https://<your-api>.onrender.com` and `VITE_SOCKET_URL` to the same value. `client/vercel.json` already rewrites all paths to `index.html` for React Router.
4. Update `CLIENT_URL` on Render to the final Vercel URL (comma-separate if you also use a custom domain) and redeploy.

Render's free tier sleeps after inactivity, so the first request can take ~30–60 s.

For the strongest cookie behaviour put both apps under one parent domain (e.g. `app.example.com` and `api.example.com`) so cookies are first-party.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid environment configuration` on start | Read the listed problems; usually a missing `MONGODB_URI` or a `JWT_SECRET` shorter than 32 characters |
| `ECONNREFUSED 127.0.0.1:27017` | MongoDB isn't running: `docker compose up -d`, use Atlas, or `npm run dev:memory` |
| Login works but you're logged out on refresh in production | Cookie/CORS mismatch: `CLIENT_URL` must exactly equal the browser origin, the API must be HTTPS, `COOKIE_SAMESITE=none` |
| Images don't show after redeploying | Without Cloudinary, uploads live on local disk; configure Cloudinary for hosted deployments |
| Map tiles are blank | OpenStreetMap tiles need internet access; check an ad-blocker or firewall |
| Port already in use | Change `PORT` in `.env` and `VITE_DEV_API` (e.g. `VITE_DEV_API=http://localhost:5001 npm run dev --prefix client`) |

---

## More documentation

* [`docs/API.md`](docs/API.md) — every endpoint, request fields, status codes
* [`docs/DEMO_WALKTHROUGH.md`](docs/DEMO_WALKTHROUGH.md) — a 10-minute demo script, QA checklist and a presentation outline
