// Checks the R2 setup end to end without touching anything but its own _healthcheck.txt object:
// PutObject via the S3 API, GET it back through R2_PUBLIC_BASE_URL, send a browser-style CORS
// preflight for a presigned PUT from the app's origin, then delete the test object.
// Prints pass/fail only, never credentials or URLs.
// Run with: npx tsx scripts/r2-healthcheck.ts [--origin https://replog.orrknaan.com] [--keep]
import { config } from "dotenv";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2Bucket, publicUrlForKey, VIDEO_CACHE_CONTROL } from "../src/lib/r2";

config({ path: [".env.local", ".env"], quiet: true });

const KEY = "_healthcheck.txt";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const origin = arg("--origin") ?? "https://replog.orrknaan.com";
  const client = getR2Client();
  const bucket = getR2Bucket();
  const body = `rep-log R2 healthcheck ${new Date().toISOString()}\n`;
  let ok = true;

  await client.send(new PutObjectCommand({ Bucket: bucket, Key: KEY, Body: body, ContentType: "text/plain" }));
  console.log("OK   PutObject via S3 API");

  const res = await fetch(`${publicUrlForKey(KEY)}?t=${Date.now()}`);
  const text = res.ok ? await res.text() : "";
  const publicOk = res.ok && text === body;
  ok &&= publicOk;
  console.log(`${publicOk ? "OK  " : "FAIL"} GET via public custom domain (HTTP ${res.status}${res.ok && !publicOk ? ", body mismatch" : ""})`);

  // What the browser will do before PUTting to a presigned URL from the app's origin.
  const presigned = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: `videos/_cors-preflight-test.mp4`, ContentType: "video/mp4", ContentLength: 1, CacheControl: VIDEO_CACHE_CONTROL }),
    { expiresIn: 60, signableHeaders: new Set(["content-type", "content-length", "cache-control"]) }
  );
  const pre = await fetch(presigned, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type,cache-control" },
  });
  const allowOrigin = pre.headers.get("access-control-allow-origin");
  const corsOk = pre.ok && (allowOrigin === origin || allowOrigin === "*");
  ok &&= corsOk;
  console.log(`${corsOk ? "OK  " : "FAIL"} CORS preflight for PUT from the app origin (HTTP ${pre.status}, allow-origin ${allowOrigin ? "present" : "missing"})`);

  // Public GET from a <video> on the app's origin doesn't need CORS, but range requests should work.
  const range = await fetch(`${publicUrlForKey(KEY)}?r=${Date.now()}`, { headers: { Range: "bytes=0-3" } });
  console.log(`${range.status === 206 ? "OK  " : "WARN"} Range request via public domain (HTTP ${range.status})`);

  if (!process.argv.includes("--keep")) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: KEY }));
    console.log("OK   deleted own _healthcheck.txt");
  }
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(`FAIL ${err instanceof Error ? `${err.name}: ${err.message}` : err}`);
  process.exit(1);
});
