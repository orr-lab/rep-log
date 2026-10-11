"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { compressVideoWebCodecs } from "./video-compress-webcodecs";

// Self-hosted from public/ffmpeg/ (copied from node_modules/@ffmpeg/core/dist/esm/) rather than
// pulled from a CDN at runtime -- one less external dependency for something that runs on every
// upload. It has to be the ESM build: @ffmpeg/ffmpeg always starts its worker as a module worker,
// where importScripts() is unavailable, so it falls back to import()ing the core and reading its
// default export -- which the UMD build doesn't have. With the UMD file here, every load failed
// with "failed to import ffmpeg-core.js", so the fallback never actually ran. (The .wasm is
// byte-identical between the two builds.) This is the single-threaded core build specifically: a multi-threaded core (@ffmpeg/
// core-mt) was tried here and reverted -- it reliably hung indefinitely during its worker-thread
// pool init when self-hosted this way (reproduced locally: 40+ seconds, zero progress, no
// completion), and in production that meant compression silently "failed" and fell back to
// uploading the original file -- which, since most phones record HEVC, usually isn't a format
// browsers can play back at all. Don't re-enable multi-threading without first getting a
// self-hosted repro of @ffmpeg/core-mt actually completing a real transcode, not just loading.
const CORE_JS_URL = "/ffmpeg/ffmpeg-core.js";
const CORE_WASM_URL = "/ffmpeg/ffmpeg-core.wasm";

// Watchdogs for the fallback path, so a hung ffmpeg.wasm can't leave the upload form stuck on
// "Compressing..." forever either: the core download + init gets LOAD_TIMEOUT_MS in total, and a
// running exec() is killed if it emits no progress or log output for EXEC_STALL_TIMEOUT_MS
// (ffmpeg logs a stats line roughly every half second while it's actually encoding).
const LOAD_TIMEOUT_MS = 90_000;
const EXEC_STALL_TIMEOUT_MS = 30_000;

let ffmpegPromise: Promise<FFmpeg> | null = null;

/** Kills the worker and drops the cached instance, so the next call starts from scratch. */
function discardFFmpeg(ffmpeg: FFmpeg) {
  try {
    ffmpeg.terminate();
  } catch {
    // Never finished loading -- nothing to terminate.
  }
  ffmpegPromise = null;
}

function loadFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          discardFFmpeg(ffmpeg);
          reject(new Error(`ffmpeg.wasm took over ${LOAD_TIMEOUT_MS / 1000}s to load.`));
        }, LOAD_TIMEOUT_MS);
      });
      try {
        await Promise.race([
          (async () => {
            const [coreURL, wasmURL] = await Promise.all([
              toBlobURL(CORE_JS_URL, "text/javascript"),
              toBlobURL(CORE_WASM_URL, "application/wasm"),
            ]);
            await ffmpeg.load({ coreURL, wasmURL });
          })(),
          timeout,
        ]);
      } finally {
        clearTimeout(timer);
      }
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
  /** Set when method is "ffmpeg" because the WebCodecs attempt threw -- the error message, so a
   *  phone with no devtools access can still report back *why* it fell back. */
  fallbackReason?: string;
}

/** Progress text under the compression bar. Right after the fallback starts, ffmpeg.wasm is still
 *  downloading/initializing and reports no progress, so that gap gets its own message. */
export function compressionLabel(usingBackupCompressor: boolean, percent: number): string {
  if (!usingBackupCompressor) return `Compressing… ${Math.round(percent)}%`;
  if (percent <= 0) return "Switching to backup compressor…";
  return `Compressing with backup compressor… ${Math.round(percent)}%`;
}

function outputFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "");
  return `${base || "video"}.mp4`;
}

// Serializes every compressVideo() call app-wide, regardless of how many videos are being
// compressed at once (e.g. the primary video and an "add another video" slot dropped around the
// same time). Confirmed necessary from a real report: two concurrent compressions both stuck at
// 100% then crawling to 140+ seconds each (vs. ~60s alone) -- almost certainly two WebCodecs
// sessions contending for the same limited hardware codec slot, and/or two calls sharing the one
// ffmpeg.wasm instance (loadFFmpeg above returns a single cached instance; it was never designed
// to run two exec()s at once). Chaining onto this tail promise means each call waits for the
// previous one to fully finish before it even starts; queueTail itself never rejects; it's a
// pure timing gate, so an error in one compression doesn't stall the ones queued behind it.
let queueTail: Promise<void> = Promise.resolve();

/** Re-encodes a video client-side (H.264/AAC, capped at 720p/30fps, CRF 28) before upload, so
 *  the bytes that actually hit R2 storage -- and get re-transferred every time the video is
 *  watched or sent to Gemini for AI feedback -- are meaningfully smaller than whatever a phone
 *  camera produced. Tries hardware-accelerated compression via the browser's own codecs first
 *  (see video-compress-webcodecs.ts) -- real hardware decode/encode is dramatically faster than
 *  ffmpeg.wasm's pure-software path -- and falls back to ffmpeg.wasm (below) on any failure:
 *  unsupported browser, unsupported source codec, no hardware encoder available, anything.
 *  Failure of the whole thing is always non-fatal from the caller's side -- a compression bug
 *  should never block logging a set, so callers should catch and fall back to uploading the
 *  original file. `onFallback` fires when the WebCodecs attempt has failed and the ffmpeg.wasm
 *  fallback is starting, so the UI can say so instead of looking stuck. */
export function compressVideo(
  file: File,
  onProgress?: (ratio: number) => void,
  onFallback?: () => void
): Promise<CompressResult> {
  const run = async (): Promise<CompressResult> => {
    try {
      return await compressVideoWebCodecs(file, onProgress);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("WebCodecs compression failed, falling back to ffmpeg.wasm:", err);
      onFallback?.();
      // Restart the progress bar for the second attempt rather than leaving it wherever the
      // failed one stopped (often 99%, which reads as "stuck").
      onProgress?.(0);
      const result = await compressVideoFfmpeg(file, onProgress);
      return { ...result, fallbackReason: reason };
    }
  };

  const result = queueTail.then(run, run);
  queueTail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
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

  let lastActivity = performance.now();
  const touch = () => {
    lastActivity = performance.now();
  };
  const handleProgress = ({ progress }: { progress: number }) => {
    touch();
    if (Number.isFinite(progress)) onProgress?.(Math.min(1, Math.max(0, progress)));
  };
  ffmpeg.on("progress", handleProgress);
  ffmpeg.on("log", touch);

  let stalled = false;
  const watchdog = setInterval(() => {
    if (performance.now() - lastActivity > EXEC_STALL_TIMEOUT_MS) {
      clearInterval(watchdog);
      stalled = true;
      // Rejects the pending writeFile/exec/readFile call, which lands in the catch below.
      discardFFmpeg(ffmpeg);
    }
  }, 1000);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    touch();
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
  } catch (err) {
    if (stalled) throw new Error(`ffmpeg.wasm stalled (no progress for ${EXEC_STALL_TIMEOUT_MS / 1000}s).`);
    throw err;
  } finally {
    clearInterval(watchdog);
    ffmpeg.off("progress", handleProgress);
    ffmpeg.off("log", touch);
    if (!stalled) {
      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outputName).catch(() => {});
    }
  }
}
