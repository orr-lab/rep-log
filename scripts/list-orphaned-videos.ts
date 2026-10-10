// Read-only report: lists objects under videos/ in the R2 bucket that no WorkoutEntry or
// EntryVideo row references, e.g. uploads left behind by abandoned forms before uploads went
// through pending/ (see src/lib/pending-uploads.ts). Deletes nothing -- review the list and decide.
// Run with: npx tsx scripts/list-orphaned-videos.ts
import { config } from "dotenv";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getR2Bucket, getR2Client, r2KeyFromUrl, VIDEOS_PREFIX } from "../src/lib/r2";
import { createScriptPrismaClient } from "./lib/db-client";

config({ path: [".env.local", ".env"], quiet: true });

interface R2Object {
  key: string;
  size: number;
  lastModified: Date | undefined;
}

async function listVideoObjects(): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let ContinuationToken: string | undefined;
  do {
    const page = await getR2Client().send(
      new ListObjectsV2Command({ Bucket: getR2Bucket(), Prefix: VIDEOS_PREFIX, ContinuationToken })
    );
    for (const o of page.Contents ?? []) {
      if (o.Key) objects.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified });
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return objects;
}

async function main() {
  const prisma = createScriptPrismaClient();
  try {
    const [entries, extras, objects] = await Promise.all([
      prisma.workoutEntry.findMany({ select: { videoUrl: true } }),
      prisma.entryVideo.findMany({ select: { videoUrl: true } }),
      listVideoObjects(),
    ]);
    const referenced = new Set(
      [...entries, ...extras].map((v) => r2KeyFromUrl(v.videoUrl)).filter((k): k is string => k !== null)
    );
    const orphans = objects.filter((o) => !referenced.has(o.key));

    for (const o of orphans) {
      console.log(`${o.key}\t${(o.size / 1e6).toFixed(1)} MB\t${o.lastModified?.toISOString() ?? "?"}`);
    }
    const totalMb = orphans.reduce((n, o) => n + o.size, 0) / 1e6;
    console.log(
      `\n${orphans.length} of ${objects.length} objects under ${VIDEOS_PREFIX} are unreferenced ` +
        `(${totalMb.toFixed(1)} MB). ${referenced.size} distinct R2 keys are referenced by the DB. Nothing was deleted.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
