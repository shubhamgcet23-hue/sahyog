# Sahyog API reference

Base URL (development): `http://localhost:5000/api/v1` (the web app reaches it through the Vite proxy at `/api/v1`).

## Conventions

* **Success:** `{ "success": true, "data": …, "meta"?: { page, limit, total, totalPages } }`
* **Error:** `{ "success": false, "message": "Human readable", "errors"?: [{ field, message }] }`
* **Auth:** `httpOnly` cookie `sahyog_token` set by login/register. `Authorization: Bearer <jwt>` is also accepted.
* **CSRF:** requests authenticated by cookie that change state (POST/PATCH/DELETE) must send `X-Requested-With: XMLHttpRequest`. The web client does this automatically; Bearer-token calls don't need it.
* **Pagination:** `?page=1&limit=20` (limits are capped server-side).
* **IDs** are MongoDB ObjectIds. **Locations** are sent as `lat` / `lng` numbers and returned as GeoJSON `{ type: "Point", coordinates: [lng, lat] }`.
* **Uploads** use `multipart/form-data` (`images` ≤ 5 files, JPEG/PNG/WebP, ≤ 5 MB each; `avatar`; `documents` for organization verification).
* **Status codes:** `400` validation · `401` not signed in · `403` not allowed / suspended · `404` not found · `409` conflict (state or inventory) · `413` too large · `429` rate limited.
* **Rate limits:** auth endpoints 20 / 15 min, reports/reviews/verification 30 / hour, everything else 600 / 15 min.

Legend — 🔓 public · 🔐 signed in · 🏢 organization · 🛡️ administrator

---

## Health & public

| Method & path | Auth | Description |
|---|---|---|
| `GET /health` | 🔓 | Liveness + DB state |
| `GET /categories` | 🔓 | Active categories with subcategories |
| `GET /impact?range=week\|month\|year` | 🔓 | Community impact totals, timeline series, per-category units and a labelled CO₂e **estimate** |

## Authentication — `/auth`

| Method & path | Auth | Body / notes |
|---|---|---|
| `POST /auth/register` | 🔓 | `name`, `email`, `password` (8–72 chars, letter + number), `phone?`, `role` (`USER` default or `ORGANIZATION`), `organizationDetails{ orgName, orgType, registrationNumber?, website?, description? }` (required for organizations). `ADMIN` can never be self-registered |
| `POST /auth/login` | 🔓 | `email`, `password` → sets cookie, returns `{ user }` |
| `POST /auth/logout` | 🔓 | Clears the cookie |
| `POST /auth/logout-all` | 🔐 | Revokes every session of this account |
| `GET /auth/me` | 🔐 | Current user (also works for suspended accounts so the UI can explain) |
| `GET /auth/socket-token` | 🔐 | Short-lived token for the Socket.IO handshake |
| `PATCH /auth/change-password` | 🔐 | `currentPassword`, `newPassword`; signs out other sessions |
| `POST /auth/forgot-password` | 🔓 | `email` — always answers the same way (no account enumeration) |
| `POST /auth/reset-password` | 🔓 | `token`, `password` |
| `POST /auth/verify-email` | 🔓 | `token` |

## Users — `/users`

| Method & path | Auth | Description |
|---|---|---|
| `GET /users/me` | 🔐 | Own profile |
| `PATCH /users/me` | 🔐 | `name`, `phone`, `bio`, `areaLabel`, `lat`, `lng`, `organizationDetails`, `avatar` file. Role, trust score and points cannot be set |
| `GET /users/me/activity` | 🔐 | Dashboard data computed from the database: counts, trust score **with breakdown**, points, borrowed items & due dates, donation history |
| `GET /users/me/resources` | 🔐 | Own listings |
| `GET /users/me/pending-reviews` | 🔐 | Completed exchanges you haven't reviewed yet |
| `GET /users/me/rewards` | 🔐 | Reward ledger (earned and reversed) |
| `GET /users/me/moderations` | 🔐 | Moderation decisions about your content (for appeals) |
| `GET /users/:id` | 🔐 | Public profile (limited fields) |
| `GET /users/:id/reviews` | 🔐 | Visible reviews received |

## Resources — `/resources`

