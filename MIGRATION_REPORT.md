# Migration report — Blob → R2, backup, fresh-start prep (2026-10-09)

## Summary

- **Videos backed up: 42 of 42 blobs, 806,611,552 bytes (≈769 MiB).** That's every object in the
  Blob store, found by a paginated `list()`. Each file's size matches the listing, and an
  independent `shasum -a 256 -c` against the manifest passed for all 42. The files are byte-identical,
  with no re-encoding.
  - 33 of the 34 UPLOAD video references in the DB have a local file.
  - **9 orphan blobs** (183,572,144 bytes) aren't referenced by any row. They're backed up anyway.
  - **1 dangling reference:** an `EntryVideo` row whose blob was already gone (HTTP 404) before
    tonight, so there was nothing to back up for it.
- **Database backed up: all 9 tables**, each count checked against `SELECT COUNT(*)` from one
  repeatable-read snapshot:

  | Table | Rows |
  | --- | ---: |
  | User | 3 |
  | WorkoutEntry | 31 |
  | EntryVideo | 3 |
  | WorkoutPlan | 10 |
  | ExerciseCategory | 7 |
  | ExercisePreset | 15 |
  | ManualRecord | 0 |
  | Comment | 3 |
  | LoginAttempt | 2 |
  | `_prisma_migrations` | 11 |

  No `full.sql`: `pg_dump` isn't installed, so I skipped it as instructed.
- **Backup location:** `backup/` in the repo root (git-ignored), ≈770 MB. `backup/README.md`
  explains the layout, the entry → file mapping (`video-map.json`) and how to restore.
- **Restore tested:** `scripts/import-db.ts` restored the export into an in-memory PGlite database.
  All 9 tables came back identical field by field, and a second import into the now non-empty
  database was refused. The same harness ran the wipe logic: every table ended up empty and the
  schema stayed intact.
- **Deployed** (commit `6b59194`, production build Ready): new uploads go to R2. The video
  compression is unchanged, and old Blob videos keep playing and deleting as before.
- **Verified:** R2 health check (S3 PUT, public GET through the custom domain, CORS preflight from
  `https://replog.orrknaan.com`, range requests). A presigned PUT with the wrong size or type gets a
  403. Production loads, and the new route returns 401 without a session. The full upload → entry →
  playback → delete → R2 object gone flow passed 12/12 checks against the real R2 bucket, running
  this commit's build locally. **The same test was not run on production; see Needs Orr #1.**
- **Wipe prepared, NOT run:** `scripts/wipe-database.ts`.
- Nothing remote was deleted except my own R2 test objects. The R2 bucket is empty right now.

## Needs Orr

1. **The production end-to-end upload test wasn't run.** Logging in as the admin with
   `SITE_PASSWORD` from `.env.local` failed (401), so the admin password was changed in the app at
   some point. I made one attempt and didn't retry or forge a session. That attempt added one
   `LoginAttempt` row, and the export above was re-taken afterwards so it includes it. Instead, the
   identical build ran locally against a throwaway database plus the real R2 bucket, and passed. To
   finish it yourself: on https://replog.orrknaan.com, log a new entry with a short clip, open it
   and check it plays, then delete it.
   **Note:** `seed-admin.js` uses `SITE_PASSWORD`, so after the wipe your admin password will be
   whatever `SITE_PASSWORD` is in `.env.local`, not your current one.
2. **This network blocks outbound port 5432**, so plain Prisma (`prisma migrate`, the old
   `seed-admin.js`) can't reach Neon from this Mac. The backup, import, wipe and seed scripts now
   connect to Neon over port 443 via `@prisma/adapter-neon`. The deployed app is unaffected.
3. Until the wipe, deleting an *old* entry in the app still deletes its Blob file. That's the
   existing behavior, kept as instructed, and every such file is already in the backup.
