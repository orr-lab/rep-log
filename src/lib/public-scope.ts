import { prisma } from "@/lib/prisma";

/**
 * Resolves the admin's user id for the public "/visitor" surface — but only when the admin has
 * explicitly opted in via the Settings toggle. Returns null if the toggle is off, which every
 * caller must treat as "nothing to show" (notFound() for pages, 404 for API routes). This is the
 * real enforcement for the whole public surface, checked fresh on every request — not the login
 * page's button, which is just discoverability.
 */
export async function getPublicAdminUserId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { isAdmin: true, publicProfileEnabled: true },
    select: { id: true },
  });
  return admin?.id ?? null;
}
