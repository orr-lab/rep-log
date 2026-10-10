import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  copyR2Object,
  deleteR2Object,
  finalKeyForPending,
  isPendingVideoKey,
  publicUrlForKey,
  r2KeyFromUrl,
  r2ObjectExists,
} from "@/lib/r2";

// Uploads go to pending/<random>.mp4 and are only promoted to videos/<random>.mp4 when an entry
// that references them is saved, so abandoning the form never leaves an unreferenced object under
// videos/ (leftover pending/ objects are removed by a bucket lifecycle rule).
//
// The entry routes must never trust a videoUrl from the client on its own: anyone with a session
// could otherwise point an entry at someone else's video (and then delete it by deleting the
// entry). So /api/r2/upload-url also returns an upload token -- an HMAC over the pending key, the
// uploader's userId and an expiry -- and a new upload is only accepted with a valid token for the
// same user whose key matches the videoUrl. No DB table needed.

/** Comfortably longer than any form session, shorter than the 1-day pending/ lifecycle rule. */
const TOKEN_TTL_MS = 20 * 60 * 60 * 1000;

interface TokenPayload {
  key: string;
  userId: string;
  exp: number;
}

function signingKey(): Buffer {
  // Same secret as the session cookie (see src/lib/auth.ts), domain-separated so a session
  // signature can never be passed off as an upload token or vice versa.
  return createHash("sha256").update(`replog-upload-key:${process.env.SITE_PASSWORD ?? ""}`).digest();
}

function hmac(payload: string): Buffer {
  return createHmac("sha256", signingKey()).update(payload).digest();
}

export function createUploadToken(key: string, userId: string): string {
  const payload = Buffer.from(JSON.stringify({ key, userId, exp: Date.now() + TOKEN_TTL_MS })).toString(
    "base64url"
  );
  return `${payload}.${hmac(payload).toString("base64url")}`;
}

/** The pending key the token was issued for, or null if the token is forged, expired, for another
 *  user, or not for a pending/ key. */
export function verifyUploadToken(token: string, userId: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = hmac(payload);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let parsed: TokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (parsed.userId !== userId || !(parsed.exp > Date.now()) || !isPendingVideoKey(parsed.key)) return null;
  return parsed.key;
}

export class UploadRejectedError extends Error {}

/** The video fields as stored in the DB -- uploadToken is request-only. */
export function withoutUploadToken<T extends { uploadToken?: string | null }>(video: T): Omit<T, "uploadToken"> {
  const copy = { ...video };
  delete copy.uploadToken;
  return copy;
}

interface VideoRef {
  videoSource: "UPLOAD" | "YOUTUBE";
  videoUrl: string;
  uploadToken?: string | null;
}

/**
 * Validates every video an entry save wants to store and promotes new uploads from pending/ to
 * videos/, rewriting each new upload's videoUrl to its final URL in place.
 *
 * - UPLOAD with an uploadToken: the token must be valid for this user and match the videoUrl's
 *   pending key, the pending object must exist, and its videos/ destination must not (so a token
 *   can't be replayed to attach one video to two entries).
 * - UPLOAD without a token: only allowed if the URL is already one of this entry's own videos
 *   (`keepableUrls`, empty on create).
 * - YOUTUBE: must not point into our bucket.
 *
 * Throws UploadRejectedError (-> 400) on any violation, after undoing any copies already made.
 * Returns the promotions so the caller can delete the pending objects once the DB write commits,
 * or roll the copies back if it doesn't.
 */
export async function promoteEntryUploads(
  videos: VideoRef[],
  userId: string,
  keepableUrls: Set<string>
): Promise<Promotions> {
  const promotions = new Promotions();
  try {
    for (const video of videos) {
      const urlKey = r2KeyFromUrl(video.videoUrl);
      if (video.videoSource === "YOUTUBE") {
        if (urlKey) throw new UploadRejectedError("A YouTube video can't point at an uploaded file.");
        continue;
      }
      if (!video.uploadToken) {
        if (!keepableUrls.has(video.videoUrl)) {
          throw new UploadRejectedError("That uploaded video doesn't belong to this entry.");
        }
        continue;
      }
      const pendingKey = verifyUploadToken(video.uploadToken, userId);
      if (!pendingKey || urlKey !== pendingKey) {
        throw new UploadRejectedError("Invalid or expired upload. Please upload the video again.");
      }
      const finalKey = finalKeyForPending(pendingKey);
      if (!(await r2ObjectExists(pendingKey))) {
        throw new UploadRejectedError("The uploaded video has expired. Please upload it again.");
      }
      if (await r2ObjectExists(finalKey)) {
        throw new UploadRejectedError("That upload has already been saved.");
      }
      await copyR2Object(pendingKey, finalKey);
      promotions.add(pendingKey, finalKey);
      video.videoUrl = publicUrlForKey(finalKey);
      video.uploadToken = undefined;
    }
  } catch (error) {
    await promotions.rollback();
    throw error;
  }
  return promotions;
}

export class Promotions {
  private items: { pendingKey: string; finalKey: string }[] = [];

  add(pendingKey: string, finalKey: string) {
    this.items.push({ pendingKey, finalKey });
  }

  /** After the DB write committed: the pending copies are no longer needed. Best effort -- the
   *  lifecycle rule catches anything this misses. */
  async commit(): Promise<void> {
    await Promise.all(this.items.map(({ pendingKey }) => deleteQuietly(pendingKey)));
  }

  /** The DB write failed: remove the videos/ copies so nothing under videos/ is unreferenced.
   *  The pending objects stay, so the user can retry the save with the same upload. */
  async rollback(): Promise<void> {
    await Promise.all(this.items.map(({ finalKey }) => deleteQuietly(finalKey)));
  }
}

async function deleteQuietly(key: string): Promise<void> {
  try {
    await deleteR2Object(key);
  } catch (error) {
    console.error("Failed to delete R2 object:", error instanceof Error ? error.message : error);
  }
}
