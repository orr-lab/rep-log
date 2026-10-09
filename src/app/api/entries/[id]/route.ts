import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { entryUpdateSchema } from "@/lib/validation";
import { getSession } from "@/lib/session";
import { deleteStoredVideo } from "@/lib/video-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await prisma.workoutEntry.findUnique({
    where: { id, userId: session.userId },
  });
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(entry);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = entryUpdateSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.workoutEntry.findUnique({
    where: { id, userId: session.userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { recordedAt, videos, ...rest } = parsed.data;

  // Presence of `videos` (even []) means "replace the full set of extra videos" -- its absence
  // (e.g. a plain isFavorite toggle) leaves them untouched. Any UPLOAD-sourced videos being
  // dropped get their stored file (R2, or Blob for older uploads) cleaned up once the DB write
  // has actually committed.
  let staleUploadUrls: string[] = [];
  try {
    const entry = await prisma.$transaction(async (tx) => {
      if (videos !== undefined) {
        const current = await tx.entryVideo.findMany({
          where: { entryId: id },
          select: { videoUrl: true, videoSource: true },
        });
        staleUploadUrls = current
          .filter((v) => v.videoSource === "UPLOAD")
          .map((v) => v.videoUrl);
        await tx.entryVideo.deleteMany({ where: { entryId: id } });
        if (videos.length > 0) {
          await tx.entryVideo.createMany({
            data: videos.map((v, i) => ({ ...v, entryId: id, order: i })),
          });
        }
      }
      return tx.workoutEntry.update({
        where: { id },
        data: {
          ...rest,
          ...(recordedAt ? { recordedAt: new Date(recordedAt) } : {}),
        },
        include: { videos: { orderBy: { order: "asc" } } },
      });
    });

    await Promise.all(staleUploadUrls.map(deleteStoredVideo));

    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await prisma.workoutEntry.findUnique({
    where: { id, userId: session.userId },
    include: { videos: { select: { videoSource: true, videoUrl: true } } },
  });

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (entry.videoSource === "UPLOAD" && entry.videoUrl) {
    await deleteStoredVideo(entry.videoUrl);
  }
  await Promise.all(
    entry.videos
      .filter((v) => v.videoSource === "UPLOAD")
      .map((v) => deleteStoredVideo(v.videoUrl))
  );

  try {
    await prisma.workoutEntry.delete({ where: { id, userId: session.userId } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
