import { GoogleGenAI, Type } from "@google/genai";
import { downloadYoutubeVideo } from "@/lib/ytdlp";
import type { WorkoutEntry } from "@/lib/types";

const MODEL = "gemini-3.6-flash";

function describeLoggedSet(
  exerciseName: string,
  weight: number | null,
  sets: number | null,
  reps: number | null
): string {
  const parts: string[] = [];
  if (weight != null) parts.push(`${weight} lb/kg`);
  if (sets != null && reps != null) parts.push(`${sets} sets x ${reps} reps`);
  else if (reps != null) parts.push(`${reps} reps`);
  return parts.length > 0 ? `${exerciseName} (${parts.join(", ")})` : exerciseName;
}

function buildPrompt(
  exerciseName: string,
  weight: number | null,
  sets: number | null,
  reps: number | null
): string {
  return `You are an experienced, honest strength coach reviewing a client's workout video. This
feedback is for the client's own improvement, not a public review — prioritize honesty and
specificity over encouragement. Do not soften real safety issues or pad the response with generic
praise ("great job!", "nice work!") that isn't backed by something concrete you actually saw. If
the form is risky or breaking down, say so plainly and explain why.

The client has logged this set as: "${describeLoggedSet(exerciseName, weight, sets, reps)}". Trust
this label over your own guess if what you see seems ambiguous — but if what you actually see
flatly contradicts it (a completely different exercise, or no exercise visible at all), say so
instead of forcing the label to fit.

Watch this video and assess it, focusing only on the movement. Ignore anything you hear —
grunting, gym noise, music playing — you're evaluating the movement, not the audio. Cover
whichever of these are relevant to what you see:
- Range of motion — full depth/lockout vs. cut short
- Joint alignment and safety — knees caving in, rounded lower back, elbows flaring, unstable
  footing, or anything else that raises injury risk
- Tempo and control — a controlled eccentric (lowering) phase vs. rushing it or using momentum
- Breathing pattern, if visible (e.g. holding breath through the sticking point vs. exhaling on
  exertion)
- Any technique points specific to this exercise (bar path, grip, stance, setup position)
- If you can localize an issue to a specific rep (e.g. "on the third rep," "toward the end of the
  set"), do so — vague feedback is much less useful than specific feedback.

Respond with:
- rating: a whole number from 1 to 5 reflecting the overall quality and safety of this specific
  set, judged against these concrete anchors — pick the one that best matches, don't hedge toward
  the middle:
  1 = breaks down repeatedly: unsafe form, loss of control, or the movement pattern falls apart
      well before the set ends.
  2 = completes the set, but form degrades noticeably for most of it, with at least one real
      safety concern (e.g. rounding back, knees caving).
  3 = mostly sound form with only occasional lapses, no serious safety concerns, but range of
      motion or control has room to improve.
  4 = solid form throughout with only minor, isolated issues; full range of motion; controlled
      tempo; nothing that raises real safety concern.
  5 = textbook execution: safe, full range of motion, controlled throughout, nothing to flag
      beyond nitpicks.
  Most gym-video sets are NOT automatically a 2 — if the issues you see are limited to one or two
  specific reps rather than the whole set, that's a 3 or 4, not a 2.
- feedback: as long as it needs to be to be genuinely useful — do not artificially shorten it.
  Structure it in two clearly separated parts: first what's actually working (be specific about
  what, not just that something looked good), then what to fix next, with the most impactful
  issue first. Write it directly to the client, in a direct and honest tone — a demanding coach's
  note, not a cheerleader's.`;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    rating: { type: Type.INTEGER },
    feedback: { type: Type.STRING },
  },
  required: ["rating", "feedback"],
};

