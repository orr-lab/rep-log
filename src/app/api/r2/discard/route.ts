import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { deleteR2Object } from "@/lib/r2";
import { verifyUploadToken } from "@/lib/pending-uploads";

const requestSchema = z.object({ uploadToken: z.string().min(1).max(1000) });

// Deletes a not-yet-saved upload right away when the user throws it out ("Choose a different
// file", removing an additional video). Only ever touches the pending/ key the token was issued
// for, to the same user -- saved videos under videos/ can't be reached through here. Best effort
// from the client's side; the pending/ lifecycle rule cleans up anything this misses.
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  const key = parsed.success ? verifyUploadToken(parsed.data.uploadToken, session.userId) : null;
  if (!key) return NextResponse.json({ error: "Invalid upload token." }, { status: 400 });

  try {
    await deleteR2Object(key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to discard pending upload:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not discard the upload." }, { status: 500 });
  }
}
