// Browser-side half of the R2 upload flow: ask /api/r2/upload-url for a presigned PUT, then send
// the file straight to R2 with XMLHttpRequest (fetch has no upload-progress events). Resolves with
// the upload's pending/ URL and its upload token -- both go into the entry save, which moves the
// object to videos/ (see src/lib/pending-uploads.ts). An upload that's thrown out instead should
// be passed to discardPendingUpload().
export async function uploadVideoToR2(
  file: File,
  { onUploadProgress }: { onUploadProgress?: (percentage: number) => void } = {}
): Promise<{ url: string; uploadToken: string }> {
  const res = await fetch("/api/r2/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  const data = (await res.json().catch(() => null)) as
    | { uploadUrl?: string; headers?: Record<string, string>; url?: string; uploadToken?: string; error?: string }
    | null;
  if (!res.ok || !data?.uploadUrl || !data.headers || !data.url || !data.uploadToken) {
    throw new Error(data?.error ?? "Upload failed. Please try again.");
  }
  const { uploadUrl, headers, url, uploadToken } = data;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    // Signed into the URL (see presignVideoUpload), so these must match exactly.
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onUploadProgress?.((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onUploadProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (HTTP ${xhr.status}). Please try again.`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error. Please try again."));
    xhr.send(file);
  });

  return { url, uploadToken };
}

/** Deletes a not-yet-saved upload right away. Best effort and fire-and-forget: a failure just
 *  leaves the object for the pending/ lifecycle rule. keepalive lets it finish even if the page
 *  is navigating away. */
export function discardPendingUpload(uploadToken: string | null | undefined): void {
  if (!uploadToken) return;
  fetch("/api/r2/discard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadToken }),
    keepalive: true,
  }).catch(() => {});
}
