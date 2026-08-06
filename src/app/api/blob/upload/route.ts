import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isVideoUploadEnabled, getMaxUploadBytes } from "@/lib/users";

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isVideoUploadEnabled())) {
    return NextResponse.json(
      { error: "Direct video uploads are currently turned off. Paste a YouTube link instead." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;
  const maxUploadBytes = await getMaxUploadBytes();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-m4v",
            "video/ogg",
          ],
          maximumSizeInBytes: maxUploadBytes,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // No server-side action needed; the client creates the WorkoutEntry
        // once the upload finishes and it has the final blob URL.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
