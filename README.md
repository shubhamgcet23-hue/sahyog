# Sahyog — Hyperlocal Community Resource-Sharing Platform

Sahyog connects individuals, hospitals, schools, NGOs, and neighbourhoods so they can **lend, borrow, donate, and share** resources—and ask the community for help in urgent situations.

It is a full-stack **MERN** application built with React, Vite, and Tailwind CSS on the frontend; Express, MongoDB, and Mongoose on the backend; and Socket.IO for real-time features.

> **Safety notice:** Sahyog is a community coordination platform, not an emergency-response service. In immediate danger in India, call **112** or your local emergency number.

## Live demo

- **Frontend:** <https://sahyog-flax.vercel.app/>
- **Backend health check:** <https://sahyog-backend-vfb2.onrender.com/api/v1/health>

The health-check endpoint reports whether the deployed API is responding. The Render free tier may sleep after inactivity, so its first response can take some time.

## Contents

1. [Features](#features)
2. [Project structure](#project-structure)
3. [Quick start](#quick-start)
4. [Configuration](#configuration)
5. [Demo accounts and seed data](#demo-accounts-and-seed-data)
6. [Running tests](#running-tests)
7. [Architecture notes](#architecture-notes)
8. [Deployment](#deployment-vercel-render-and-mongodb-atlas)
9. [Troubleshooting](#troubleshooting)
10. [More documentation](#more-documentation)

## Features

| Area | What is implemented |
|---|---|
| **Accounts** | Register, login, logout, bcrypt-hashed passwords, JWT in an `httpOnly` cookie (plus Bearer support), profile and password changes, sign out of all devices, optional email verification and password reset, account suspension checks |
| **Roles** | Individual, organization (admin-verified), and administrator roles enforced by server middleware and protected React routes |
| **Listings** | Create, edit, and delete listings; up to five images (JPEG/PNG/WebP, 5 MB each); category and subcategory; condition; BORROW / DONATE / SHARE; quantity; availability dates; approximate location for privacy |
| **Discovery** | Text search, category/type/condition filters, radius search, sort by newest or nearest, pagination, list and map views (Leaflet + OpenStreetMap), browser geolocation only on request, manual location picker, `2dsphere` geospatial index |
| **Requests** | Quantity, message, intended use, pickup/delivery, return date, server-enforced state machine (`PENDING → APPROVED → IN_PROGRESS → COMPLETED`, plus `REJECTED` and `CANCELLED`), overdue flags for borrows, atomic inventory reservation |
| **Chat and notifications** | One-to-one chat per request, REST message history, Socket.IO live delivery, unread counts, typing indicator, reconnection handling, in-app notifications, scheduled return reminders |
| **Emergency assistance** | Requests with urgency and category, map and filters, donor/volunteer responses, accept/decline, status workflow (`OPEN`, `UNDER_REVIEW`, `MATCHED`, `FULFILLED`, `CLOSED`), admin moderation, safety notice |
| **Trust and rewards** | Reviews after completed exchanges, abuse reporting, configurable trust formula, reward-point ledger with duplicate prevention and daily cap, reward reversals, appeals against moderation decisions |
| **Dashboards** | Member and organization dashboards, organization verification and inventory, admin overview with counts, analytics charts, audit log |
| **Community impact** | Public impact dashboard with completed donations, combined borrow/share exchanges, reused items, contributors, fulfilled emergencies, time-range charts, category breakdown, and a clearly labelled configurable CO₂e estimate |
| **Admin** | User search and suspension/reactivation, organization verification queue, report and appeal decisions, listing moderation, emergency oversight, category management, audit trail |
| **Security** | Helmet, CORS restrictions, rate limiting, Zod validation, NoSQL-injection sanitisation, CSRF header requirement for cookie-authenticated state-changing requests, upload type/size limits, Socket.IO room authorisation, production error handling, environment validation, graceful shutdown |

See `client/src/App.jsx` for the frontend route table.

## Project structure

```text
sahyog/
├── package.json               # Root scripts for development, tests, and build
├── .env.example               # Example server configuration; copy to .env locally
├── docker-compose.yml         # Optional local MongoDB
├── .vscode/                   # Recommended extensions, tasks, debugger config
├── docs/
│   ├── API.md                 # API endpoint reference
│   └── DEMO_WALKTHROUGH.md    # Demo script and manual QA checklist
├── server/
│   ├── src/
│   │   ├── config/            # Environment, database, scoring, impact formulas
│   │   ├── models/            # Mongoose models
│   │   ├── controllers/       # HTTP handlers
│   │   ├── services/          # Application business logic
│   │   ├── middleware/        # Authentication, validation, uploads, errors, audit
│   │   ├── routes/            # /api/v1 route table
│   │   ├── sockets/           # Socket.IO authentication and rooms
│   │   ├── validators/        # Zod schemas
│   │   ├── utils/             # State machine, geo, pagination, seed, logger
│   │   ├── scripts/           # Controlled admin creation script
│   │   ├── app.js             # Express app, importable by tests
│   │   ├── server.js          # HTTP server, Socket.IO, jobs, graceful shutdown
│   │   └── devMemory.js       # Zero-setup development mode
│   └── tests/                 # Jest, Supertest, socket.io-client
└── client/
    ├── src/
    │   ├── pages/             # Screens, including admin pages
    │   ├── components/        # UI kit, cards, maps, charts, dialogs
    │   ├── layouts/           # Main and admin layouts
    │   ├── context/           # Auth, Socket.IO, and location state
    │   ├── hooks/ services/ utils/ routes/
    │   └── App.jsx, main.jsx
    ├── .env.example           # Example Vite configuration
    └── vercel.json            # SPA rewrite for React Router
```

## Quick start

### Prerequisites

- Node.js **18.17 or newer** (Node.js 20 or 22 recommended).
- One database option: local MongoDB via Docker, a MongoDB Atlas cluster, or the in-memory development option.
- Git and a terminal. VS Code is optional.

### 1. Clone and install

```bash
git clone <your-repository-url>
cd sahyog
npm install
```

The root `postinstall` script installs dependencies in `server/` and `client/` as well.

### 2. Configure environment variables

Create your local environment file from the example:

```bash
cp .env.example .env
```

Edit `.env` and set `MONGODB_URI` and a random `JWT_SECRET` of at least 32 characters. The actual `.env` file is local configuration and must **never** be committed to Git.

Choose one of the following database options:

- **A. Local MongoDB with Docker:** `docker compose up -d`
- **B. MongoDB Atlas:** set your Atlas connection string as `MONGODB_URI` in `.env`.
- **C. In-memory development database:** skip the external database setup and use `npm run dev:memory` below. The first run downloads a MongoDB binary (about 100 MB), which is cached for later runs.

### 3. Start the app

For local MongoDB or Atlas, you can load sample data into your **local/development database only**, then start the app:

```bash
npm run seed
npm run dev
```

The API runs on port `5000` by default and Vite runs on port `5173`.

For the in-memory option, run:

```bash
npm run dev:memory
```

Open <http://localhost:5173> in your browser. For sample login details, see [Demo accounts and seed data](#demo-accounts-and-seed-data).

> **Never run `npm run seed` or `npm run seed:reset` against your production database.** The reset command can delete existing data, and seed data includes shared demo credentials.

## Configuration

Server variables are loaded from `server/.env` first, then the project-root `.env` as a fallback. Actual environment variables provided by a hosting platform take precedence. Use `.env.example` and `server/.env.example` as references; they contain examples, not production credentials.

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | No | `development` by default; use `production` for deployment and `test` for tests |
| `PORT` | No | Defaults to `5000` |
| `MONGODB_URI` | **Yes** | Local MongoDB URI or MongoDB Atlas connection string |
| `JWT_SECRET` | **Yes** | At least 32 characters. Production rejects placeholder values. Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | No | Defaults to `7d` |
| `CLIENT_URL` | No | Allowed browser origin(s) for CORS and Socket.IO; comma-separated. Defaults to `http://localhost:5173` |
| `SERVER_URL` | No | Public API origin used in generated links; defaults to `http://localhost:PORT` |
| `COOKIE_SAMESITE` | No | `lax` in development and `none` in production by default; `none` requires HTTPS and secure cookies |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | No | Configure all three for Cloudinary uploads. Without them, uploads are stored under `server/uploads/`, which is not persistent on ephemeral hosting disks |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | No | SMTP for verification and reset emails. In development, links are logged when email isn't configured |
| `LOG_LEVEL` | No | Defaults to `info` |

Client-side variables belong in `client/.env` (see `client/.env.example`):

- `VITE_API_URL` — the API **origin**, e.g. `https://sahyog-backend-vfb2.onrender.com`. Do not append `/api/v1`; the frontend API client adds that prefix.
- `VITE_SOCKET_URL` — the API origin for Socket.IO. It may be left blank in development when the Vite proxy is used.

For local development, leave the client variables blank so Vite can proxy `/api`, `/uploads`, and `/socket.io` to the local server. In production, set the variables in Vercel's project settings and redeploy after changing them.

**Tunable business rules:** `server/src/config/scoring.js` holds reward points, daily reward cap, trust-score weights, and CO₂e-per-item factors. CO₂e figures are illustrative estimates—not audited measurements.

## Demo accounts and seed data

`npm run seed` loads sample users, listings around Greater Noida / Delhi-NCR, requests in different states, reviews, an emergency request, and a pending organization application into the configured database. `npm run seed:reset` resets and rebuilds the sample dataset.

| Email | Role | Password |
|---|---|---|
| `admin@sahyog.local` | Administrator | `Sahyog@123` |
| `asha@sahyog.local`, `ravi@sahyog.local`, `meera@sahyog.local`, `karan@sahyog.local` | Individual | `Sahyog@123` |
| `ngo@sahyog.local` | Verified organization | `Sahyog@123` |
| `clinic@sahyog.local` | Organization awaiting verification | `Sahyog@123` |

These credentials are for **local demo data only**. Do not create or use these accounts on a live production database. Do not run seed/reset scripts in production.

### Creating a production administrator

The project includes a guarded script at `server/src/scripts/createAdmin.js` for controlled production administrator creation. It requires `NODE_ENV=production`, a secure `ADMIN_PASSWORD` environment variable (12–128 characters, without spaces), and an explicit confirmation phrase. Run it only from a trusted environment connected to the intended production database. Never put the production password in source control or print it in logs.

## Running tests

Run the test suites from the project root:

```bash
npm test
npm run test:server
npm run test:client
```

- **Server:** Jest unit tests for the state machine, trust formula, impact maths, geo utilities, and validators; integration tests use an in-memory MongoDB (`mongodb-memory-server`, which downloads a binary on first use). Workflow tests cover registration/login, listings, discovery, borrow requests, approval/rejection, messaging authorisation, completed exchanges, reviews, rewards, inventory consistency, emergency requests/responses, organization verification, and access-control failures. `socket.test.js` checks Socket.IO room access.
- **Client:** Vitest and Testing Library tests, including formatting helpers and registration validation.
- **Manual QA:** see `docs/DEMO_WALKTHROUGH.md` for responsive, empty-state, and error-state checks.

Run `npm run build` from the root to build the frontend.

## Architecture notes

- **Response envelope:** successful API responses use `{ success: true, data, meta? }`; errors use `{ success: false, message, errors? }`.
- **Authentication:** JWT authentication uses an `httpOnly` cookie, with Bearer support. Cross-site deployments (Vercel and Render on separate domains) require correct HTTPS, CORS, and cookie settings. Socket.IO can use a short-lived token from `GET /api/v1/auth/socket-token`. Tokens carry a `tokenVersion`, so password changes and sign-out-everywhere can revoke sessions.
- **CSRF protection:** state-changing API calls require the `X-Requested-With` header, and CORS allows only configured client origins.
- **Inventory consistency:** quantity reservations use conditional updates (including `availableQuantity >= requestedQuantity`) so concurrent requests cannot reserve more stock than is available.
- **Reward integrity:** ledger entries use deduplication keys to prevent duplicate payouts; daily caps limit abuse, and qualifying violations can reverse points.
- **Privacy:** public listing coordinates are approximate. Exact pickup details are restricted to the owner and an approved requester.
- **Geospatial search:** GeoJSON `Point` data and a `2dsphere` index support proximity queries.

## Deployment (Vercel, Render, and MongoDB Atlas)

### 1. MongoDB Atlas

1. Create a cluster and database user.
2. Configure network access for your deployment. For a demo, broad access may be convenient, but restrict access where possible.
3. Copy the connection string and set it as `MONGODB_URI` in Render. Keep the URI private.

### 2. Render (API)

Create a Web Service from your GitHub repository using:

- **Root directory:** `server`
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Health-check path:** `/api/v1/health`

Configure these environment variables in Render:

- `NODE_ENV=production`
- `MONGODB_URI`
- `JWT_SECRET` (random, at least 32 characters)
- `CLIENT_URL=https://sahyog-flax.vercel.app` (or your final frontend origin)
- `SERVER_URL=https://sahyog-backend-vfb2.onrender.com` (or your deployed API origin)
- Optional Cloudinary variables for persistent image storage
- Optional SMTP variables for email delivery

`COOKIE_SAMESITE` defaults to `none` in production, which is intended for HTTPS deployments where the frontend and API are on separate domains. Confirm cookie and CORS behaviour with your deployed domains.

**Do not run `npm run seed` or `npm run seed:reset` in the Render shell against production.** If an initial administrator is required, use the guarded `server/src/scripts/createAdmin.js` process instead.

### 3. Vercel (frontend)

Import the repository into Vercel and configure:

- **Root directory:** `client`
- **Framework preset:** Vite
- `VITE_API_URL=https://sahyog-backend-vfb2.onrender.com` (API origin only; do not add `/api/v1`)
- `VITE_SOCKET_URL=https://sahyog-backend-vfb2.onrender.com`

The `client/vercel.json` file contains the SPA rewrite for React Router. Set the values to your actual deployed API origin if it changes, then redeploy the frontend.

### 4. Verify the deployment

1. Open the frontend and test login/logout.
2. Open the backend health-check URL.
3. Test resource discovery, creating a request, emergency listing/details, and the Impact dashboard.
4. Check browser DevTools → Network and Console if an API request or page fails.

Render's free tier may sleep after inactivity, making the first request slower. For more reliable first-party cookie behaviour, consider putting both apps under a shared parent domain, such as `app.example.com` and `api.example.com`.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `Invalid environment configuration` on startup | Confirm `MONGODB_URI` is set and `JWT_SECRET` is at least 32 characters. Use a non-placeholder secret in production. |
| `ECONNREFUSED 127.0.0.1:27017` | Start local MongoDB with `docker compose up -d`, use Atlas, or run `npm run dev:memory`. |
| Login works but the session disappears after refresh in production | Check the exact `CLIENT_URL`, HTTPS, CORS, `COOKIE_SAMESITE=none`, and browser cookie restrictions. |
| API requests return `401 Unauthorized` | Sign in again and inspect the response to `/api/v1/auth/me`. Check cookie and CORS settings; do not expose session cookies or tokens when sharing logs. |
| Images disappear after redeploying | Without Cloudinary, uploads are stored on local disk. Configure Cloudinary for hosted deployments with ephemeral filesystems. |
| Map tiles are blank | Check internet access, browser extensions, and whether OpenStreetMap tile requests are blocked. |
| Port already in use | Set a different `PORT` in the server environment and update the Vite proxy configuration if needed. |
| Impact page crashes or shows missing values | Inspect the `/api/v1/impact?period=month` JSON and ensure the frontend uses the current API field names, including `environmentalEstimate`, `assumptions`, and `allTime`. |
| Emergency exists in the API but not on the page | Inspect the emergency-list request's response, selected filters, and the browser Console. Confirm the frontend uses the deployed bundle after a new deployment. |

## More documentation

- [`docs/API.md`](docs/API.md) — API endpoints, request fields, and status codes.
- [`docs/DEMO_WALKTHROUGH.md`](docs/DEMO_WALKTHROUGH.md) — a 10-minute demo script, QA checklist, and presentation outline.

---

Built as a community resource-sharing project. Contributions and issue reports are welcome.
