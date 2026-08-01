import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.workoutEntry.findMany({
    where: { userId: session.userId },
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

  return NextResponse.json({ exercises, tags, gyms });
}
