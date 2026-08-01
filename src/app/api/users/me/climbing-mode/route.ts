import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setClimbingModeSchema, firstZodError } from "@/lib/validation";
import { setClimbingMode } from "@/lib/users";

// Personal setting, like /me/password and /me/visitor-password -- any owner may call this for
// their own account, not just the admin (unlike /me/public-profile and /me/video-uploads, which
// are deliberately admin-only app-wide toggles).
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = setClimbingModeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  await setClimbingMode(session.userId, parsed.data.enabled);
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}
