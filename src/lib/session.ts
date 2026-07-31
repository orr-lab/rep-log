import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionCookie, type Role, type SessionPayload } from "@/lib/auth";

export type Session = SessionPayload;

/** Server-component/route-handler helper: reads and verifies the session cookie. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionCookie(store.get(SESSION_COOKIE)?.value);
}

/** Thin wrapper for call sites that only need the role. */
export async function getSessionRole(): Promise<Role | null> {
  const session = await getSession();
  return session?.role ?? null;
}
