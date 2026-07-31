import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password-hash";

export class PasswordInUseError extends Error {
  constructor() {
    super("That password is already in use on this account — pick a different one.");
  }
}

export class UsernameInUseError extends Error {
  constructor() {
    super("That username is already taken.");
  }
}

export class WrongPasswordError extends Error {
  constructor() {
    super("Current password is incorrect.");
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found.");
  }
}

export class CannotDeleteAdminError extends Error {
  constructor() {
    super("The admin account can't be deleted.");
  }
}

/** A visitor password must not equal that same account's own login password, and vice versa. */
async function conflictsWithOwnOtherField(
  userId: string,
  candidate: string,
  field: "passwordHash" | "visitorPasswordHash"
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, visitorPasswordHash: true },
  });
  if (!user) return false;

  const otherHash = field === "passwordHash" ? user.visitorPasswordHash : user.passwordHash;
  if (!otherHash) return false;

  return verifyPassword(candidate, otherHash);
}

export async function findUserByUsernameAndPassword(
  username: string,
  password: string
): Promise<{ id: string; role: "owner" | "visitor"; isAdmin: boolean } | null> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, isAdmin: true, passwordHash: true, visitorPasswordHash: true },
  });
  if (!user) return null;

  if (await verifyPassword(password, user.passwordHash)) {
    return { id: user.id, role: "owner", isAdmin: user.isAdmin };
  }

  if (user.visitorPasswordHash && (await verifyPassword(password, user.visitorPasswordHash))) {
    return { id: user.id, role: "visitor", isAdmin: user.isAdmin };
  }

  return null;
}

export async function createUser(input: { username: string; password: string }) {
  const existing = await prisma.user.findUnique({
    where: { username: input.username },
    select: { id: true },
  });
  if (existing) throw new UsernameInUseError();

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: { username: input.username, isAdmin: false, passwordHash },
    select: { id: true, username: true, createdAt: true },
  });
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    where: { isAdmin: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, createdAt: true, visitorPasswordHash: true },
  });

  return users.map((u) => ({
    id: u.id,
    username: u.username,
    createdAt: u.createdAt,
    hasVisitorPassword: u.visitorPasswordHash !== null,
  }));
}

export async function deleteUserCascade(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!user) throw new UserNotFoundError();
  if (user.isAdmin) throw new CannotDeleteAdminError();

  const entries = await prisma.workoutEntry.findMany({
    where: { userId, videoSource: "UPLOAD" },
    select: { videoUrl: true },
  });
  await Promise.all(entries.map((e) => del(e.videoUrl).catch(() => {})));

  await prisma.user.delete({ where: { id: userId } });
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new UserNotFoundError();

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new WrongPasswordError();
  }

  if (await conflictsWithOwnOtherField(userId, newPassword, "passwordHash")) {
    throw new PasswordInUseError();
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function resetUserPassword(targetUserId: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!user) throw new UserNotFoundError();

  if (await conflictsWithOwnOtherField(targetUserId, newPassword, "passwordHash")) {
    throw new PasswordInUseError();
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: targetUserId }, data: { passwordHash } });
}

export async function setVisitorPassword(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new UserNotFoundError();

  if (await conflictsWithOwnOtherField(userId, password, "visitorPasswordHash")) {
    throw new PasswordInUseError();
  }

  const visitorPasswordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { visitorPasswordHash } });
}

export async function clearVisitorPassword(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { visitorPasswordHash: null } });
}

export async function setPublicProfileEnabled(userId: string, enabled: boolean): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { publicProfileEnabled: enabled } });
}

/** App-wide setting (stored on the admin's row, but affects every account's upload capability). */
export async function isVideoUploadEnabled(): Promise<boolean> {
  const admin = await prisma.user.findFirst({
    where: { isAdmin: true },
    select: { videoUploadsEnabled: true },
  });
  return admin?.videoUploadsEnabled ?? true;
}

export async function setVideoUploadsEnabled(userId: string, enabled: boolean): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { videoUploadsEnabled: enabled } });
}