| Method & path | Auth | Description |
|---|---|---|
| `GET /resources` | 🔓 | Filters: `q`, `category`, `type` (BORROW/DONATE/SHARE), `condition`, `availability` (`available`\|`all`), `sort` (`newest`\|`nearest`), `lat`, `lng`, `radiusKm` (default 25), `owner`, `page`, `limit`. Each item has `distanceKm` when coordinates are given |
| `GET /resources/nearby` | 🔓 | Required `lat`, `lng`; `radiusKm` (default 10), `category`, `type`, `limit` — nearest first, for the map |
| `POST /resources` | 🔐 user/org | `title`, `description`, `category`, `subcategory?`, `condition` (NEW…POOR), `availabilityType`, `quantity`, `lat`, `lng`, `areaLabel?`, `addressDetail?` (private), `availableFrom?`, `availableTo?`, `images[]` |
| `GET /resources/:id` | 🔓 | Details. Owner and approved requesters additionally see the private address; `viewerRequest` shows the caller's open request |
| `PATCH /resources/:id` | 🔐 owner | Same fields, optional; `removeImages[]`. Quantity can't drop below reserved units |
| `DELETE /resources/:id` | 🔐 owner | Refused while requests are active |

## Requests — `/requests`

| Method & path | Auth | Description |
|---|---|---|
| `POST /requests` | 🔐 | `resourceId`, `quantity`, `message?`, `intendedUse`, `handoverMethod` (PICKUP/DELIVERY), `handoverNote?`, `proposedReturnDate` (**required, in the future, ≤ 90 days** for BORROW). Not your own listing; not more than available |
| `GET /requests/me` | 🔐 | Requests you made. Filters `status`, `type`, `overdue` |
| `GET /requests/received` | 🔐 | Requests for your listings |
| `GET /requests/:id` | 🔐 | Requester or owner only; includes `statusHistory` |
| `PATCH /requests/:id/status` | 🔐 | `status` + `note?`. Allowed transitions below |
| `POST /requests/:id/cancel` | 🔐 | Requester (pending/approved) — returns reserved units |
| `POST /requests/:id/complete` | 🔐 owner | Confirms handover/return; awards points once, restores stock for borrow/share |

**State machine** (enforced on the server; invalid moves → `409`)

```
PENDING ──owner──▶ APPROVED ──owner──▶ IN_PROGRESS ──owner──▶ COMPLETED
   │                  │
   ├─owner─▶ REJECTED └─owner/requester─▶ CANCELLED
   └─requester─▶ CANCELLED
```

* Approving **reserves** the quantity atomically (two concurrent approvals can never oversell).
* DONATE completion permanently consumes the stock; BORROW/SHARE completion returns it.
* A BORROW that is `APPROVED`/`IN_PROGRESS` after its return date is flagged `isOverdue`; borrowers get reminders before the date.

## Messaging — `/conversations`

| Method & path | Auth | Description |
|---|---|---|
| `GET /conversations` | 🔐 | Your conversations with last message and unread count |
| `POST /conversations` | 🔐 | `{ requestId }` — idempotent; only the requester and the owner of that request may open it |
| `GET /conversations/:id/messages` | 🔐 participant | Paginated history |
| `POST /conversations/:id/messages` | 🔐 participant | `{ content }` (≤ 2000 chars); also delivered live over Socket.IO |
| `POST` or `PATCH /conversations/:id/read` | 🔐 participant | Mark as read |

### Socket.IO

Connect to the API origin with `auth: { token }` (token from `/auth/socket-token`) or the session cookie. The server puts each socket in a private `user:<id>` room.

| Client → server | Payload | Notes |
|---|---|---|
| `conversation:join` | `conversationId` (+ ack) | Rejected unless you're a participant |
| `conversation:leave` | `conversationId` | |
| `message:send` | `{ conversationId, content }` (+ ack) | Persists and broadcasts |
| `message:read` | `{ conversationId }` (+ ack) | |
| `typing` | `{ conversationId, typing }` | Participants only |

