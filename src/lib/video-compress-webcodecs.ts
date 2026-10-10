"use client";

// Hardware-accelerated video compression via the browser's own codecs (WebCodecs), instead of
// ffmpeg.wasm's pure-software decode/encode. This is what actually gets a real speedup on a
// phone -- WebCodecs can use the device's video hardware, where ffmpeg.wasm never can. Demuxing
// the source container and muxing the result use mp4box.js and mp4-muxer respectively, since
// WebCodecs itself only deals in raw encoded chunks, not containers.
//
// Design choices that keep this simpler (and more correct) than a naive port of the ffmpeg
// command:
// - Audio is passed through untouched (no decode/re-encode) -- MP4 stores raw AAC access units,
//   and mp4-muxer's addAudioChunkRaw() accepts exactly that, so copying it over is both simpler
//   and higher-quality than the ffmpeg path's always-re-encode-to-AAC behavior.
// - Rotation is preserved as container metadata (mp4-muxer's `rotation` option), not baked into
//   pixels. WebCodecs VideoFrames come out in the source's *stored* orientation (unlike ffmpeg,
//   which auto-rotates before its filters run) -- so frames are scaled in their stored
//   orientation, and the display rotation is just carried through as a flag, exactly like the
//   original file already encoded it.
// - Any failure at any stage (unsupported codec, hardware encoder unavailable, decode error,
//   etc.) throws, and the caller (compressVideo() in video-compress.ts) is expected to catch and
//   fall back to the proven ffmpeg.wasm path -- this module is a pure optimization, never the
//   only way to compress a video.

import type { CompressResult } from "./video-compress";

const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;
const TARGET_FPS = 30;
const TARGET_BITRATE = 2_000_000;

interface DemuxedTrackInfo {
  id: number;
  codec: string;
  timescale: number;
  nbSamples: number;
}

interface VideoTrackInfo extends DemuxedTrackInfo {
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  description: Uint8Array | undefined;
}

interface AudioTrackInfo extends DemuxedTrackInfo {
  sampleRate: number;
  numberOfChannels: number;
}

interface DemuxedSample {
  data: Uint8Array;
  isKey: boolean;
  timestampUs: number;
  durationUs: number;
}

interface DemuxResult {
  video: VideoTrackInfo | null;
  audio: AudioTrackInfo | null;
  videoSamples: DemuxedSample[];
  audioSamples: DemuxedSample[];
}

/** Decodes an MP4/QuickTime transform matrix into one of the four simple rotations a phone
 *  camera actually produces. The matrix is 16.16 fixed-point for the a/b/c/d terms; only the
 *  angle (via atan2 of the first two terms) matters here, so the fixed-point scale cancels out
 *  and raw integer values work fine. */
function decodeRotation(matrix: ArrayLike<number>): 0 | 90 | 180 | 270 {
  const a = matrix[0];
  const b = matrix[1];
  const angle = (Math.atan2(b, a) * 180) / Math.PI;
  const normalized = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  if (normalized === 90) return 90;
  if (normalized === 180) return 180;
  if (normalized === 270) return 270;
  return 0;
}

