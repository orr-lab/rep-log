# Rep Log

A password-gated training log for workout videos. Upload a video (or paste a YouTube link) after
each set, tag it, rate how hard it felt, log the weight/sets/reps, and watch your progress on an
exercise over time. It's multi-tenant — an admin account can create additional logins, each with
its own fully isolated log — and includes an optional read-only public link for sharing your
training log without giving out a password.

The admin's log is also viewable read-only, without signing in, at `/visitor`, when that's turned
on (see [Public visitor profile](#public-visitor-profile-optional)).

**Live at [replog.orrknaan.com](https://replog.orrknaan.com).**

Built with Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Prisma + Postgres, Vercel Blob
for uploaded video, and Recharts for the stats page.

> **A note on the stack:** this targets the latest stable Next.js (16) and Postgres (Neon, via
> Vercel's free marketplace tier) rather than SQLite — Vercel's serverless functions have a
> read-only, ephemeral filesystem, so a SQLite file would not reliably survive between
> deployments or even separate function invocations in production. Prisma is pinned to the 6.x
> line rather than the newly-released 7, which drops the classic `datasource url` schema config
> in favor of driver adapters — a much bigger workflow change than this app needs.

## Features

- **Log a set**: exercise name (autocompleted from your own history plus a built-in catalog of
  common lifts), date, weight (optional — many exercises are bodyweight or don't have a single
  number, like cardio), sets, reps, perceived exertion (1-5), tags (also autocompleted), and
  free-text notes, attached to either an uploaded video file or a YouTube link.
- **Progress tracking**: a dashboard with streaks, training-time totals, and a "this week's
  weighted lifts" section; a library with search/filter/sort; and a per-exercise view showing
  every set of the same exercise over time, plus that exercise's personal record (PR).
- **Personal records**: a `/records` table listing your all-time heaviest logged set for every
  exercise, sorted heaviest-first, linking straight to the entry that set each record.
- **Climbing mode**: an optional per-account toggle that switches the whole logging experience —
  entry form, records, library — to gyms and V-scale grades instead of weight — see
  [Climbing mode](#climbing-mode).
- **AI form feedback**: an optional Gemini-powered rating and coaching note on your form per
  entry — see [AI feedback](#ai-feedback-gemini).
- **Comments**: the account owner and anyone with that account's visitor password can leave
  guestbook-style comments on an entry; only the owner can delete them — see
  [Comments](#comments).
- **Multiple accounts**: the admin can create additional logins, each with its own isolated
  log — see [Accounts](#accounts).
- **Visitor (read-only) access**: any account can hand out a separate password that grants
  browsing (and commenting) without any editing ability.
- **Public visitor profile**: an admin-only, opt-in toggle that publishes the admin's log
  read-only at `/visitor`, no login at all — see [Public visitor profile](#public-visitor-profile-optional).
- **Admin controls**: create/delete accounts, reset any account's password, and two app-wide
  toggles (public visitor profile, direct video uploads) — all from Settings.
- **Security-conscious by design**: scrypt password hashing, signed session cookies, per-(IP,
  username) login rate limiting, and a local-only break-glass password reset script — see
  [Resetting a forgotten password](#resetting-a-forgotten-password).

## How the data model works

There's no separate "Exercise" table. A **WorkoutEntry** is one set of one exercise (name + date +
video + weight/sets/reps + tags + exertion + notes). Exercises are computed on the fly by grouping
entries on `exerciseName` (case-insensitive) — see [src/lib/stats.ts](src/lib/stats.ts) and the
`/exercise` route.

The same `WorkoutEntry` table also holds two nullable climbing-specific columns, `gym` and
`grade`, populated only when [climbing mode](#climbing-mode) is on for the logging account — there
was no need for a separate table or entry type, since an account is either logging weights or
logging climbs, never a per-entry mix.

## Setup

### Prerequisites

- Node.js 20+
- A Vercel account (for Blob storage and Postgres) — the free/Hobby tier covers this app
- The [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`), logged in (`vercel login`)

### 1. Environment variables

Copy `.env.example` to `.env.local` (or use the values already pulled if you ran `vercel link` +
`vercel blob create-store`, see below):

| Variable | Where it comes from |
|---|---|
| `SITE_PASSWORD` | Pick your own password. This seeds the **admin** account the first time `scripts/seed-admin.js` runs (see [Accounts](#accounts) below) — after that, it no longer gates login directly (the admin changes their password from the Settings page instead), but it must stay set, since it also keys the session-cookie signature. Don't remove or rotate it later without expecting everyone to be logged out. |
| `VISITOR_PASSWORD` | Optional. Seeds the admin's own visitor (read-only) password at the same one-time seeding step. Unlike `SITE_PASSWORD`, it has no ongoing role afterward — it's only ever read by `scripts/seed-admin.js`, which skips entirely once an admin account already exists. Once you've seeded (or if you don't need the admin to have visitor access), it's safe to leave unset or delete from your environment entirely; the live visitor password is managed from Settings from then on. |
| `DATABASE_URL` | From your Postgres provider (Neon via Vercel Marketplace, or any Postgres). Pulled automatically by `vercel env pull` once connected. |
| `BLOB_READ_WRITE_TOKEN` | Created automatically when you run `vercel blob create-store` (see below), or from the Blob store's settings in the Vercel dashboard. |
| `GEMINI_API_KEY` | Optional. Powers the "AI feedback" button on an entry — Gemini watches the set and returns a 1-5 rating plus a few sentences of coaching feedback on form. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Leave unset to hide/disable the feature (it fails gracefully with a clear error if a request is made without it). |
| `YOUTUBE_COOKIES` | Optional. Lets the AI-feedback feature fetch a YouTube entry's video itself instead of asking Gemini to (see [AI feedback](#ai-feedback-gemini) below for why, and how to get this value — it's a real login session, handle it like a credential). Leave unset to skip. |

### 2. Set up Vercel Postgres (Neon) and Blob storage

```bash
vercel link
```

Blob storage (first-party Vercel product, no extra sign-up):

```bash
vercel blob create-store rep-log-media --access public --yes
```

Postgres is provided through Neon on Vercel's integration marketplace. This step requires
accepting Neon's terms of service in a browser first (a one-time step tied to your Vercel
account — the CLI can't do this on your behalf):

```bash
vercel integration add neon
```

The command will print a `verification_uri` — open it, accept the terms, then re-run the
same command to finish provisioning. Once it succeeds, pull the resulting env vars down:

```bash
vercel env pull .env.local
```

### 3. Install dependencies and set up the database schema

```bash
npm install
npx prisma migrate dev --name init
```

`prisma migrate dev` creates the `WorkoutEntry`/`User`/`LoginAttempt` tables in your Postgres
database and generates the Prisma Client. Re-run `npx prisma migrate deploy` (not `dev`) in
CI/production if you ever change `prisma/schema.prisma`.

Then run the one-time seed script to create the admin account from `SITE_PASSWORD`/
`VISITOR_PASSWORD`:

```bash
node scripts/seed-admin.js
```

It's idempotent — safe to re-run — and does nothing if an admin account already exists. The
admin's username defaults to `admin`; set `ADMIN_USERNAME` before running the script to pick your
own (e.g. `ADMIN_USERNAME=orr node scripts/seed-admin.js`).

### 4. Run it locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and log in with your admin username
(`ADMIN_USERNAME`, or `admin` if unset) and `SITE_PASSWORD`.

### 5. Deploy to Vercel

```bash
vercel deploy --prod
```

Make sure `SITE_PASSWORD` (and `VISITOR_PASSWORD`, if you want the admin to have visitor access
seeded automatically) are set as production environment variables in the Vercel dashboard (Project
Settings → Environment Variables) — `vercel env pull` only pulls variables *from* Vercel, it won't
push your local values there for you. Run `node scripts/seed-admin.js` once against production too
(point `DATABASE_URL` at it) after the first deploy that includes the `User` table migration.
Afterward, `VISITOR_PASSWORD` can be removed from Vercel's environment variables — it's a one-time
seed value with no runtime use once the admin account exists.

**Gotcha to avoid:** don't ever let `SITE_PASSWORD` end up unset/empty in production — since it
also keys the session-cookie signature (see [src/lib/auth.ts](src/lib/auth.ts)), an empty value
is a real weak spot even after it stops gating login directly, and `vercel env pull` won't warn
you if it's blank. Double-check the value is non-empty any time you touch env vars in the
dashboard.

## Accounts

Rep Log is multi-tenant: the **admin** (seeded above) can create additional accounts from the
Settings page (the gear icon in the header), each with its own username, password, and its own
logically isolated log — same features, separate entries. Every account, admin included, can
change its own login password and set/update/remove its own personal visitor (read-only) password
from Settings. The admin can also reset any account's password (but never sees the existing one,
since only hashes are ever stored) — useful if someone forgets theirs.

Login takes a username and password, like most sites. Usernames are unique per account, but
passwords no longer need to be — each account's password is only ever checked against that
account, not scanned across every account in the system. Passwords must meet a standard
complexity rule: at least 8 characters, with an uppercase letter, a lowercase letter, a number,
and a symbol.

Login attempts are rate-limited ([src/lib/rate-limit.ts](src/lib/rate-limit.ts)) by the
**(IP, username) pair**: 5 failed attempts from the same IP against the same username blocks
further attempts for 15 minutes, tracked in the `LoginAttempt` table. Tracking the pair rather
than either alone is deliberate — usernames aren't secret, so limiting by username alone would
let anyone lock the real owner out just by failing repeatedly from a different IP. A successful
login clears the count for that pair.

### Resetting a forgotten password

There's no self-service "forgot password" flow in the app (no email is ever configured, so
there's no inbox to send a reset link to). Which path applies depends on which account is locked
out:

- **A non-admin account forgot its password**: the admin resets it from the Settings page's user
  management panel — no script needed, this already exists in the app (see
  [Accounts](#accounts) above). The admin never sees the old password, only sets a new one.
- **The admin itself forgot its password**: there's nobody above the admin to reset it from the
  UI, so use [scripts/reset-password.js](scripts/reset-password.js) instead:

  ```bash
  node scripts/reset-password.js <username> <newPassword>
  ```

  This also works for any account, not just the admin's, but it's really meant as the admin's own
  break-glass path — for everyone else, resetting from Settings is simpler and doesn't require
  database access.

The script is deliberately **not** an API route or anything reachable from the hosted website —
it only works if you already have `DATABASE_URL` (from `.env.local` for the local database, or a
production `DATABASE_URL` pulled/pasted in to target the live one). That's the same trust
boundary as everything else that touches the database directly (like
[scripts/seed-admin.js](scripts/seed-admin.js)): nobody can trigger this from the internet, only
someone who already holds your database credentials, so it adds no new attack surface to the
running site. It enforces the same password complexity rule as the rest of the app and refuses to
run against a username that doesn't exist, but it does not require knowing the current password —
that's the whole point, it's the break-glass path for when you don't.

### Public visitor profile (optional)

The admin can flip a toggle in Settings ("Make my log publicly viewable") to let anyone browse
their log read-only at `/visitor` — no login required. It's off by default, and the login page
only shows a "View public profile" button when it's on.

This is a deliberately separate code path from the rest of the app, not a "public mode" flag
threaded through the authenticated pages — every `/visitor/*` page and `/api/public/*` route
([src/lib/public-scope.ts](src/lib/public-scope.ts)) independently re-checks the toggle on every
request (so turning it off immediately blocks access, even for someone with the URL already
bookmarked), never reads the session cookie, never accepts a request body, and the API routes
don't export anything but `GET` — there is no delete/edit/create capability anywhere on this
surface, for any account, admin included.

## Video uploads (admin-toggleable)

By default, logging a set lets you either upload a video file directly (stored in Vercel Blob)
or paste a YouTube link. The admin can flip a toggle in Settings ("Allow direct video uploads")
to turn off direct uploads app-wide, leaving YouTube links as the only way to attach a video —
useful for keeping Blob storage usage down. It applies to every account, not just the admin's.

The setting is enforced server-side in two places, not just hidden in the UI: the Blob upload-token
endpoint ([src/app/api/blob/upload/route.ts](src/app/api/blob/upload/route.ts)) and the entry
creation endpoint ([src/app/api/entries/route.ts](src/app/api/entries/route.ts)) both reject
with a 403 if a direct upload is attempted while the toggle is off, so the block holds even against
a raw API call. Editing an entry that already has an uploaded video still works as before —
the toggle only blocks *new* uploads.

## AI feedback (Gemini)

The "Get AI feedback" button on an entry sends the video to Gemini (`gemini-3.6-flash`) and asks
for a 1-5 rating plus a few sentences of coaching feedback on form — range of motion, joint
alignment/safety, tempo and control, breathing, and exercise-specific technique — see
[src/lib/gemini.ts](src/lib/gemini.ts). Judging workout form is a *visual* task, unlike judging a
piano take, which is mostly an audio one — so unlike an audio-only pipeline, this always sends
Gemini the actual video, ignoring whatever audio is present (grunting, gym noise, music).

- **Uploaded video files** are fetched from Blob storage and pushed to Gemini's Files API
  directly (no external indexing dependency), so this path is reliable as soon as an entry
  exists.
- **YouTube links** are handled by downloading the video ourselves with a bundled `yt-dlp` binary
  ([src/lib/ytdlp.ts](src/lib/ytdlp.ts)) — capped at 720p (`bestvideo[height<=720]+bestaudio`,
  merged to mp4) to keep the download/upload reasonably sized — rather than asking Gemini to
  fetch the video (which only works once Google's own systems have indexed it — a real problem
  for a video you just uploaded). If yt-dlp can't get the video for any reason (including that the
  bestvideo+bestaudio merge needs `ffmpeg` on `PATH`, which Vercel's Node runtime doesn't bundle by
  default), it falls back to handing Gemini the URL directly.

  **YouTube blocks requests from cloud/datacenter IPs** (including Vercel's) with a
  "confirm you're not a bot" challenge, so yt-dlp will fail on Vercel *unless* you supply
  cookies from a real, logged-in YouTube session:

  1. Log into YouTube in a normal browser tab.
  2. Export cookies for `youtube.com` in Netscape cookie-file format — a browser extension
     like "Get cookies.txt LOCALLY" does this in one click.
  3. Set the exported file's contents as the `YOUTUBE_COOKIES` environment variable
     (as one value, newlines and all).

  **Treat this like any other login credential** — it's a live session for a real Google
  account, not a purpose-made API key. Consider using a secondary/throwaway Google account
  for this rather than your main one, and expect to periodically re-export the cookies as
  the session expires. Leave `YOUTUBE_COOKIES` unset to skip this entirely — the feature
  still works for uploaded files and for already-indexed YouTube videos either way.

## Comments

Both the account owner and anyone signed in with that account's visitor password can leave a
comment on an entry (`src/components/comments-section.tsx`) — a lightweight guestbook, not a
threaded discussion. There's no separate identity behind the visitor password, so a comment just
records which role posted it (shown as an "Owner"/"Visitor" badge) plus an optional free-text name
the poster can type in themselves. Only the owner can delete a comment.

This is deliberately scoped to the authenticated visitor-password flow only — it does **not**
extend to the fully public, no-login `/visitor/*` mirror described above, so an anonymous visitor
with just the public link can't post anything. Middleware blocks every mutating API call for the
visitor role except one explicit carve-out (`POST /api/entries/[id]/comments` —
see `VISITOR_ALLOWED_MUTATION_PATTERNS` in [src/middleware.ts](src/middleware.ts)); deleting
(`DELETE /api/entries/[id]/comments/[commentId]`) stays outside that carve-out and is also
double-checked for `role === "owner"` in the handler itself.

## Climbing mode

A personal, per-account toggle in Settings ("Climbing mode") — not admin-gated, since it's about
what an individual account trains, not an app-wide policy. Read fresh from the database on every
request (`isClimbingModeEnabled()` in [src/lib/users.ts](src/lib/users.ts)), same as the other
toggles, so flipping it takes effect immediately without needing to log back in. Turning it on
switches that account's whole logging experience:

- The entry form swaps the Weight field for a **Gym** field (autocompleted from your own logged
  gyms) and a **Grade** picker.
- Grades are a fixed **V-scale** (V0–V17), stored as an integer rather than free text, so "best
  grade" and "hardest first" sorting stay well-defined. Climbing has several incompatible grading
  systems (V-scale, YDS, French/Font); mixing free-text notations would make ranking meaningless,
  so this app picks one rather than trying to normalize across all of them.
- `/records` becomes a per-gym table: your hardest grade sent at each gym, how many times you've
  sent that grade there, and a link straight to the earliest entry that reached it.
- The library groups entries into "stacks" by gym+grade instead of exercise name, sorted
  hardest-first by default instead of newest-first.
- The `/exercise` progression page accepts either `?name=` (regular mode) or `?gym=&grade=`
  (climbing mode) and adapts its labels (sends vs. sets, first/latest send, attempts) accordingly.
- The dashboard's weekly section becomes "This week's sends" instead of "This week's weighted
  lifts," and route/problem-name and tag autocomplete switch to a climbing-appropriate catalog
  (`COMMON_CLIMBING_TAGS` in [src/lib/climbing.ts](src/lib/climbing.ts)) instead of the
  weightlifting one — route names in particular have no sensible "common" catalog the way
  exercises do, so climbing mode only suggests from what you've actually logged before.

Existing weight-based entries aren't touched by the toggle: `gym`/`grade` are nullable columns, so
an account can flip the toggle at any time without losing or reinterpreting anything already
logged — new entries just start using whichever field set is active.

## Staying on the free tier

- **Uploads are capped at 100MB** in the UI (`MAX_UPLOAD_BYTES` in
  [src/lib/validation.ts](src/lib/validation.ts)), with a note recommending YouTube links
  for longer sessions — this keeps you well under Vercel Blob's free storage allowance even
  with dozens of sets logged. Uploads go straight from the browser to Blob storage (via
  `@vercel/blob/client`'s `handleUpload`/token flow), bypassing Vercel's serverless function
  body-size limit entirely, so the 100MB cap is a storage-budget choice, not a technical
  ceiling.
- **Neon's free tier** has limits on storage and active compute time; a personal training log
  with metadata-only rows (no video bytes in the database) stays tiny for a very long time.
- Check the current Vercel Blob and Neon pricing pages before you scale this up — free-tier
  limits change over time and aren't hard-coded into this app.

## Project structure

- `prisma/schema.prisma` — the `WorkoutEntry`, `User`, and `LoginAttempt` models
- `src/middleware.ts` — session check on every route: unauthenticated → redirect/401,
  visitor role → blocked from mutations and owner-only pages, non-admin → blocked from
  `/api/users*` (Next.js has deprecated the `middleware.ts` convention in favor of
  `proxy.ts`; this still works, just expect a build-time deprecation warning)
- `src/lib/auth.ts`/`src/lib/session.ts` — signed session cookie (`{userId, role, isAdmin}`)
  via Web Crypto HMAC, edge-runtime-safe for use in middleware
- `src/lib/users.ts`/`src/lib/password-hash.ts` — account CRUD, password hashing (scrypt);
  Node-only, used from Route Handlers. Every `User` query uses an explicit Prisma `select`
  that only includes `passwordHash`/`visitorPasswordHash` when that field is actually needed.
- `src/lib/rate-limit.ts` — login rate limiting by the (IP, username) pair
- `src/lib/public-scope.ts` — the single toggle-check gating the whole public visitor surface
- `src/lib/gemini.ts`/`src/lib/ytdlp.ts`/`src/lib/youtube.ts` — AI feedback: Gemini calls,
  YouTube video download, and YouTube URL/ID parsing
- `src/lib/stats.ts` — streak, training-time, grouping, personal-record, and
  "last N days" calculations shared by the dashboard, stats, and records pages
- `src/lib/exercise-catalog.ts` — static seed lists (`COMMON_EXERCISES`, `COMMON_TAGS`) merged
  at the UI layer with an account's own logged history to power autocomplete
- `src/lib/climbing.ts` — climbing mode: the V-scale grade catalog, per-gym record calculation,
  and gym+grade stack-grouping, plus the climbing-specific tag catalog — see
  [Climbing mode](#climbing-mode)
- `scripts/seed-admin.js` — one-time rollout script, see [Accounts](#accounts)
- `scripts/reset-password.js` — local-only break-glass password reset, see
  [Resetting a forgotten password](#resetting-a-forgotten-password)
- `scripts/generate-favicon.js` — local-only tool that rasterizes `src/app/icon.svg` into
  `src/app/favicon.ico`; rerun it by hand if you ever change the icon (not part of the app itself)
- `src/app/api/*` — entries CRUD (scoped per account), entry comments (owner + visitor can post,
  owner-only delete), Blob upload token endpoint, login/logout, facets (distinct exercises/tags/
  gyms for filters and autocomplete), `users/*` (account management and personal toggles like
  climbing mode, admin-only where noted in-handler), `public/*` (read-only, unauthenticated, see
  [Public visitor profile](#public-visitor-profile-optional))
- `src/app/*` — dashboard, `/new`, `/library`, `/exercise` (progression view + PR badge, or the
  gym+grade group view in climbing mode), `/records` (all-time PR table, or per-gym table in
  climbing mode), `/entries/[id]` (+ `/edit`, + comments), `/stats`, `/settings` (account + user
  management + climbing mode toggle), `/visitor/*` (public mirror of the same pages, scoped to
  the admin's log instead of a session — comments excluded, see [Comments](#comments))

## License

[MIT](LICENSE)
