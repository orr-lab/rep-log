"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Self-hosted from public/ffmpeg/ (copied from node_modules/@ffmpeg/core's UMD build) rather than
// pulled from a CDN at runtime -- one less external dependency for something that runs on every
// upload. This is the single-threaded core build specifically: the multi-threaded one needs
// cross-origin-isolation (COOP/COEP) response headers on the whole app, which would also affect
// the YouTube iframe embed in VideoPlayer -- not worth that risk for a personal app where upload
// time isn't that sensitive.
const CORE_JS_URL = "/ffmpeg/ffmpeg-core.js";
const CORE_WASM_URL = "/ffmpeg/ffmpeg-core.wasm";

let ffmpegPromise: Promise<FFmpeg> | null = null;

function loadFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(CORE_JS_URL, "text/javascript"),
        toBlobURL(CORE_WASM_URL, "application/wasm"),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
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

/** Re-encodes a video client-side (H.264/AAC, capped at 1080p, CRF 28) before upload, so the
 *  bytes that actually hit Blob storage -- and get re-transferred every time the video is
 *  watched or sent to Gemini for AI feedback -- are meaningfully smaller than whatever a phone
 *  camera produced. Runs entirely in the browser via ffmpeg.wasm; failure is always non-fatal
 *  from the caller's side -- a compression bug should never block logging a set, so callers
 *  should catch and fall back to uploading the original file. */
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
      "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
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
