import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createUserSchema, firstZodError } from "@/lib/validation";
import { createUser, listUsers, PasswordInUseError, UsernameInUseError } from "@/lib/users";

function requireAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  return session?.isAdmin && session.role === "owner";
}

export async function GET() {
  const session = await getSession();
  if (!requireAdmin(session)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!requireAdmin(session)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  try {
    const user = await createUser(parsed.data);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof PasswordInUseError || err instanceof UsernameInUseError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
