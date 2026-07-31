import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setPasswordSchema, firstZodError } from "@/lib/validation";
import { setVisitorPassword, clearVisitorPassword, PasswordInUseError } from "@/lib/users";

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = setPasswordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  try {
    await setVisitorPassword(session.userId, parsed.data.password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PasswordInUseError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await clearVisitorPassword(session.userId);
  return NextResponse.json({ ok: true });
}
