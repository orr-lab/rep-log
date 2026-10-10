import { randomBytes } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 (S3-compatible) storage for uploaded videos. Objects live in a public bucket served
// through the R2_PUBLIC_BASE_URL custom domain -- stored videoUrls are plain public URLs, so
// playback and the Gemini fetch need no changes. Uploads go straight from the browser to R2 via a
// short-lived presigned PUT (see /api/r2/upload-url); the server never proxies video bytes.

let client: S3Client | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function getR2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

export function getR2Bucket(): string {
  return requireEnv("R2_BUCKET");
}

function publicBaseUrl(): string {
  return requireEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
}

export function publicUrlForKey(key: string): string {
  return `${publicBaseUrl()}/${key}`;
}

/** The object key for a videoUrl we stored, or null if it isn't one of ours. */
export function r2KeyFromUrl(url: string): string | null {
  const prefix = `${publicBaseUrl()}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key ? decodeURIComponent(key) : null;
}

/** New uploads land under pending/ and only move to videos/ once an entry referencing them is
 *  saved (see promotePendingUpload), so an abandoned form leaves nothing under videos/. A bucket
 *  lifecycle rule deletes anything still under pending/ after a day (see README). */
export const PENDING_PREFIX = "pending/";
export const VIDEOS_PREFIX = "videos/";

/** `pending/<random>.mp4`. Deliberately nothing from the original filename -- phone cameras name
 *  files after the recording time (e.g. PXL_20260921_144039930.mp4), and these URLs are public. */
export function newPendingVideoKey(): string {
  return `${PENDING_PREFIX}${randomBytes(12).toString("hex")}.mp4`;
}

const PENDING_KEY_PATTERN = /^pending\/[0-9a-f]{24}\.mp4$/;

export function isPendingVideoKey(key: string): boolean {
  return PENDING_KEY_PATTERN.test(key);
}

/** `pending/<random>.mp4` -> `videos/<random>.mp4`. */
export function finalKeyForPending(pendingKey: string): string {
  return VIDEOS_PREFIX + pendingKey.slice(PENDING_PREFIX.length);
}

/** Stored on every uploaded video and sent back by R2 on each GET, so Cloudflare's edge (and the
 *  browser) only cache a video for a few minutes. Without it the edge could keep serving a video
 *  for a long time after it's deleted. Keys are random and never reused, so a short TTL costs
 *  little more than some extra origin fetches. */
export const VIDEO_CACHE_CONTROL = "public, max-age=300";

/** Presigned PUT with Content-Type, Content-Length and Cache-Control signed in, so the browser can
 *  only upload exactly the declared size and type -- R2 has no POST-policy equivalent to enforce a
 *  max size. The browser has to send the returned `headers` exactly as given or R2 returns 403. */
export async function presignVideoUpload(key: string, contentType: string, contentLength: number) {
  const uploadUrl = await getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
      CacheControl: VIDEO_CACHE_CONTROL,
    }),
    { expiresIn: 15 * 60, signableHeaders: new Set(["content-type", "content-length", "cache-control"]) }
  );
  return { uploadUrl, headers: { "Content-Type": contentType, "Cache-Control": VIDEO_CACHE_CONTROL } };
}

/** True if the object exists; false on 404. Other errors (auth, network) are thrown. */
export async function r2ObjectExists(key: string): Promise<boolean> {
  try {
    await getR2Client().send(new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }));
    return true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw error;
  }
}

/** Server-side copy within the bucket. Content-Type and Cache-Control are read from the source
 *  and set explicitly (REPLACE) rather than relying on the default COPY directive, so the copy is
 *  guaranteed to keep them. */
export async function copyR2Object(sourceKey: string, destinationKey: string): Promise<void> {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: sourceKey }));
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: destinationKey,
      CopySource: `${bucket}/${sourceKey}`,
      MetadataDirective: "REPLACE",
      ContentType: head.ContentType,
      CacheControl: head.CacheControl ?? VIDEO_CACHE_CONTROL,
    })
  );
}

export async function deleteR2Object(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }));
}
