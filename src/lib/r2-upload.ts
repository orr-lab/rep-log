// Browser-side half of the R2 upload flow: ask /api/r2/upload-url for a presigned PUT, then send
// the file straight to R2 with XMLHttpRequest (fetch has no upload-progress events). Resolves with
// the public URL to store as the entry's videoUrl.
export async function uploadVideoToR2(
  file: File,
  { onUploadProgress }: { onUploadProgress?: (percentage: number) => void } = {}
): Promise<{ url: string }> {
  const res = await fetch("/api/r2/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
  });
  const data = (await res.json().catch(() => null)) as { uploadUrl?: string; url?: string; error?: string } | null;
  if (!res.ok || !data?.uploadUrl || !data.url) {
    throw new Error(data?.error ?? "Upload failed. Please try again.");
  }
  const { uploadUrl, url } = data;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
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

  return { url };
}
