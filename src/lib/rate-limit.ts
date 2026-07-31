import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;
// 15 minutes — a standard lockout window (OWASP's authentication guidance suggests several
// minutes to an hour; this errs toward the shorter end since a wrong guess here only exposes a
// personal workout log, not something high-value).
const WINDOW_MS = 15 * 60 * 1000;

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}

/**
 * Blocked once this exact (ip, username) pair has hit the threshold within the window.
 * Tracking the pair rather than either alone is a deliberate trade-off: an attacker still can't
 * grind forever against one account from a single IP, but they also can't lock the real owner
 * out of their own account by repeatedly failing from a *different* IP — usernames aren't secret,
 * so a username-only limit would let anyone who knows it deny the real owner access on demand.
 * The cost is that a determined attacker rotating through many IPs isn't capped in aggregate —
 * an acceptable trade for a low-value personal app.
 */
export async function isLoginRateLimited(
  ip: string,
  username: string
): Promise<{ limited: boolean; retryAfterSeconds?: number }> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const attempts = await prisma.loginAttempt.findMany({
    where: { ip, username, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "asc" },
  });

  if (attempts.length < MAX_ATTEMPTS) {
    return { limited: false };
  }

  const retryAfterMs = WINDOW_MS - (Date.now() - attempts[0].createdAt.getTime());
  return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

export async function recordFailedLoginAttempt(ip: string, username: string): Promise<void> {
  const windowStart = new Date(Date.now() - WINDOW_MS);
  await prisma.loginAttempt.deleteMany({ where: { ip, username, createdAt: { lt: windowStart } } });
  await prisma.loginAttempt.create({ data: { ip, username } });
}

export async function clearLoginAttempts(ip: string, username: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { ip, username } });
}
