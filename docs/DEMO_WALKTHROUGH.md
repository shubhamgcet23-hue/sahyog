# Sahyog — demo walkthrough, QA checklist and presentation outline

## 1. Ten-minute live demo

Prepare: `npm run seed` (or `npm run dev:memory`), then `npm run dev`. Open two browser windows — one normal, one private — so you can show two people at once.

| # | Who | Do this | Point to make |
|---|---|---|---|
| 1 | visitor | Open the landing page, scroll through *How it works*, featured nearby listings, emergency section and the impact numbers | Everything on the page is live data; there are no hard-coded statistics |
| 2 | visitor | **Find resources** → allow location (or pick a preset area) → drag the radius → switch **List ⇄ Map** → filter by *Books* and *Donate* | Hyperlocal discovery with distances; location is only requested on click and a manual option exists |
| 3 | Ravi (`ravi@sahyog.local`) | Open a listing → **Request** → choose quantity, intended use, pickup, return date | Server-side checks: not your own listing, not more than is available, future return date for borrows |
| 4 | Asha (`asha@sahyog.local`, private window) | Notification bell lights up instantly → **My requests → Received** → **Approve** | Real-time notification via Socket.IO; stock is reserved atomically |
| 5 | Asha + Ravi | Open **Messages**, exchange a few messages, show typing indicator and unread badge | Chat is persisted and only the two participants can join the room |
| 6 | Asha | **Start handover** → **Confirm completed** (for a borrow: **Confirm item returned**) | State machine: invalid jumps are rejected; completion restores borrow stock |
| 7 | both | Leave a review for each other; open the dashboard | Reviews only after completion; reward points and trust score updated **once** |
| 8 | Meera (`meera@sahyog.local`) | **Emergency → New request** (read the safety notice) | "Not an emergency service" notice; location is shown approximately |
| 9 | Karan (`karan@sahyog.local`) | Open the emergency request → fill in **What can you offer?** and send the offer | Creator is notified; contact details stay private until accepted |
| 10 | Meera | Accept the offer → mark **Matched → Fulfilled** | Helper earns reward points exactly once |
| 11 | Admin (`admin@sahyog.local`) | **Admin → Organizations** → approve *City Care Clinic* | Admin-only workflow; organization is notified; audit log entry written |
| 12 | Admin | Report a listing from the normal window → **Moderation** → hide it → (as owner) appeal → overturn | Moderation with appeals; trust score isn't directly editable |
| 13 | anyone | **Impact** page → switch Week / Month / Year | Charts from real aggregates; CO₂e is labelled as an estimate with an editable formula |
| 14 | admin | **Overview** → audit log, **Users** → suspend / reactivate someone | Accountability of administrative actions |

## 2. QA checklist (manual)

**Responsive** — check at 375 px, 768 px and 1280 px: navigation collapses to a menu; discovery filters stack; map and list stay usable; tables scroll horizontally instead of breaking the page; dialogs become bottom sheets on phones.

**Accessibility** — tab through every form; focus ring visible; dialogs trap focus and close with Esc; charts have a table alternative; colour is never the only status signal (badges carry text); form errors are announced (`role="alert"`).

**Empty states** — fresh account: no listings, no requests, no notifications, no conversations, no reviews; search with no results; emergency list with filters that match nothing.

**Error states** — stop the API and reload (friendly "cannot reach server" message with retry); open `/resources/000000000000000000000000` (not found); open `/admin` as a normal user (redirected); submit a form with server-side validation errors (message appears under the form).

**Security spot checks** — try an admin API route with a normal user's session (403); read another user's request by id (404); send a PATCH without `X-Requested-With` using the cookie (403); log in with `{"email": {"$gt": ""}}` (rejected by validation).

## 3. Automated test map

| Required workflow | Where |
|---|---|
| 1 Register & log in | `server/tests/workflows.test.js` — *1. Register and log in*; `client/src/pages/Register.test.jsx` |
| 2–3 Create listing, discover nearby | *2-3. Create a listing and discover it nearby* |
| 4–5 Borrow request, approve/reject | *4-5. Borrowing request, approve / reject* |
| 6 Messaging between participants | *6. Messaging…*, `server/tests/socket.test.js` |
| 7–9 Complete, review, rewards once | *7-9. Complete an exchange…* |
| 10 Emergency request & response | *10. Emergency requests* |
| 11 Organization verification | *11. Organization verification…* |
| 12 Unauthorized access | *12. Unauthorized access is prevented* |
| Inventory consistency | *inventory consistency* |
| Unit tests | `server/tests/unit/*` (state machine, trust, impact, geo, validators) |

## 4. Presentation outline (12–14 slides)

1. **Title** — Sahyog: hyperlocal community resource sharing
2. **The problem** — unused goods at home, unmet needs next door, no trusted local channel
3. **Objectives** — reduce waste, improve access, build cooperation, speed up help
4. **Who it serves** — individuals, organizations (hospitals, schools, NGOs), administrators
5. **Core features** — listings, discovery map, requests, chat, emergency help
6. **Trust & safety** — verification, reviews, trust score, reports & appeals, privacy of locations
7. **Architecture** — React/Vite/Tailwind → Express REST + Socket.IO → MongoDB Atlas; Cloudinary for images (diagram)
8. **Data model** — the 12 collections and key relationships (ERD)
9. **Request lifecycle** — the state-machine diagram from `docs/API.md`
10. **Security** — JWT in httpOnly cookies, bcrypt, Zod validation, rate limits, Helmet, role checks, audit log
11. **Impact dashboard** — live statistics and the honest CO₂e estimation model
12. **Testing** — unit + integration + socket tests; 12 workflows covered
13. **Deployment** — Vercel + Render + Atlas + Cloudinary
14. **Limitations & future scope** — no payments by design, optional SMS/push notifications, mobile app, multilingual UI, richer analytics

**Honest limitations to mention:** reward points are non-monetary; impact figures are illustrative estimates until real emission factors are supplied; email features need SMTP credentials; the free Render tier sleeps when idle.