export interface AiFeedbackResult {
  rating: number;
  feedback: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractFallbackRating(text: string): number {
  const outOfFive = text.match(/(\d)\s*\/\s*5/);
  if (outOfFive) return Number(outOfFive[1]);
  const labeled = text.match(/rating["\s:]+(\d)/i);
  if (labeled) return Number(labeled[1]);
  return 3;
}

interface UploadedMedia {
  fileUri: string;
  mimeType?: string;
  name: string;
}

async function uploadBlobToGemini(
  ai: GoogleGenAI,
  blob: Blob,
  mimeType: string
): Promise<UploadedMedia> {
  const uploaded = await ai.files.upload({ file: blob, config: { mimeType } });
  if (!uploaded.name) {
    throw new Error("Gemini did not return a file reference for the upload.");
  }

  let file = await ai.files.get({ name: uploaded.name });
  let attempts = 0;
  while (file.state === "PROCESSING" && attempts < 20) {
    await sleep(3000);
    file = await ai.files.get({ name: uploaded.name });
    attempts += 1;
  }
  if (file.state === "FAILED") {
    throw new Error("Gemini failed to process the uploaded file.");
  }
  if (file.state === "PROCESSING") {
    throw new Error("Gemini is still processing the file — try again in a moment.");
  }
  if (!file.uri) {
    throw new Error("Gemini did not return a URI for the processed file.");
  }

  return { fileUri: file.uri, mimeType: file.mimeType, name: uploaded.name };
}

export async function generateAiFeedback(
  entry: Pick<
    WorkoutEntry,
    "videoSource" | "videoUrl" | "youtubeId" | "exerciseName" | "weight" | "sets" | "reps"
  >
): Promise<AiFeedbackResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  let mediaPart: { fileData: { fileUri: string; mimeType?: string } };
  let uploadedFileName: string | undefined;

  if (entry.videoSource === "YOUTUBE") {
    if (!entry.youtubeId) {
      throw new Error("This entry is missing its YouTube video ID.");
    }

    try {
      // Download the video ourselves and upload it to Gemini directly, rather than relying
      // on Gemini to fetch the YouTube video — Gemini only recognizes videos Google's own
      // systems have already indexed, which can lag behind a recent/low-view upload by a day
      // or more.
      const { blob, mimeType } = await downloadYoutubeVideo(entry.youtubeId);
      const uploaded = await uploadBlobToGemini(ai, blob, mimeType);
      uploadedFileName = uploaded.name;
      mediaPart = { fileData: { fileUri: uploaded.fileUri, mimeType: uploaded.mimeType } };
    } catch (err) {
      console.error("[ai-feedback] yt-dlp download failed, falling back to direct URL:", err);
      // Fall back to handing Gemini the canonical URL directly — still works for videos
      // Google has already indexed, and keeps the feature working if yt-dlp can't reach
      // this video for some reason (blocked, unsupported format, binary unavailable, etc.).
      const canonicalUrl = `https://www.youtube.com/watch?v=${entry.youtubeId}`;
      mediaPart = { fileData: { fileUri: canonicalUrl, mimeType: "video/mp4" } };
    }
  } else {
    const res = await fetch(entry.videoUrl);
    if (!res.ok) {
      throw new Error("Could not fetch the video file for analysis.");
    }
    const mimeType = res.headers.get("content-type") ?? "video/mp4";
    const blob = await res.blob();

    const uploaded = await uploadBlobToGemini(ai, blob, mimeType);
    uploadedFileName = uploaded.name;
    mediaPart = { fileData: { fileUri: uploaded.fileUri, mimeType: uploaded.mimeType } };
  }

  try {
    let response;
    try {
      response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              mediaPart,
              { text: buildPrompt(entry.exerciseName, entry.weight, entry.sets, entry.reps) },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (entry.videoSource === "YOUTUBE" && message.includes("PERMISSION_DENIED")) {
        throw new Error(
          "Gemini couldn't access this YouTube video. Very recently uploaded, unlisted, or " +
            "low-view videos aren't always indexed yet — this usually resolves within a day or " +
            "two. If it persists, try re-uploading the file directly instead."
        );
      }
      throw err;
    }

    const raw = response.text;
    if (!raw) {
      throw new Error("Gemini returned an empty response.");
    }

    let parsed: { rating?: unknown; feedback?: unknown } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fall through to the salvage path below.
    }

    const feedback = typeof parsed.feedback === "string" ? parsed.feedback.trim() : raw.trim();
    const rating =
      typeof parsed.rating === "number" ? parsed.rating : extractFallbackRating(raw);

    return {
      rating: Math.max(1, Math.min(5, Math.round(rating))),
      feedback,
    };
  } finally {
    if (uploadedFileName) {
      await ai.files.delete({ name: uploadedFileName }).catch(() => {});
    }
  }
}
