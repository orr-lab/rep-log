"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { compressVideoWebCodecs } from "./video-compress-webcodecs";

// Self-hosted from public/ffmpeg/ (copied from node_modules/@ffmpeg/core's UMD build) rather than
// pulled from a CDN at runtime -- one less external dependency for something that runs on every
// upload. This is the single-threaded core build specifically: a multi-threaded core (@ffmpeg/
// core-mt) was tried here and reverted -- it reliably hung indefinitely during its worker-thread
// pool init when self-hosted this way (reproduced locally: 40+ seconds, zero progress, no
// completion), and in production that meant compression silently "failed" and fell back to
// uploading the original file -- which, since most phones record HEVC, usually isn't a format
// browsers can play back at all. Don't re-enable multi-threading without first getting a
// self-hosted repro of @ffmpeg/core-mt actually completing a real transcode, not just loading.
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
  /** Which path actually produced this result -- surfaced in the UI (see workout-entry-form.tsx)
   *  so a slow compression can be diagnosed from a phone with no devtools access: "webcodecs"
   *  should be fast (hardware-accelerated on devices that support it), "ffmpeg" is the
   *  pure-software fallback and is expected to take roughly as long as the video itself. */
  method: "webcodecs" | "ffmpeg";
}

function outputFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "");
  return `${base || "video"}.mp4`;
}

/** Re-encodes a video client-side (H.264/AAC, capped at 720p/30fps, CRF 28) before upload, so
 *  the bytes that actually hit Blob storage -- and get re-transferred every time the video is
 *  watched or sent to Gemini for AI feedback -- are meaningfully smaller than whatever a phone
 *  camera produced. Tries hardware-accelerated compression via the browser's own codecs first
 *  (see video-compress-webcodecs.ts) -- real hardware decode/encode is dramatically faster than
 *  ffmpeg.wasm's pure-software path -- and falls back to ffmpeg.wasm (below) on any failure:
 *  unsupported browser, unsupported source codec, no hardware encoder available, anything.
 *  Failure of the whole thing is always non-fatal from the caller's side -- a compression bug
 *  should never block logging a set, so callers should catch and fall back to uploading the
 *  original file. */
export async function compressVideo(
  file: File,
  onProgress?: (ratio: number) => void
): Promise<CompressResult> {
  try {
    return await compressVideoWebCodecs(file, onProgress);
  } catch (err) {
    console.error("WebCodecs compression failed, falling back to ffmpeg.wasm:", err);
  }
  return compressVideoFfmpeg(file, onProgress);
}

/** ffmpeg.wasm fallback path -- single-threaded (see loadFFmpeg above), so wall-clock encode
 *  time is dominated by how many pixels/frames there are to process; 720p/30fps (down from
 *  1080p/whatever fps the phone recorded at, often 60) is the main lever available without
 *  multi-threading, and is still plenty for reviewing form. */
async function compressVideoFfmpeg(
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
      // force_divisible_by=2 is the actual fix confirmed against a real portrait phone
      // recording: ffmpeg auto-rotates a portrait video (applying its Display Matrix rotation
      // side data) *before* -vf runs, so for a portrait source the "iw"/"ih" this scale filter
      // sees are already transposed -- e.g. a 1920x1080-stored, rotated-90 source becomes a
      // 1080x1920 input here. force_original_aspect_ratio=decrease on its own can then land on
      // an odd width/height (reproduced: 405x720), which libx264 flatly rejects -- H.264 needs
      // even dimensions for 4:2:0 chroma subsampling -- so the encoder fails to open, the whole
      // exec() throws, and compression silently falls back to uploading the original file.
      // Since most phones record HEVC, that fallback is usually a format browsers can't play at
      // all, which is what actually caused the "no video with supported format" reports.
      "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      "-r",
      "30",
      "-c:v",
      "libx264",
      // Also forces standard 8-bit output regardless of the source's bit depth -- some phones
      // shoot HDR (10-bit HEVC), and without this libx264 preserves that depth, producing "H.264
      // High 10" output that most hardware decoders don't support either.
      "-pix_fmt",
      "yuv420p",
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

    return { file: compressed, originalBytes: file.size, compressedBytes: compressed.size, method: "ffmpeg" };
  } finally {
    ffmpeg.off("progress", handleProgress);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}
