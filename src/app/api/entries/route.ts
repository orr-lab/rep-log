import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { entryInputSchema } from "@/lib/validation";
import { getSession } from "@/lib/session";
import { isVideoUploadEnabled } from "@/lib/users";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const tag = params.get("tag")?.trim();
  const gym = params.get("gym")?.trim();
  const difficulty = params.get("difficulty");
  const favorite = params.get("favorite");
  const date = params.get("date");
  const sort = params.get("sort") ?? "date";
  const order = params.get("order") === "asc" ? "asc" : "desc";

  const where: Prisma.WorkoutEntryWhereInput = { userId: session.userId };

  if (q) where.exerciseName = { contains: q, mode: "insensitive" };
  if (tag) where.tags = { has: tag };
  if (gym) where.gym = { equals: gym, mode: "insensitive" };
  if (difficulty) where.difficulty = Number(difficulty);
  if (favorite === "true") where.isFavorite = true;
  if (date) {
    const start = new Date(date);
    if (!Number.isNaN(start.getTime())) {
      where.recordedAt = { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
    }
  }

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

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = entryInputSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { fulfillsPlanId, ...data } = parsed.data;

  if (data.videoSource === "UPLOAD" && !(await isVideoUploadEnabled())) {
    return NextResponse.json(
      { error: "Direct video uploads are currently turned off." },
      { status: 403 }
    );
  }

  if (fulfillsPlanId) {
    const plan = await prisma.workoutPlan.findUnique({
      where: { id: fulfillsPlanId, userId: session.userId },
      select: { id: true, fulfilledEntryId: true },
    });
    if (!plan) {
      return NextResponse.json({ error: "That plan no longer exists." }, { status: 404 });
    }
    if (plan.fulfilledEntryId) {
      return NextResponse.json({ error: "That plan has already been logged." }, { status: 409 });
    }
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.workoutEntry.create({
        data: {
          ...data,
          recordedAt: new Date(data.recordedAt),
          userId: session.userId,
        },
      });
      if (fulfillsPlanId) {
        await tx.workoutPlan.update({
          where: { id: fulfillsPlanId, userId: session.userId },
          data: { fulfilledEntryId: created.id },
        });
      }
      return created;
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2003") {
      return NextResponse.json(
        { error: "Your account no longer exists — please log in again." },
        { status: 401 }
      );
    }
    throw err;
  }
}
