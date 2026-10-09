// Downloads EVERY object in the Vercel Blob store (not just the ones the database references) into
// backup/videos/<pathname>, byte-for-byte, and writes backup/videos-manifest.json with each blob's
// pathname, size, uploadedAt and SHA-256. Read-only against Blob: it only calls list() and GETs.
// Resumable -- files already on disk with the listed size are kept (just re-hashed).
// Run with: npx tsx scripts/backup-videos.ts
import { config } from "dotenv";
import { list, type ListBlobResultBlob } from "@vercel/blob";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

config({ path: [".env.local", ".env"], quiet: true });

const ROOT = path.resolve("backup");
const VIDEOS_DIR = path.join(ROOT, "videos");
const TMP_DIR = path.join(ROOT, "tmp");
const CONCURRENCY = 4;

function localPathFor(pathname: string): string {
  const target = path.resolve(VIDEOS_DIR, pathname);
  if (!target.startsWith(VIDEOS_DIR + path.sep)) {
    throw new Error(`Refusing to write outside backup/videos: ${pathname}`);
  }
  return target;
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

async function listAllBlobs(): Promise<ListBlobResultBlob[]> {
  const blobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

async function download(blob: ListBlobResultBlob, dest: string): Promise<string> {
  const tmp = path.join(TMP_DIR, `dl-${createHash("sha1").update(blob.pathname).digest("hex")}`);
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(blob.downloadUrl);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const hash = createHash("sha256");
      const tap = new Transform({
        transform(chunk, _enc, cb) {
          hash.update(chunk);
          cb(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(res.body as never), tap, createWriteStream(tmp));
      const { size } = await stat(tmp);
      if (size !== blob.size) throw new Error(`size mismatch: got ${size}, listed ${blob.size}`);
      await mkdir(path.dirname(dest), { recursive: true });
      await rename(tmp, dest);
      return hash.digest("hex");
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  await mkdir(VIDEOS_DIR, { recursive: true });
  await mkdir(TMP_DIR, { recursive: true });

  const blobs = await listAllBlobs();
  const totalBytes = blobs.reduce((n, b) => n + b.size, 0);
  console.log(`Listed ${blobs.length} blobs, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

  const manifest: { pathname: string; size: number; uploadedAt: string; sha256: string; url: string }[] = [];
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let next = 0;

  async function worker() {
    while (next < blobs.length) {
      const blob = blobs[next++];
      const dest = localPathFor(blob.pathname);
      try {
        const existing = await stat(dest).catch(() => null);
        let sha256: string;
        if (existing && existing.size === blob.size) {
          sha256 = await sha256File(dest);
          skipped++;
        } else {
          sha256 = await download(blob, dest);
          downloaded++;
        }
        manifest.push({
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: new Date(blob.uploadedAt).toISOString(),
          sha256,
          url: blob.url,
        });
      } catch (err) {
        failed++;
        console.error(`FAILED #${blobs.indexOf(blob)}: ${err instanceof Error ? err.message : err}`);
      }
      const done = downloaded + skipped + failed;
      if (done % 25 === 0) console.log(`  ${done}/${blobs.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  manifest.sort((a, b) => a.pathname.localeCompare(b.pathname));
  await writeFile(
    path.join(ROOT, "videos-manifest.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), count: manifest.length, totalBytes, blobs: manifest }, null, 2)
  );

  // Verify every listed blob is on disk at exactly the listed size.
  let mismatches = 0;
  for (const blob of blobs) {
    const s = await stat(localPathFor(blob.pathname)).catch(() => null);
    if (!s || s.size !== blob.size) mismatches++;
  }
  console.log(
    `downloaded=${downloaded} skipped(already present)=${skipped} failed=${failed} ` +
      `listed=${blobs.length} verifiedOnDisk=${blobs.length - mismatches} mismatches=${mismatches}`
  );
  if (failed || mismatches) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
