import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { changeOwnPasswordSchema, firstZodError } from "@/lib/validation";
import { changeOwnPassword, PasswordInUseError, WrongPasswordError } from "@/lib/users";

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = changeOwnPasswordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  try {
    await changeOwnPassword(session.userId, parsed.data.currentPassword, parsed.data.newPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WrongPasswordError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PasswordInUseError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
