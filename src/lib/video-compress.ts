"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Self-hosted from public/ffmpeg/ and public/ffmpeg-mt/ (copied from @ffmpeg/core's and
// @ffmpeg/core-mt's UMD build output) rather than pulled from a CDN at runtime -- one less
// external dependency for something that runs on every upload.
//
// Two cores are shipped. The multi-threaded one is dramatically faster -- most phones record
// HEVC by default, and software-decoding that before ffmpeg can even start re-encoding is the
// real bottleneck (not the x264 encode preset, which only affects the encode half) -- but it
// only works when the page is cross-origin isolated (self.crossOriginIsolated), which requires
// the COOP/COEP response headers set in next.config.ts. Those headers use COEP's
// `credentialless` mode specifically so the YouTube iframe embed in VideoPlayer keeps working
// without YouTube needing to opt in -- but a handful of older browsers don't support
// `credentialless` at all, in which case crossOriginIsolated is simply false and this falls back
// to the single-threaded core below, exactly as before: slower, but still fully functional.
const SINGLE_THREAD_CORE = {
  coreURL: "/ffmpeg/ffmpeg-core.js",
  wasmURL: "/ffmpeg/ffmpeg-core.wasm",
};
const MULTI_THREAD_CORE = {
  coreURL: "/ffmpeg-mt/ffmpeg-core.js",
  wasmURL: "/ffmpeg-mt/ffmpeg-core.wasm",
  workerURL: "/ffmpeg-mt/ffmpeg-core.worker.js",
};

let ffmpegPromise: Promise<FFmpeg> | null = null;

function loadFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const multiThreaded = self.crossOriginIsolated;
      const [coreURL, wasmURL, workerURL] = await Promise.all([
        toBlobURL(
          multiThreaded ? MULTI_THREAD_CORE.coreURL : SINGLE_THREAD_CORE.coreURL,
          "text/javascript"
        ),
        toBlobURL(
          multiThreaded ? MULTI_THREAD_CORE.wasmURL : SINGLE_THREAD_CORE.wasmURL,
          "application/wasm"
        ),
        multiThreaded ? toBlobURL(MULTI_THREAD_CORE.workerURL, "text/javascript") : undefined,
      ]);
      await ffmpeg.load({ coreURL, wasmURL, ...(workerURL ? { workerURL } : {}) });
      return ffmpeg;
    })();
    // Don't cache a failed load -- let the next call retry from scratch.
    ffmpegPromise.catch(() => {
      ffmpegPromise = null;
    });
  }
  return ffmpegPromise;
}

export interface CompressResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
}

function outputFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "");
  return `${base || "video"}.mp4`;
}

/** Re-encodes a video client-side (H.264/AAC, capped at 720p/30fps, CRF 28) before upload, so
 *  the bytes that actually hit Blob storage -- and get re-transferred every time the video is
 *  watched or sent to Gemini for AI feedback -- are meaningfully smaller than whatever a phone
 *  camera produced. Runs entirely in the browser via ffmpeg.wasm, multi-threaded when the page
 *  is cross-origin isolated (see loadFFmpeg above) and single-threaded otherwise. 720p/30fps
 *  (down from 1080p/whatever fps the phone recorded at, often 60) trims the single-threaded
 *  fallback path's encode time further, and is still plenty for reviewing form. Failure is
 *  always non-fatal from the caller's side -- a compression bug should never block logging a
 *  set, so callers should catch and fall back to uploading the original file. */
export async function compressVideo(
  file: File,
  onProgress?: (ratio: number) => void
): Promise<CompressResult> {
  const ffmpeg = await loadFFmpeg();

  const inputName = `input-${Date.now()}`;
  const outputName = `output-${Date.now()}.mp4`;

  const handleProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress)) onProgress?.(Math.min(1, Math.max(0, progress)));
  };
  ffmpeg.on("progress", handleProgress);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec([
      "-i",
      inputName,
      "-vf",
      "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    // Copy into a plain (non-shared) ArrayBuffer-backed Uint8Array -- ffmpeg.wasm's FileData
    // type is compatible with SharedArrayBuffer, which Blob's constructor type doesn't accept.
    const bytes =
      data instanceof Uint8Array
        ? Uint8Array.from(data)
        : new TextEncoder().encode(String(data));
    const compressed = new File([bytes], outputFileName(file.name), { type: "video/mp4" });

    return { file: compressed, originalBytes: file.size, compressedBytes: compressed.size };
  } finally {
    ffmpeg.off("progress", handleProgress);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}