| Server → client | Payload |
|---|---|
| `message:new` | the saved message (sent to the conversation room) |
| `message:read` | `{ conversationId, userId }` — the other participant read the thread |
| `conversation:updated` | `{ conversationId, lastMessage, lastMessageAt }` (to the other participant's private room) |
| `notification:new` | a notification document (to the recipient's private room) |
| `typing` | `{ conversationId, userId, typing }` |

## Notifications — `/notifications`

| Method & path | Auth | Description |
|---|---|---|
| `GET /notifications` | 🔐 | Own notifications (`?unread=true`); `meta.unread` holds the unread total |
| `PATCH /notifications/read-all` | 🔐 | |
| `PATCH /notifications/:id/read` | 🔐 | Only your own |

Types: new request, approved/rejected, new message, return due/overdue, exchange completed, review received, emergency offers/updates, organization verification, moderation decisions.

## Emergency assistance — `/emergencies`

| Method & path | Auth | Description |
|---|---|---|
| `GET /emergencies` | 🔐 | Filters `q`, `category`, `urgency` (CRITICAL/HIGH/MEDIUM/LOW), `status`, `lat`/`lng`/`radiusKm`, `mine`, `responded`, pagination. Ordinary members only see `OPEN`, `MATCHED` and `FULFILLED` requests; `UNDER_REVIEW`/`CLOSED` are visible to the creator and admins. Locations are approximate (~1 km) |
| `POST /emergencies` | 🔐 | `title`, `description`, `category`, `urgency`, `quantity?`, `lat`, `lng`, `areaLabel?`, `contactPreference` (`IN_APP_ONLY` default or `SHARE_PHONE_AFTER_MATCH`), `images[]` |
| `GET /emergencies/:id` | 🔐 | Responses are visible to the creator and admins (others only see their own). The creator's phone is revealed only to an **accepted** responder and only if the creator chose `SHARE_PHONE_AFTER_MATCH` |
| `PATCH /emergencies/:id` | 🔐 creator/admin | Edit |
| `POST /emergencies/:id/respond` | 🔐 | `{ message, offerType (DONATE/LEND/VOLUNTEER/INFO), quantity? }` — notifies the creator. Not your own request |
| `PATCH /emergencies/:id/responses/:responseId` | 🔐 creator | `{ status: ACCEPTED \| DECLINED }` (a responder can `WITHDRAWN`) |
| `PATCH /emergencies/:id/status` | 🔐 | `{ status, note? }`. Creator: `OPEN→MATCHED→FULFILLED→CLOSED`; admin: `UNDER_REVIEW`, reopen, close. Fulfilling rewards accepted helpers once |

## Reviews & reports

| Method & path | Auth | Description |
|---|---|---|
| `POST /reviews` | 🔐 | `{ requestId, rating 1–5, comment? }` — completed exchanges only, participants only, one per reviewer |
| `POST /reports` | 🔐 | `{ targetType: USER\|RESOURCE\|REVIEW\|EMERGENCY, targetId, reason, description? }` — one per reporter per target; not your own content |
| `GET /reports/against-me` | 🔐 | Decisions taken about your content |
| `POST /reports/:id/appeal` | 🔐 | `{ message }` — challenge a moderation decision once |

## Organizations

| Method & path | Auth | Description |
|---|---|---|
| `POST /organizations/verification` | 🏢 | `message?`, `documents[]` → creates a pending application |
| `GET /organizations/verification` | 🏢 | Your applications and their status |

## Administration — `/admin` (🛡️ only; every state change is written to the audit log)

| Method & path | Description |
|---|---|
| `GET /admin/overview` | Live counts + recent activity |
| `GET /admin/analytics?range=` | Growth series, status/category/type breakdowns, impact data |
| `GET /admin/users` | `q`, `role`, `status`, pagination |
| `PATCH /admin/users/:id/status` | `{ status: ACTIVE\|SUSPENDED, reason? }` (admins can't be suspended) |
| `GET /admin/organizations/pending` | Pending applications with documents |
| `PATCH /admin/organizations/:id/verification` | `{ decision: APPROVED\|REJECTED, note? }` — `:id` is the organization's **user** id; notifies the organization |
| `GET /admin/reports` | `status`, `targetType`, `appeal=PENDING`, with a preview of the reported content |
| `PATCH /admin/reports/:id` | `{ status?, action: NONE\|WARN\|HIDE_CONTENT\|SUSPEND_USER, note?, reverseRewards? }` or `{ appealDecision: UPHELD\|OVERTURNED, note? }` |
| `GET /admin/resources` · `PATCH /admin/resources/:id/moderation` | List / hide (`HIDDEN`) or restore (`AVAILABLE`) listings |
| `GET /admin/emergencies` | Active emergency requests |
| `GET/POST /admin/categories` · `PATCH/DELETE /admin/categories/:id` | Manage categories (in-use categories can't be deleted) |
| `GET /admin/audit-logs` | Paginated administrative audit trail |

## Data models (summary)

`User` · `Resource` (GeoJSON `location` + `2dsphere` index, private `addressDetail`) · `ResourceRequest` (`statusHistory`, `resourceSnapshot`) · `Review` (unique per request + reviewer) · `Notification` · `Conversation` / `Message` (`readBy`) · `EmergencyRequest` (embedded `responses`) · `RewardTransaction` (unique `dedupeKey`) · `Report` (with `adminDecision` and `appeal`) · `OrgVerification` · `AuditLog` · `Category`. See `server/src/models/` for exact fields and indexes.
