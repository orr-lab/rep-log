import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicAdminUserId } from "@/lib/public-scope";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const adminId = await getPublicAdminUserId();
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const tag = params.get("tag")?.trim();
  const gym = params.get("gym")?.trim();
  const difficulty = params.get("difficulty");
  const favorite = params.get("favorite");
  const sort = params.get("sort") ?? "date";
  const order = params.get("order") === "asc" ? "asc" : "desc";

  const where: Prisma.WorkoutEntryWhereInput = { userId: adminId };

  if (q) where.exerciseName = { contains: q, mode: "insensitive" };
  if (tag) where.tags = { has: tag };
  if (gym) where.gym = { equals: gym, mode: "insensitive" };
  if (difficulty) where.difficulty = Number(difficulty);
  if (favorite === "true") where.isFavorite = true;

  const orderBy: Prisma.WorkoutEntryOrderByWithRelationInput =
    sort === "difficulty"
      ? { difficulty: order }
      : sort === "exercise"
        ? { exerciseName: order }
        : sort === "grade"
          ? { grade: order }
          : { recordedAt: order };

  const entries = await prisma.workoutEntry.findMany({ where, orderBy });
  return NextResponse.json(entries);
}
