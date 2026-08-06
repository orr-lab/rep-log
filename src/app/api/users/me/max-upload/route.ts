import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setMaxUploadSchema, firstZodError } from "@/lib/validation";
import { setMaxUploadMB } from "@/lib/users";

// Deliberately admin-only, same reasoning as /me/public-profile and /me/video-uploads -- this is
// an app-wide setting (it affects every account's upload ceiling), not a personal one, even
// though it lives under /me/* for the caller's own convenience of updating their own row.
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!(session?.isAdmin && session.role === "owner")) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = setMaxUploadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  await setMaxUploadMB(session.userId, parsed.data.maxUploadMB);
  return NextResponse.json({ ok: true, maxUploadMB: parsed.data.maxUploadMB });
}
