import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setPasswordSchema, firstZodError } from "@/lib/validation";
import { resetUserPassword, PasswordInUseError, UserNotFoundError } from "@/lib/users";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!(session?.isAdmin && session.role === "owner")) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = setPasswordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  try {
    await resetUserPassword(id, parsed.data.password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PasswordInUseError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof UserNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
