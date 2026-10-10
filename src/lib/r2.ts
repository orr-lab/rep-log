import { randomBytes } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

/** `videos/<random>-<sanitized-name>.mp4`, keeping only filename-safe characters. */
export function videoKeyFor(filename: string): string {
  const base = filename
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return `videos/${randomBytes(12).toString("hex")}-${base || "video"}.mp4`;
}

/** Presigned PUT with Content-Type and Content-Length signed in, so the browser can only upload
 *  exactly the declared size and type -- R2 has no POST-policy equivalent to enforce a max size. */
export async function presignVideoUpload(key: string, contentType: string, contentLength: number) {
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: 15 * 60, signableHeaders: new Set(["content-type", "content-length"]) }
  );
}

export async function deleteR2Object(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }));
}