async function demux(file: File): Promise<DemuxResult> {
  const mp4box = await import("mp4box");
  const mp4boxFile = mp4box.createFile();
  const buffer = await file.arrayBuffer();

  const videoSamples: DemuxedSample[] = [];
  const audioSamples: DemuxedSample[] = [];

  const trackInfo = await new Promise<{ video: VideoTrackInfo | null; audio: AudioTrackInfo | null }>(
    (resolve, reject) => {
      mp4boxFile.onError = (module, message) => reject(new Error(`mp4box ${module}: ${message}`));
      mp4boxFile.onReady = (info) => {
        const videoTrack = info.videoTracks[0];
        const audioTrack = info.audioTracks[0];

        const video: VideoTrackInfo | null =
          videoTrack && videoTrack.video
            ? {
                id: videoTrack.id,
                codec: videoTrack.codec,
                timescale: videoTrack.timescale,
                nbSamples: videoTrack.nb_samples,
                width: videoTrack.video.width,
                height: videoTrack.video.height,
                rotation: decodeRotation(videoTrack.matrix),
                // Filled in after this promise resolves -- reading the avcC/hvcC box is async
                // (dynamically imports mp4box's DataStream), and onReady can't be async itself.
                description: undefined,
              }
            : null;
        const audio: AudioTrackInfo | null =
          audioTrack && audioTrack.audio
            ? {
                id: audioTrack.id,
                codec: audioTrack.codec,
                timescale: audioTrack.timescale,
                nbSamples: audioTrack.nb_samples,
                sampleRate: audioTrack.audio.sample_rate,
                numberOfChannels: audioTrack.audio.channel_count,
              }
            : null;

        if (video) mp4boxFile.setExtractionOptions(video.id, undefined, { nbSamples: Infinity });
        if (audio) mp4boxFile.setExtractionOptions(audio.id, undefined, { nbSamples: Infinity });

        mp4boxFile.onSamples = (id, _user, samples) => {
          const isVideo = video != null && id === video.id;
          const target = isVideo ? videoSamples : audioSamples;
          const timescale = isVideo ? video!.timescale : (audio?.timescale ?? 1);
          for (const s of samples) {
            if (!s.data) continue;
            target.push({
              data: s.data,
              isKey: s.is_sync,
              timestampUs: (s.cts / timescale) * 1_000_000,
              durationUs: (s.duration / timescale) * 1_000_000,
            });
          }
        };

        mp4boxFile.start();
        resolve({ video, audio });
      };

      (buffer as unknown as { fileStart: number }).fileStart = 0;
      mp4boxFile.appendBuffer(buffer as unknown as import("mp4box").MP4BoxBuffer);
      mp4boxFile.flush();
    }
  );

  const { video, audio } = trackInfo;
  if (video) {
    video.description = await readCodecDescription(mp4boxFile, video.id);
  }

  return { video, audio, videoSamples, audioSamples };
}

/** Reads the avcC/hvcC box for a track and serializes it back to bytes minus the 8-byte box
 *  header -- WebCodecs' `description` needs exactly that raw configuration record, since unlike
 *  VP9/AV1, AVC/HEVC chunks aren't self-describing on their own. Same pattern as the official
 *  WebCodecs samples (w3c/webcodecs video-decode-display sample) use for the same purpose. */
async function readCodecDescription(
  mp4boxFile: import("mp4box").ISOFile,
  trackId: number
): Promise<Uint8Array | undefined> {
  const { DataStream, Endianness } = await import("mp4box");
  const trak = mp4boxFile.getTrackById(trackId);
  const stsd = trak?.mdia?.minf?.stbl?.stsd as unknown as { entries?: unknown[] } | undefined;
  const entry = stsd?.entries?.[0] as unknown as Record<string, { write: (stream: InstanceType<typeof DataStream>) => void }> | undefined;
  const box = entry?.avcC ?? entry?.hvcC;
  if (!box) return undefined;

  const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
  box.write(stream);
  // Skip the 8-byte box header (4-byte size + 4-byte fourcc) to get just the config record.
  return new Uint8Array(stream.buffer, 8);
}

function computeTargetSize(storedWidth: number, storedHeight: number, rotation: 0 | 90 | 180 | 270) {
  // ffmpeg's autorotate applies rotation before scaling; we instead scale in stored orientation
  // and carry rotation as metadata, so the *fit* target has to be swapped for 90/270 to match
  // what the viewer will actually see (e.g. a portrait video's displayed aspect is tall, even
  // though the stored frame is wide).
  const swapped = rotation === 90 || rotation === 270;
  const maxW = swapped ? MAX_HEIGHT : MAX_WIDTH;
  const maxH = swapped ? MAX_WIDTH : MAX_HEIGHT;
  const scale = Math.min(1, maxW / storedWidth, maxH / storedHeight);
  const forceEven = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return {
    width: forceEven(storedWidth * scale),
    height: forceEven(storedHeight * scale),
  };
}

/** Picks a supported AVC codec/config, preferring real hardware acceleration but falling back to
 *  software rather than giving up entirely. Confirmed against a real device (desktop Firefox):
 *  it treats `hardwareAcceleration: "prefer-hardware"` as something much closer to a hard
 *  requirement than a hint -- isConfigSupported returned unsupported for every candidate with
 *  that hint set, on a browser that (confirmed separately, with the hint removed) can do AVC
 *  encoding in software via WebCodecs just fine. So: try every candidate with the hint first (to
 *  get real hardware where a browser actually honors the hint as a preference), and only if none
 *  of those are supported, retry the same candidates without it -- landing on software WebCodecs
 *  rather than falling all the way back to ffmpeg.wasm, which is slower than either. */
