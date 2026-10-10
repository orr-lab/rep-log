# Rep Log

A password-gated training log for workout videos. Upload a video (or paste a YouTube link) after
each set, tag it, rate how hard it felt, log the weight/sets/reps, and watch your progress on an
exercise over time. It's multi-tenant — an admin account can create additional logins, each with
its own fully isolated log — and includes an optional read-only public link for sharing your
training log without giving out a password.

The admin's log is also viewable read-only, without signing in, at `/visitor`, when that's turned
on (see [Public visitor profile](#public-visitor-profile-optional)).

**Live at [replog.orrknaan.com](https://replog.orrknaan.com).**

Built with Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Prisma + Postgres, Cloudflare R2
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
  number, like cardio), sets, reps, perceived exertion (1-10), tags (also autocompleted),
  free-text notes, and a sent/completed toggle (see [below](#marking-an-attempt-unsuccessful)),
  attached to either an uploaded video file or a YouTube link.
- **Progress tracking**: a dashboard with streaks, training-time totals, and a "this week's
  weighted lifts" section; a library with search/filter/sort; and a per-exercise view showing
  every set of the same exercise over time, plus that exercise's personal record (PR).
- **Personal records**: a `/records` table listing your all-time heaviest logged set for every
  exercise, sorted heaviest-first, linking straight to the entry that set each record — plus an
  "Add record" button to backfill a PR directly, with no logged entry or video required — see
  [Manual records](#manual-records).
- **Climbing mode**: an optional per-account toggle that switches the whole logging experience —
  entry form, records, library — to gyms and V-scale grades instead of weight — see
  [Climbing mode](#climbing-mode).
- **Workout plans**: a weekly calendar where the owner or an authenticated visitor can propose an
  exercise for a given day; the owner can then log it with one click, pre-filled from the plan —
  see [Workout plans](#workout-plans).
- **Manual records**: add a PR straight to the records page without logging a full video entry —
  useful for backfilling a lift from before you started using the app — see
  [Manual records](#manual-records).
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
logging climbs, never a per-entry mix. It also holds `succeeded` (default `true`) — see
[Marking an attempt unsuccessful](#marking-an-attempt-unsuccessful).

A **WorkoutPlan** is a separate, much lighter row: a proposed exercise for a specific day, with an
optional `fulfilledEntryId` pointing at the `WorkoutEntry` that was actually logged for it (see
[Workout plans](#workout-plans)). Plans and entries are otherwise unrelated — a plan is a proposal,
not a draft entry, so it doesn't carry video/tags/exertion/favorite at all.

A **ManualRecord** is lighter still: just enough to rank as a PR (exercise/gym+grade, weight or
grade, a date, optional notes/link) with no video, sets/reps, exertion, or tags at all. It never
appears in the library or dashboard — it only ever competes to be shown as the best record for its
exercise or gym on `/records` (see [Manual records](#manual-records)).

## Setup

### Prerequisites

- Node.js 20+
- A Vercel account (for hosting and Postgres) — the free/Hobby tier covers this app
- A Cloudflare account with an R2 bucket for uploaded videos
- The [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`), logged in (`vercel login`)

### 1. Environment variables

Copy `.env.example` to `.env.local` (or use the values already pulled if you ran `vercel link` +
`vercel env pull`, see below):

| Variable | Where it comes from |
|---|---|
| `SITE_PASSWORD` | Pick your own password. This seeds the **admin** account the first time `scripts/seed-admin.js` runs (see [Accounts](#accounts) below) — after that, it no longer gates login directly (the admin changes their password from the Settings page instead), but it must stay set, since it also keys the session-cookie signature. Don't remove or rotate it later without expecting everyone to be logged out. |
| `VISITOR_PASSWORD` | Optional. Seeds the admin's own visitor (read-only) password at the same one-time seeding step. Unlike `SITE_PASSWORD`, it has no ongoing role afterward — it's only ever read by `scripts/seed-admin.js`, which skips entirely once an admin account already exists. Once you've seeded (or if you don't need the admin to have visitor access), it's safe to leave unset or delete from your environment entirely; the live visitor password is managed from Settings from then on. |
| `DATABASE_URL` | From your Postgres provider (Neon via Vercel Marketplace, or any Postgres). Pulled automatically by `vercel env pull` once connected. |
| `R2_ACCOUNT_ID` | Your Cloudflare account ID (Cloudflare dashboard → R2 → Overview). Used to build the S3 endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | An R2 API token with **Object Read & Write** on the video bucket only (R2 → Manage API tokens). Server-only: they sign upload URLs and delete objects, and never reach the browser. |
| `R2_BUCKET` | The bucket name, e.g. `rep-log-videos`. |
| `R2_PUBLIC_BASE_URL` | The bucket's public custom domain, e.g. `https://media.example.com` (no trailing slash). Stored video URLs are `R2_PUBLIC_BASE_URL/videos/<random>.mp4`, so changing this later breaks existing entries' URLs. |
| `GEMINI_API_KEY` | Optional. Powers the "AI feedback" button on an entry — Gemini watches the set and returns a 1-5 rating plus a few sentences of coaching feedback on form. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Leave unset to hide/disable the feature (it fails gracefully with a clear error if a request is made without it). |
| `YOUTUBE_COOKIES` | Optional. Lets the AI-feedback feature fetch a YouTube entry's video itself instead of asking Gemini to (see [AI feedback](#ai-feedback-gemini) below for why, and how to get this value — it's a real login session, handle it like a credential). Leave unset to skip. |

### 2. Set up Vercel Postgres (Neon)

```bash
vercel link
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

### 3. Set up Cloudflare R2 (video storage)

1. In the Cloudflare dashboard, create an R2 bucket (R2 → Create bucket). The free tier
   (10 GB stored, no egress fees) is plenty for this app.
2. Connect a **custom domain** to the bucket (bucket → Settings → Custom Domains). The domain has
   to be on Cloudflare, and it becomes your `R2_PUBLIC_BASE_URL`. Use a custom domain rather than
   the rate-limited `r2.dev` URL.
3. Add a CORS policy (bucket → Settings → CORS policy) so the browser can PUT straight to R2:

   ```json
   [
     {
       "AllowedOrigins": ["https://your-app-domain.example", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type", "cache-control"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   `cache-control` has to be allowed. Every upload sends a signed `Cache-Control` header (see
   [Video storage](#video-storage-cloudflare-r2)), and the browser's preflight fails without it.
4. Create an API token (R2 → Manage API tokens) with **Object Read & Write**, scoped to this
   bucket, and put its access key ID and secret in `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`.
5. Check the setup with `npx tsx scripts/r2-healthcheck.ts [--origin https://your-app-domain]`.
   It PUTs a `_healthcheck.txt` object, reads it back through the custom domain, sends a
   browser-style CORS preflight, and then deletes the test object. It prints pass/fail only.
6. Add a lifecycle rule so abandoned uploads expire (bucket → Settings → Object lifecycle rules →
   Add rule): name it `expire-pending-uploads`, set the prefix to `pending/`, turn on **Delete
   uploaded objects** after **1 day**, and save. New uploads wait under `pending/` until their
   entry is saved (see [Video storage](#video-storage-cloudflare-r2)). Get the prefix right: a rule
   without a prefix applies to the whole bucket and would delete saved videos too.

### 4. Install dependencies and set up the database schema

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

### 5. Run it locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and log in with your admin username
(`ADMIN_USERNAME`, or `admin` if unset) and `SITE_PASSWORD`.

### 6. Deploy to Vercel

```bash
vercel deploy --prod
```

Make sure `SITE_PASSWORD`, the five `R2_*` variables (and `VISITOR_PASSWORD`, if you want the
admin to have visitor access seeded automatically) are set as production environment variables in the Vercel dashboard (Project
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

By default, logging a set lets you either upload a video file directly (stored in Cloudflare R2)
or paste a YouTube link. The admin can flip a toggle in Settings ("Allow direct video uploads")
to turn off direct uploads app-wide, leaving YouTube links as the only way to attach a video —
useful for keeping storage usage down. It applies to every account, not just the admin's.

The setting is enforced server-side in two places, not just hidden in the UI: the R2 upload-URL
endpoint ([src/app/api/r2/upload-url/route.ts](src/app/api/r2/upload-url/route.ts)) and the entry
creation endpoint ([src/app/api/entries/route.ts](src/app/api/entries/route.ts)) both reject
with a 403 if a direct upload is attempted while the toggle is off, so the block holds even against
a raw API call. Editing an entry that already has an uploaded video still works as before —
the toggle only blocks *new* uploads.

## Video storage (Cloudflare R2)

Uploaded videos live in a public Cloudflare R2 bucket, served from its custom domain. The
database stores the plain public URL, so playback and the AI-feedback fetch are ordinary GETs.
Video bytes never pass through a Vercel function:

1. The browser compresses the file (see [Video compression](#video-compression)).
2. It asks [`/api/r2/upload-url`](src/app/api/r2/upload-url/route.ts) for an upload URL, sending
   only the content type and size. The route requires a session, checks the uploads toggle, the
   size cap and a video content-type allowlist, then returns a 15-minute presigned PUT
   ([src/lib/r2.ts](src/lib/r2.ts)) along with the headers the browser must send.
   `Content-Type`, `Content-Length` and `Cache-Control` are signed into the URL, so R2 rejects
   (403) any upload of a different size or type. R2 has no POST policies, so this is how the size
   cap is enforced.
   The object key is `pending/<random>.mp4`, and the response also carries an **upload token**:
   an HMAC (keyed off `SITE_PASSWORD`) over that key, the user's id and a 20-hour expiry.
3. The browser PUTs the file straight to R2 with `XMLHttpRequest` (for upload progress, see
   [src/lib/r2-upload.ts](src/lib/r2-upload.ts)).
4. Saving the entry (create or edit, primary or extra video) sends the pending URL together with
   its token. The entry route checks the token belongs to this user and matches the URL, checks
   the pending object exists, copies it to `videos/<same random>.mp4` (CopyObject, keeping
   Content-Type and Cache-Control), writes the `videos/` URL to the database, and then deletes the
   pending object ([src/lib/pending-uploads.ts](src/lib/pending-uploads.ts)). If the database
   write fails, the copy is removed again.

So `videos/` only ever holds videos that an entry references. An upload whose form is abandoned
stays under `pending/` until the bucket's lifecycle rule deletes it (setup step 6). "Choose a
different file", switching to a YouTube link, and removing an unsaved extra video delete their
pending object straight away through [`/api/r2/discard`](src/app/api/r2/discard/route.ts), which
also needs the token.

The entry routes never accept a client-supplied upload URL on its own. An `UPLOAD` video has to
be either a pending upload with a valid token, or (on edit only) one of that same entry's
existing videos. YouTube videos can't point into the bucket.

Details:

- **Keys are `pending/` or `videos/` + `<24 random hex chars>.mp4`**, with nothing from the original filename.
  Phone cameras name files after the recording time (`PXL_20260921_144039930.mp4`), and these
  URLs are public. They can't be guessed, but anyone who has one can watch the video.
- **Every object is stored with `Cache-Control: public, max-age=300`**
  (`VIDEO_CACHE_CONTROL` in [src/lib/r2.ts](src/lib/r2.ts)), so Cloudflare's edge stops serving a
  deleted video within about 5 minutes. Note that Cloudflare's zone-level **Browser Cache TTL**
  setting (Caching → Configuration, 4 hours by default) rewrites the `max-age` that browsers see.
  So someone who already watched a video can keep replaying it from their own browser cache for
  up to 4 hours. Set Browser Cache TTL to "Respect Existing Headers" if that matters to you.
  Objects uploaded before this change don't have the header.
- **Deleting** an entry (or one of its extra videos, or a whole account) deletes its R2 objects
  once the database write has committed ([src/lib/video-storage.ts](src/lib/video-storage.ts)).
  This is best-effort: a failed delete is logged and never blocks the database change. URLs
  that aren't in the bucket (YouTube) are left alone.

## AI feedback (Gemini)

The "Get AI feedback" button on an entry sends the video to Gemini (`gemini-3.6-flash`) and asks
for a 1-5 rating plus a few sentences of coaching feedback on form — range of motion, joint
alignment/safety, tempo and control, breathing, and exercise-specific technique — see
[src/lib/gemini.ts](src/lib/gemini.ts). Judging workout form is a *visual* task, unlike judging a
piano take, which is mostly an audio one — so unlike an audio-only pipeline, this always sends
Gemini the actual video, ignoring whatever audio is present (grunting, gym noise, music).

- **Uploaded video files** are fetched from R2 storage and pushed to Gemini's Files API
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

## Workout plans

A weekly calendar at `/plan`, showing the current Sunday–Saturday week as seven day-slots. Both
the owner and anyone signed in with the account's visitor password can add a plan to any day — a
proposed exercise with a name, grade or weight, sets/reps, notes, and a reference link (e.g. a
beta video or article — distinct from the actual proof-of-workout video attached to a logged
entry). This is deliberately part of the *authenticated* visitor flow only, like
[comments](#comments) — the fully public, no-login `/visitor` mirror has no plan surface at all,
and there's no `/visitor/plan` route.

The owner sees the same calendar and can turn any unfulfilled plan into a real log entry with one
click: "Log this" opens `/new?planId=…`, which pre-fills the exercise name, grade/weight,
sets/reps, and notes from the plan (everything except gym and video, which are decided at logging
time, not planning time) and shows the plan's notes/link in a small reference card above the form.
Saving that entry links the plan to it (`fulfilledEntryId`, set atomically in the same request as
creating the entry — see `POST /api/entries` in
[src/app/api/entries/route.ts](src/app/api/entries/route.ts)), so the calendar then shows that day
as done with a link straight to the entry.

Permissions mirror comments' pattern: a visitor can create plans and delete their own unfulfilled
ones (to correct a mistake), but not a plan that's already been fulfilled or one the owner added;
the owner can delete any plan for their own account at any time. Deleting a plan never deletes the
entry it points to — the two are only loosely linked (`onDelete: SetNull` on `fulfilledEntryId`),
so removing an entry later just unlinks its plan rather than deleting the plan's history.

## Marking an attempt unsuccessful

Every entry has a "Sent it" (climbing mode) / "Completed successfully" toggle, on by default. Turn
it off for an attempt that didn't actually land — you missed the lift, or didn't send the
route/problem. An unsuccessful entry still shows up everywhere a normal entry does (library,
dashboard, entry detail, comments, AI feedback), badged so it's clearly not a make — the point is
an instructor or training partner can still review the attempt on video. The one place it's
excluded is the records calculation: `personalRecords()` and `gymRecords()` (both in
[src/lib/stats.ts](src/lib/stats.ts) / [src/lib/climbing.ts](src/lib/climbing.ts)) filter out
unsuccessful entries before ranking, so a failed attempt at a new PR weight or grade can't silently
become your new record.

## Manual records

The `/records` page has an "Add record" button (owner only) for entering a PR directly — no video,
no full entry, just the exercise (or gym/grade), the weight (or grade), the date you hit it, and
optional notes/a reference link. It's meant for backfilling: a lift or send from before you started
using this app, or one you simply never filmed. This is especially useful on the weightlifting
side, where a PR is much more likely to predate the app than a climbing send is.

A manual record only ever competes to be the best record shown for its exercise/gym — it's merged
in alongside logged entries by `personalRecords()`/`gymRecords()` and wins if it's actually the
heaviest/hardest, same as any entry would. It never appears in the library, dashboard, or timeline
views, and unlike a logged entry's PR (which links to the entry itself), a manual record's row
links to its optional reference link instead, or nothing if none was given. Reading manual records
requires just being signed in (owner or visitor) — they show up in the records table on the public
`/visitor` mirror the same way logged records do — but creating or deleting one is owner-only,
unlike comments and plans, since a visitor shouldn't be able to fabricate an account's PR history.

## Video compression

Uploaded videos are compressed client-side before they ever reach R2 storage, in
[src/lib/video-compress.ts](src/lib/video-compress.ts). `compressVideo()` tries two paths, in
order:

1. **WebCodecs** ([src/lib/video-compress-webcodecs.ts](src/lib/video-compress-webcodecs.ts)) --
   hardware-accelerated decode/encode via the browser's own codecs, roughly 10-15x faster than
   the ffmpeg.wasm path in testing since it can use the device's actual video hardware instead of
   pure software. [mp4box.js](https://github.com/gpac/mp4box.js) demuxes the source container and
   extracts raw samples (plus the avcC/hvcC decoder config WebCodecs needs, and the track's
   rotation matrix); WebCodecs decodes, scales via canvas, and re-encodes to H.264; audio is
   passed through untouched rather than re-encoded (MP4 stores raw AAC access units, which
   [mp4-muxer](https://github.com/Vanilagy/mp4-muxer)'s `addAudioChunkRaw()` accepts directly --
   both simpler and higher quality than re-encoding). Rotation is preserved as container metadata
   (mp4-muxer's `rotation` option) rather than baked into pixels, since WebCodecs VideoFrames come
   out in the source's stored orientation, unlike ffmpeg which auto-rotates before its filters
   run.
2. **ffmpeg.wasm** (below `compressVideoWebCodecs` in the same file) -- H.264/AAC, capped at
   720p/30fps, CRF 28, via [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm). This is the
   fallback for any WebCodecs failure: unsupported browser, unsupported source codec, no hardware
   encoder available, or any other error. Uses the single-threaded ffmpeg.wasm core specifically
   (self-hosted from `public/ffmpeg/`, copied from `@ffmpeg/core`'s **ESM** build in
   `dist/esm/`, because the UMD build can't load in the module worker that `@ffmpeg/ffmpeg` starts) -- a
   multi-threaded core (`@ffmpeg/core-mt`, which needs cross-origin-isolation headers app-wide)
   was tried and reverted, since self-hosted this way it reliably hung indefinitely during its
   worker-thread pool init rather than actually completing a transcode.

Neither path can hang forever:

- **WebCodecs** gives up after 20 seconds without decoding or encoding a frame. This is what
  catches Safari on macOS, where a flush could decode every frame and then never finish, leaving
  the form stuck on "Compressing... 100%".
- **ffmpeg** gives up if its core takes over 90 seconds to load, or if a running encode logs
  nothing for 30 seconds. In that case the worker is terminated.

The failure reason shows in a toast that stays up until dismissed.

If both paths fail (an unsupported format, a browser without WASM/WebCodecs support, a bug, a
stall), the original file uploads as-is instead of blocking the set from being logged at all.

Because the video is already shrunk before it's uploaded, the raw-file cap can afford to be
generous — 2048MB (2GB) by default, covering even a multi-minute 4K phone recording — while what
actually lands in (and gets billed against) R2 storage stays modest. This cap is admin-only and
app-wide, same pattern as the video-uploads toggle: `maxUploadMB` on the admin's `User` row, set
from Settings → Storage, read via `getMaxUploadBytes()` in
[src/lib/users.ts](src/lib/users.ts). It drives both the client-side dropzone's rejection check
and the R2 upload-URL route's size check (see
[src/app/api/r2/upload-url/route.ts](src/app/api/r2/upload-url/route.ts)), so raising or lowering it
in Settings takes effect immediately for every account, no redeploy needed — and it has to cover
the "compression failed, uploading the original" fallback path too, not just the common case.

## Staying on the free tier

- **Uploads are compressed client-side; the raw-file cap is admin-configurable** (2048MB/2GB by
  default) — see [Video compression](#video-compression) above. Uploads go straight from the
  browser to R2 (via a short-lived presigned PUT URL), bypassing
  Vercel's serverless function body-size limit entirely.
- **Neon's free tier** has limits on storage and active compute time; a personal training log
  with metadata-only rows (no video bytes in the database) stays tiny for a very long time.
- Check the current Cloudflare R2 and Neon pricing pages before you scale this up — free-tier
  limits change over time and aren't hard-coded into this app.

## Maintenance scripts (backup, export, import, wipe)

These scripts run locally with `npx tsx` and read `DATABASE_URL` (and `R2_*`) from `.env.local`.
They write only to `backup/`, which is git-ignored and must never be committed: it holds videos and
full database exports, password hashes included. They print counts and pass/fail only, never row
contents, URLs or secrets.

**They connect to Neon over port 443.** Plain Prisma needs outbound port 5432, which some networks
block. These scripts use the Neon serverless driver over WebSockets on port 443 instead
(`@prisma/adapter-neon`, see [scripts/lib/db-client.ts](scripts/lib/db-client.ts)), and fall back
to the normal Prisma engine for a `localhost` URL. `scripts/seed-admin.js` does the same. The
deployed app isn't affected. `npx prisma migrate ...` still needs port 5432, so run migrations
from a network that allows it.

| Script | What it does |
|---|---|
| [`scripts/export-db.ts`](scripts/export-db.ts) | **Backup.** Read-only. Exports every row of every table to `backup/db/<Model>.json`, plus `_prisma_migrations`, the schema, the migrations folder and `counts.json`. Each table's count is checked against `SELECT COUNT(*)`. |
| [`scripts/import-db.ts`](scripts/import-db.ts) | **Restore.** `--target-url "<postgres url>" [--dir backup/db] [--allow-remote]`. Loads an export into an already-migrated, **empty** database in one transaction, keeping ids and timestamps, then checks the row counts. It refuses any database that already has rows, and any non-localhost target unless you pass `--allow-remote`. |
| [`scripts/wipe-database.ts`](scripts/wipe-database.ts) | **Destructive.** Deletes every row of every table. Schema and migration history are kept (no `DROP`). Requires `--i-have-checked-the-backup` and an existing `backup/db/counts.json`. It shows the live counts next to the backup's and asks you to type `WIPE`. Afterwards, run `node scripts/seed-admin.js` to recreate the admin from `SITE_PASSWORD`. |
| [`scripts/map-backup-videos.ts`](scripts/map-backup-videos.ts) | Local files only. Maps every uploaded-video URL in the export to its file under `backup/videos/` (writes `backup/video-map.json`) and reports orphans in both directions. |
| [`scripts/list-orphaned-videos.ts`](scripts/list-orphaned-videos.ts) | **Read-only.** Lists objects under `videos/` in R2 that no `WorkoutEntry` or `EntryVideo` row references, with size and upload time. Deletes nothing. |
| [`scripts/r2-healthcheck.ts`](scripts/r2-healthcheck.ts) | Checks the R2 setup: a PUT, a public GET, the CORS preflight (including `cache-control`), then deletes its own test object. |
| [`scripts/test-db-scripts-local.ts`](scripts/test-db-scripts-local.ts) | Runs import, a field-by-field compare, a refused second import, and the wipe against an in-memory PGlite database. Never touches a real one. |

The one-off script that downloaded every Vercel Blob object into `backup/videos/`
(`scripts/backup-videos.ts`) was removed along with Blob. It's still in git history. To back up
the R2 bucket, point any S3-compatible tool at it, e.g. `rclone copy`, or
`aws s3 sync --endpoint-url https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.

## Project structure

- `prisma/schema.prisma` — the `WorkoutEntry`, `User`, `Comment`, `WorkoutPlan`, `ManualRecord`,
  and `LoginAttempt` models
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
- `src/lib/video-compress.ts`/`src/lib/video-compress-webcodecs.ts` — client-side video
  compression (WebCodecs first, ffmpeg.wasm fallback), see [Video compression](#video-compression)
- `src/lib/r2.ts`/`src/lib/r2-upload.ts`/`src/lib/video-storage.ts` — R2 client, keys and
  presigned PUTs (server), the browser-side upload, and best-effort deletes, see
  [Video storage](#video-storage-cloudflare-r2)
- `src/lib/video-metadata.ts` — best-effort extraction of an uploaded video's recording date from
  its MP4/MOV container metadata, used to autofill the entry form's date field
- `src/lib/stats.ts` — streak, training-time, grouping, personal-record, and
  "last N days" calculations shared by the dashboard, stats, and records pages —
  `personalRecords()` merges logged entries with [manual records](#manual-records) and skips
  [unsuccessful](#marking-an-attempt-unsuccessful) entries
- `src/lib/plans.ts` — the current-week date range and day-grouping helpers behind `/plan`, see
  [Workout plans](#workout-plans)
- `src/lib/exercise-catalog.ts` — static seed lists (`COMMON_EXERCISES`, `COMMON_TAGS`) merged
  at the UI layer with an account's own logged history to power autocomplete
- `src/lib/climbing.ts` — climbing mode: the V-scale grade catalog, per-gym record calculation
  (same manual-record-merging and unsuccessful-filtering as `personalRecords()`), and gym+grade
  stack-grouping, plus the climbing-specific tag catalog — see [Climbing mode](#climbing-mode)
- `scripts/seed-admin.js` — one-time rollout script, see [Accounts](#accounts)
- `scripts/reset-password.js` — local-only break-glass password reset, see
  [Resetting a forgotten password](#resetting-a-forgotten-password)
- `scripts/*.ts` — backup/export/import/wipe and R2 maintenance scripts, see
  [Maintenance scripts](#maintenance-scripts-backup-export-import-wipe)
- `scripts/generate-favicon.js` — local-only tool that rasterizes `src/app/icon.svg` into
  `src/app/favicon.ico`; rerun it by hand if you ever change the icon (not part of the app itself)
- `src/app/api/*` — entries CRUD (scoped per account, includes the `succeeded` flag), entry
  comments (owner + visitor can post, owner-only delete), `plans/*` (owner + visitor can create,
  finer-grained delete rule enforced in-handler, see [Workout plans](#workout-plans)),
  `manual-records/*` (any session can read, owner-only create/delete, see
  [Manual records](#manual-records)), `r2/upload-url` (presigned R2 upload URLs), login/logout, facets (distinct
  exercises/tags/gyms for filters and autocomplete), `users/*` (account management and personal
  toggles like climbing mode, admin-only where noted in-handler), `public/*` (read-only,
  unauthenticated, see [Public visitor profile](#public-visitor-profile-optional))
- `src/app/*` — dashboard, `/new` (supports `?planId=…` to pre-fill from a plan, see
  [Workout plans](#workout-plans)), `/library`, `/plan` (weekly calendar, see
  [Workout plans](#workout-plans)), `/exercise` (progression view + PR badge, or the gym+grade
  group view in climbing mode), `/records` (all-time PR table, or per-gym table in climbing mode —
  both include manual records, plus an owner-only "Add record" dialog, see
  [Manual records](#manual-records)), `/entries/[id]` (+ `/edit`, + comments), `/stats`,
  `/settings` (account + user management + climbing mode toggle), `/visitor/*` (public mirror of
  the same pages, scoped to the admin's log instead of a session — comments and plans excluded,
  see [Comments](#comments) and [Workout plans](#workout-plans))

## License

[MIT](LICENSE)
