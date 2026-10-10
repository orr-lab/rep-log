import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { isVideoUploadEnabled, getMaxUploadBytes } from "@/lib/users";
import { presignVideoUpload, publicUrlForKey, newVideoKey } from "@/lib/r2";

const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/ogg",
] as const;

const requestSchema = z.object({
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  size: z.number().int().positive(),
});

// Hands the browser a short-lived presigned PUT for a single video. R2 has no POST policies, so
// the size/type limits are checked here against what the
// client declares, and then signed into the URL (Content-Length + Content-Type) -- R2 rejects a
// PUT whose body doesn't match them.
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isVideoUploadEnabled())) {
    return NextResponse.json(
      { error: "Direct video uploads are currently turned off. Paste a YouTube link instead." },
      { status: 403 }
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Unsupported file type or invalid upload request." }, { status: 400 });
  }
  const { contentType, size } = parsed.data;

  const maxUploadBytes = await getMaxUploadBytes();
  if (size > maxUploadBytes) {
    return NextResponse.json({ error: "That file is over the upload size limit." }, { status: 413 });
  }

  try {
    const key = newVideoKey();
    const { uploadUrl, headers } = await presignVideoUpload(key, contentType, size);
    return NextResponse.json({ uploadUrl, headers, url: publicUrlForKey(key) });
  } catch (error) {
    console.error("Failed to presign R2 upload:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
