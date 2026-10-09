import { del } from "@vercel/blob";
import { deleteR2Object, r2KeyFromUrl } from "@/lib/r2";

/** Deletes an UPLOAD-sourced video from whichever store holds it: R2 for new uploads, Vercel Blob
 *  for ones uploaded before the switch. Anything else is left alone. Never throws -- cleanup is
 *  best-effort and must not block deleting the DB row. */
export async function deleteStoredVideo(url: string): Promise<void> {
  try {
    const key = r2KeyFromUrl(url);
    if (key) {
      await deleteR2Object(key);
    } else if (new URL(url).hostname.endsWith(".blob.vercel-storage.com")) {
      await del(url);
    }
  } catch (error) {
    console.error("Failed to delete stored video:", error instanceof Error ? error.message : error);
  }
}
