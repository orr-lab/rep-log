import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionCookieValue } from "@/lib/auth";
import { findUserByUsernameAndPassword } from "@/lib/users";
import { loginSchema } from "@/lib/validation";
import {
  clearLoginAttempts,
  getClientIp,
  isLoginRateLimited,
  recordFailedLoginAttempt,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const json = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  const username = parsed.success ? parsed.data.username : "";

  const { limited, retryAfterSeconds } = await isLoginRateLimited(ip, username);
  if (limited) {
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${retryAfterSeconds} second${
          retryAfterSeconds === 1 ? "" : "s"
        }.`,
      },
      { status: 429 }
    );
  }

  if (!parsed.success) {
    await recordFailedLoginAttempt(ip, username);
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  const match = await findUserByUsernameAndPassword(parsed.data.username, parsed.data.password);
  if (!match) {
    await recordFailedLoginAttempt(ip, username);
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  await clearLoginAttempts(ip, username);

  const response = NextResponse.json({ ok: true, role: match.role, isAdmin: match.isAdmin });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionCookieValue({ userId: match.id, role: match.role, isAdmin: match.isAdmin }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    }
  );
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