4. If compression fails and the original file is uploaded uncompressed (e.g. a `.mov`), its R2 key
   still ends in `.mp4` as specified, but it's stored with its real `Content-Type`, so playback is
   fine.
5. `MIGRATE_PROMPT.md` and `.claude/settings.json` are left untracked. I didn't commit them.

## What changed in the code

- `src/app/api/r2/upload-url/route.ts` (new): requires a session, keeps the uploads-enabled check,
  the max size (413) and the content-type allowlist. Returns a 15-minute presigned PUT with
  `Content-Length` and `Content-Type` signed in, plus the public URL
  `R2_PUBLIC_BASE_URL/videos/<random>-<sanitized-name>.mp4`.
- `src/lib/r2.ts`, `src/lib/r2-upload.ts` (new): S3 client for
  `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, key generation, and a browser PUT via XHR so
  the progress bar still works.
- `workout-entry-form.tsx`, `additional-video-slot.tsx`: compress (unchanged), then upload to R2.
  The now-unused `userId` prop was removed.
- `src/lib/video-storage.ts` (new) `deleteStoredVideo()`: R2 `DeleteObject` for R2 URLs, Blob
  `del()` only for `*.blob.vercel-storage.com` URLs. It's used in all three places in
  `api/entries/[id]/route.ts` and in `deleteUserCascade()` in `src/lib/users.ts`, which imported
  `@vercel/blob` to clean up a deleted account's videos.
- Still on Blob, to remove later: the old `src/app/api/blob/upload/route.ts` (no longer called by
  the client) and the Blob branch of `deleteStoredVideo()`.
- New scripts: `backup-videos.ts`, `export-db.ts`, `import-db.ts`, `map-backup-videos.ts`,
  `r2-healthcheck.ts`, `test-db-scripts-local.ts`, `wipe-database.ts`, `lib/*`. Run them with
  `npx tsx`.
- `tsc --noEmit`, `eslint` and `npm run build` are all clean.

## Morning steps for Orr

Run everything from the repo root (`cd ~/rep-log`).

1. **Check the backup.**
   - Open a few videos: `open backup/videos` and play some files from each user folder.
   - Look at the counts: `cat backup/db/counts.json`. Every `verification` entry should say
     `"ok": true`.
   - Optionally re-verify every checksum:
     `python3 -c "import json;m=json.load(open('backup/videos-manifest.json'));print(''.join(f\"{b['sha256']}  backup/videos/{b['pathname']}\n\" for b in m['blobs']),end='')" | shasum -a 256 -c | grep -vc ': OK$'`
     prints `0` when everything matches.
2. **Copy the backup somewhere safe outside the repo**, e.g.
   `ditto backup ~/Documents/rep-log-backup-2026-10-09`, then also copy it to an external drive or
   cloud storage. If anything changed since last night, refresh it first with
   `npx tsx scripts/export-db.ts && npx tsx scripts/backup-videos.ts`.
3. **Wipe the database.** This deletes every row, including accounts:
   `npx tsx scripts/wipe-database.ts --i-have-checked-the-backup`
   It shows live counts next to the backup counts and asks you to type `WIPE`.
4. **Create the admin account.** Make sure `.env.local` has the `SITE_PASSWORD` you want as your
   admin password, plus `ADMIN_USERNAME` (defaults to `admin`) and optionally `VISITOR_PASSWORD`, then:
   `node scripts/seed-admin.js`
   Then log out and back in on the site, because old session cookies point at deleted user IDs.
5. **Delete the Blob store** in the Vercel dashboard → Storage → the Blob store → Settings → Delete.
6. **Remove `@vercel/blob` from the code**: the old `api/blob/upload` route, the Blob branch in
   `src/lib/video-storage.ts`, the dependency, and the `BLOB_READ_WRITE_TOKEN` env var. Ask me in
   a later session and I'll do it.
7. **Downgrade Vercel to Hobby** in the dashboard → Settings → Billing.