async function pickSupportedCodec(
  width: number,
  height: number
): Promise<{ codec: string; hardwareAcceleration?: HardwareAcceleration }> {
  const candidates = ["avc1.4d0020", "avc1.42001f", "avc1.420015"];
  for (const hardwareAcceleration of ["prefer-hardware", undefined] as const) {
    for (const codec of candidates) {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: TARGET_BITRATE,
        framerate: TARGET_FPS,
        ...(hardwareAcceleration ? { hardwareAcceleration } : {}),
      });
      if (support.supported) return { codec, hardwareAcceleration };
    }
  }
  throw new Error("No supported hardware/software AVC encoder configuration found.");
}

/** Same with-hint-then-without fallback as pickSupportedCodec, for the decode side -- returns
 *  whichever hardwareAcceleration setting isConfigSupported actually accepts for this source. */
async function pickSupportedDecoderHwAccel(
  video: VideoTrackInfo
): Promise<HardwareAcceleration | undefined> {
  for (const hardwareAcceleration of ["prefer-hardware", undefined] as const) {
    const support = await VideoDecoder.isConfigSupported({
      codec: video.codec,
      codedWidth: video.width,
      codedHeight: video.height,
      description: video.description,
      ...(hardwareAcceleration ? { hardwareAcceleration } : {}),
    });
    if (support.supported) return hardwareAcceleration;
  }
  throw new Error(`No supported decoder for source codec ${video.codec}.`);
}

/** How long the decode/encode pipeline may go without a single decoded frame or encoded chunk
 *  before it's treated as hung. Confirmed from a real report: in Safari on macOS, a video could
 *  decode every frame (progress at 100%) and then never finish -- no error, no rejection, the
 *  awaited flush just never settled -- leaving the form stuck on "Compressing... 100%" forever.
 *  Even a slow software encoder emits a chunk every few hundred ms, so 20s of silence means it
 *  isn't coming back, and failing lets compressVideo() fall back to ffmpeg.wasm instead. */
const STALL_TIMEOUT_MS = 20_000;

