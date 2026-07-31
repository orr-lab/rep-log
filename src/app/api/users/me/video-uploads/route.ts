import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setVideoUploadsSchema, firstZodError } from "@/lib/validation";
import { setVideoUploadsEnabled } from "@/lib/users";

// Deliberately admin-only, same reasoning as /me/public-profile — this is an app-wide setting
// (it affects every account's upload capability), not a personal one, even though it lives
// under /me/* for the caller's own convenience of updating their own row.
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!(session?.isAdmin && session.role === "owner")) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = setVideoUploadsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  await setVideoUploadsEnabled(session.userId, parsed.data.enabled);
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}
