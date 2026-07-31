import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const EXTENSION_MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
};

function binaryPath(): string {
  const filename = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  return path.join(process.cwd(), "bin", filename);
}

function runYtDlp(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binaryPath(), args);
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Judging workout form is a visual task (squat depth, joint alignment, bar path), unlike piano
 * takes where the audio alone is enough — so this downloads video, not audio. The
 * bestvideo+bestaudio pair needs ffmpeg on PATH to mux into one file; Vercel's Node runtime
 * doesn't bundle ffmpeg, so on a stock deployment this merge will typically fail and the caller
 * falls back to handing Gemini the raw YouTube URL instead (see gemini.ts) — the same graceful
 * degradation path used when yt-dlp can't reach a video at all. Installing ffmpeg on the deploy
 * target (or trimming to a progressive-only format that needs no merge) restores this path.
 */
export async function downloadYoutubeVideo(
  youtubeId: string
): Promise<{ blob: Blob; mimeType: string }> {
  const url = `https://www.youtube.com/watch?v=${youtubeId}`;
  const dir = await mkdtemp(path.join(tmpdir(), "ytdlp-"));

  try {
    const args = [
      "-f",
      "bestvideo[height<=720]+bestaudio/best[height<=720]",
      "--merge-output-format",
      "mp4",
      "--no-playlist",
      "--no-part",
      // YouTube's "n" anti-throttling challenge requires actually executing obfuscated
      // JS. yt-dlp can use any JS runtime for this — point it at the same Node binary
      // this server is already running on, and allow it to fetch the (small, official)
      // challenge-solver script it needs from yt-dlp's own GitHub repo.
      "--js-runtimes",
      `node:${process.execPath}`,
      "--remote-components",
      "ejs:github",
    ];

    // YouTube blocks requests from known cloud/datacenter IPs (like Vercel's) with a
    // "confirm you're not a bot" challenge. Passing a real logged-in session's cookies
    // (Netscape cookie-file format) is the only workaround — see README for how to get one.
    if (process.env.YOUTUBE_COOKIES) {
      const cookiesPath = path.join(dir, "cookies.txt");
      await writeFile(cookiesPath, process.env.YOUTUBE_COOKIES, "utf-8");
      args.push("--cookies", cookiesPath);
    }

    args.push("-o", path.join(dir, "video.%(ext)s"), url);

    await runYtDlp(args);

    const files = await readdir(dir);
    const videoFile = files.find((f) => f !== "cookies.txt");
    if (!videoFile) {
      throw new Error("yt-dlp did not produce an output file.");
    }

    const buffer = await readFile(path.join(dir, videoFile));
    const ext = path.extname(videoFile).slice(1).toLowerCase();
    const mimeType = EXTENSION_MIME_TYPES[ext] ?? "video/mp4";

    return { blob: new Blob([buffer], { type: mimeType }), mimeType };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
