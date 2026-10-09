# Migration report — Blob → R2, backup, fresh-start prep (2026-10-09)

_In progress. Final summary and morning steps are added at the end of the run._

## Step 1 — Investigation
- Baseline: `tsc --noEmit` clean, `eslint` clean (after `npm ci`; `node_modules` was missing).
- Prisma models (9): User, WorkoutEntry, EntryVideo, WorkoutPlan, ExerciseCategory, ExercisePreset,
  ManualRecord, Comment, LoginAttempt. Plus Prisma's own `_prisma_migrations` table.
- Context confirmed: client `upload()` in both components, token route at `api/blob/upload` with the
  described checks, three `del()` calls in `api/entries/[id]/route.ts`.
- `src/lib/users.ts` imports `@vercel/blob` for `deleteUserCascade()`, which deletes a removed
  account's uploaded videos (primary and extra) before deleting the user.
- `scripts/seed-admin.js` creates the first admin from `SITE_PASSWORD` (required), `VISITOR_PASSWORD`
  (optional) and `ADMIN_USERNAME` (optional, default `admin`). It's idempotent and skips if an admin exists.
- **This machine's network blocks outbound port 5432**, so the plain Prisma engine can't reach Neon.
  The backup, import, wipe and seed scripts now reach remote databases with `@prisma/adapter-neon`
  (WebSockets over 443). The deployed app is unaffected because Vercel can reach 5432.
