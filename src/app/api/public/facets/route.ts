import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicAdminUserId } from "@/lib/public-scope";
import { isClimbingModeEnabled } from "@/lib/users";

export async function GET() {
  const adminId = await getPublicAdminUserId();
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await prisma.workoutEntry.findMany({
    where: { userId: adminId },
    select: { exerciseName: true, tags: true, gym: true },
  });

  const exercises = Array.from(new Set(entries.map((e) => e.exerciseName))).sort((a, b) =>
    a.localeCompare(b)
  );
  const tags = Array.from(new Set(entries.flatMap((e) => e.tags))).sort((a, b) =>
    a.localeCompare(b)
  );
  const gyms = Array.from(
    new Set(entries.map((e) => e.gym).filter((g): g is string => g != null))
  ).sort((a, b) => a.localeCompare(b));
  const climbingMode = await isClimbingModeEnabled(adminId);

  return NextResponse.json({ exercises, tags, gyms, climbingMode });
}
