// Cross-references the DB export (backup/db) with the video backup (backup/videos-manifest.json):
// writes backup/video-map.json -- every UPLOAD-sourced videoUrl in WorkoutEntry/EntryVideo mapped to
// its local file under backup/videos/ -- and reports counts of orphans in both directions.
// Local files only; prints counts, never URLs.
// Run with: npx tsx scripts/map-backup-videos.ts
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type Row = { id: string; videoSource: string; videoUrl: string; entryId?: string };

async function main() {
  const root = path.resolve("backup");
  const manifest: { blobs: { pathname: string; url: string; size: number; sha256: string }[] } = JSON.parse(
    await readFile(path.join(root, "videos-manifest.json"), "utf8")
  );
  const entries: Row[] = JSON.parse(await readFile(path.join(root, "db", "WorkoutEntry.json"), "utf8"));
  const extras: Row[] = JSON.parse(await readFile(path.join(root, "db", "EntryVideo.json"), "utf8"));

  const byUrl = new Map(manifest.blobs.map((b) => [b.url, b]));
  const referenced = new Set<string>();
  const map: { table: string; rowId: string; entryId: string; videoUrl: string; localPath: string | null; sha256: string | null }[] = [];

  for (const [table, rows] of [["WorkoutEntry", entries], ["EntryVideo", extras]] as const) {
    for (const row of rows) {
      if (row.videoSource !== "UPLOAD") continue;
      const blob = byUrl.get(row.videoUrl);
      if (blob) referenced.add(blob.url);
      map.push({
        table,
        rowId: row.id,
        entryId: row.entryId ?? row.id,
        videoUrl: row.videoUrl,
        localPath: blob ? path.join("videos", blob.pathname) : null,
        sha256: blob?.sha256 ?? null,
      });
    }
  }

  for (const m of map) {
    if (m.localPath) await stat(path.join(root, m.localPath)); // throws if a mapped file is missing
  }

  const orphanBlobs = manifest.blobs.filter((b) => !referenced.has(b.url));
  const missing = map.filter((m) => !m.localPath);
  const summary = {
    uploadReferencesInDb: map.length,
    referencesWithLocalFile: map.length - missing.length,
    referencesMissingFromBlobStore: missing.length,
    blobsInStore: manifest.blobs.length,
    orphanBlobs: orphanBlobs.length,
    orphanBlobBytes: orphanBlobs.reduce((n, b) => n + b.size, 0),
    youtubeEntries: entries.filter((e) => e.videoSource === "YOUTUBE").length,
    youtubeExtraVideos: extras.filter((e) => e.videoSource === "YOUTUBE").length,
  };
  await writeFile(
    path.join(root, "video-map.json"),
    JSON.stringify({ summary, map, orphanBlobPathnames: orphanBlobs.map((b) => b.pathname) }, null, 2)
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