export async function compressVideoWebCodecs(
  file: File,
  onProgress?: (ratio: number) => void
): Promise<CompressResult> {
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
    throw new Error("WebCodecs is not supported in this browser.");
  }

  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");

  const { video, audio, videoSamples, audioSamples } = await demux(file);
  if (!video) throw new Error("No video track found.");

  const { width, height } = computeTargetSize(video.width, video.height, video.rotation);
  const { codec: encoderCodec, hardwareAcceleration: encoderHwAccel } = await pickSupportedCodec(width, height);
  const decoderHwAccel = await pickSupportedDecoderHwAccel(video);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height, rotation: video.rotation, frameRate: TARGET_FPS },
    audio: audio ? { codec: "aac", numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate } : undefined,
    fastStart: "in-memory",
    // Demuxed timestamps are the source file's own composition times, not necessarily starting
    // at exactly 0 (e.g. due to encoder priming/delay) -- mp4-muxer's strict default requires
    // the first chunk of each track to be exactly 0, throwing otherwise. 'offset' shifts each
    // track to start at 0 instead of rejecting it.
    firstTimestampBehavior: "offset",
  });

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a 2D canvas context.");

  // Errors raised inside codec callbacks can't propagate to this function on their own (a throw
  // in an output/error callback just vanishes into the event loop, which is how an error could
  // previously leave the flush awaits hanging), so they're recorded here and every await below
  // goes through guard(), which rejects as soon as one shows up -- or when nothing has happened
  // for STALL_TIMEOUT_MS.
  let fatalError: Error | null = null;
  const fail = (e: unknown) => {
    fatalError ??= e instanceof Error ? e : new Error(String(e));
  };
  let lastActivity = performance.now();
  const touch = () => {
    lastActivity = performance.now();
  };
  const guard = <T,>(promise: Promise<T>, stage: string): Promise<T> => {
    touch();
    return new Promise<T>((resolve, reject) => {
      const timer = setInterval(() => {
        if (fatalError) {
          clearInterval(timer);
          reject(fatalError);
        } else if (performance.now() - lastActivity > STALL_TIMEOUT_MS) {
          clearInterval(timer);
          reject(new Error(`WebCodecs stalled while ${stage} (no progress for ${STALL_TIMEOUT_MS / 1000}s).`));
        }
      }, 250);
      promise.then(
        (value) => {
          clearInterval(timer);
          if (fatalError) reject(fatalError);
          else resolve(value);
        },
        (err) => {
          clearInterval(timer);
          reject(fatalError ?? err);
        }
      );
    });
  };

  // Progress is the average of frames decoded and chunks encoded, held just under 100% until the
  // file is actually muxed -- "100%" used to mean only "every frame decoded", with the encoder
  // flush and muxing still to come, which made a hang there look like a finished compression.
  const totalFrames = videoSamples.length || 1;
  let decodedCount = 0;
  let encodedCount = 0;
  const reportProgress = () => onProgress?.(Math.min(0.99, (decodedCount + encodedCount) / (2 * totalFrames)));

  let decoder: VideoDecoder | null = null;
  let encoder: VideoEncoder | null = null;
  try {
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        touch();
        try {
          // mp4-muxer's own video-track sample-description writer reads meta.decoderConfig
          // without a null check (crashes with "Cannot read properties of null (reading
          // 'colorSpace')" if it's ever missing) -- confirmed some encoder configs in some
          // browsers don't reliably populate it on every chunk, even though the first chunk
          // after configure() should per spec. Falling back to a minimal decoderConfig (no
          // colorSpace, which mp4-muxer treats as "skip the colr box" -- an optional, cosmetic
          // box) keeps this from crashing regardless.
          const safeMeta = meta?.decoderConfig ? meta : { ...meta, decoderConfig: { codec: encoderCodec, codedWidth: width, codedHeight: height } };
          muxer.addVideoChunk(chunk, safeMeta);
          encodedCount += 1;
          reportProgress();
        } catch (e) {
          fail(e);
        }
      },
      error: fail,
    });
    encoder = enc;
    enc.configure({
      codec: encoderCodec,
      width,
      height,
      bitrate: TARGET_BITRATE,
      framerate: TARGET_FPS,
      ...(encoderHwAccel ? { hardwareAcceleration: encoderHwAccel } : {}),
    });

    const dec = new VideoDecoder({
      output: (frame) => {
        touch();
        try {
          if (fatalError || enc.state !== "configured") return;
          ctx.drawImage(frame as unknown as CanvasImageSource, 0, 0, width, height);
          const scaled = new VideoFrame(canvas, { timestamp: frame.timestamp, duration: frame.duration ?? undefined });
          try {
            enc.encode(scaled, { keyFrame: decodedCount % (TARGET_FPS * 2) === 0 });
          } finally {
            scaled.close();
          }
          decodedCount += 1;
          reportProgress();
        } catch (e) {
          fail(e);
        } finally {
          frame.close();
        }
      },
      error: fail,
    });
    decoder = dec;
    dec.configure({
      codec: video.codec,
      codedWidth: video.width,
      codedHeight: video.height,
      description: video.description,
      ...(decoderHwAccel ? { hardwareAcceleration: decoderHwAccel } : {}),
    });

    for (const sample of videoSamples) {
      if (fatalError) throw fatalError;
      dec.decode(
        new EncodedVideoChunk({
          type: sample.isKey ? "key" : "delta",
          timestamp: sample.timestampUs,
          duration: sample.durationUs,
          data: sample.data,
        })
      );
    }
    await guard(dec.flush(), "decoding");
    dec.close();
    await guard(enc.flush(), "finishing the encode");
    enc.close();
    if (fatalError) throw fatalError;
    if (encodedCount === 0) throw new Error("The encoder produced no output.");

    if (audio) {
      for (const sample of audioSamples) {
        muxer.addAudioChunkRaw(sample.data, sample.isKey ? "key" : "delta", sample.timestampUs, sample.durationUs);
      }
    }

    muxer.finalize();
    const { buffer } = muxer.target as InstanceType<typeof ArrayBufferTarget>;
    const outputFile = new File([buffer], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });
    onProgress?.(1);

    return { file: outputFile, originalBytes: file.size, compressedBytes: outputFile.size, method: "webcodecs" };
  } finally {
    // Release the (possibly hardware) codec sessions on every exit path, so a failed or stalled
    // attempt doesn't keep holding them while the ffmpeg.wasm fallback runs.
    for (const codec of [decoder, encoder]) {
      if (codec && codec.state !== "closed") {
        try {
          codec.close();
        } catch {
          // Already torn down by the browser.
        }
      }
    }
  }
}
