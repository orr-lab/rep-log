import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { entryInputSchema } from "@/lib/validation";
import { getSession } from "@/lib/session";
import { isVideoUploadEnabled } from "@/lib/users";
import { promoteEntryUploads, UploadRejectedError, type Promotions, withoutUploadToken } from "@/lib/pending-uploads";
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

  const { fulfillsPlanId, videos, uploadToken, ...data } = parsed.data;

  if (data.videoSource === "UPLOAD" && !(await isVideoUploadEnabled())) {
    return NextResponse.json(
      { error: "Direct video uploads are currently turned off." },
      { status: 403 }
    );
  }

  if (fulfillsPlanId) {
    const plan = await prisma.workoutPlan.findUnique({
      where: { id: fulfillsPlanId, userId: session.userId },
      select: { id: true },
    });
    if (!plan) {
      return NextResponse.json({ error: "That plan no longer exists." }, { status: 404 });
    }
  }

  // New uploads are only accepted with their upload token, and get moved from pending/ to videos/
  // before the row is written -- see src/lib/pending-uploads.ts. Nothing to keep on create.
  const primary = { videoSource: data.videoSource, videoUrl: data.videoUrl, uploadToken };
  let promotions: Promotions;
  try {
    promotions = await promoteEntryUploads([primary, ...videos], session.userId, new Set());
  } catch (err) {
    if (err instanceof UploadRejectedError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  try {
    // A plan can be fulfilled by any number of entries, so this is just a direct FK on create --
    // no need to also touch the plan row.
    const entry = await prisma.workoutEntry.create({
      data: {
        ...data,
        videoUrl: primary.videoUrl,
        recordedAt: new Date(data.recordedAt),
        userId: session.userId,
        planId: fulfillsPlanId ?? null,
        videos:
          videos.length > 0
            ? { create: videos.map((v, i) => ({ ...withoutUploadToken(v), order: i })) }
            : undefined,
      },
      include: { videos: { orderBy: { order: "asc" } } },
    });
    await promotions.commit();
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    await promotions.rollback();
    if (err instanceof Error && "code" in err && err.code === "P2003") {
      return NextResponse.json(
        { error: "Your account no longer exists — please log in again." },
        { status: 401 }
      );
    }
    throw err;
  }
}
