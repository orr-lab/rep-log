import { deleteR2Object, r2KeyFromUrl } from "@/lib/r2";

/** Deletes an UPLOAD-sourced video from R2. URLs that aren't in our bucket are left alone. Never
 *  throws -- cleanup is best-effort and must not block deleting the DB row. */
export async function deleteStoredVideo(url: string): Promise<void> {
  try {
    const key = r2KeyFromUrl(url);
    if (key) await deleteR2Object(key);
  } catch (error) {
    console.error("Failed to delete stored video:", error instanceof Error ? error.message : error);
  }
}
