import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setPublicProfileSchema, firstZodError } from "@/lib/validation";
import { setPublicProfileEnabled } from "@/lib/users";

// Deliberately admin-only, unlike /me/password and /me/visitor-password which any owner may
// call — middleware's ADMIN_ONLY_API_PATTERNS excludes all of /me/* on purpose so regular users
// keep their self-service routes, so this route's admin check has to live in the handler itself.
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!(session?.isAdmin && session.role === "owner")) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = setPublicProfileSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  await setPublicProfileEnabled(session.userId, parsed.data.enabled);
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}
