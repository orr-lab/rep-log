import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { entryUpdateSchema } from "@/lib/validation";
import { getSession } from "@/lib/session";
import { deleteStoredVideo } from "@/lib/video-storage";
import { promoteEntryUploads, UploadRejectedError, type Promotions, withoutUploadToken } from "@/lib/pending-uploads";

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
    select: {
      videoSource: true,
      videoUrl: true,
      videos: { select: { videoSource: true, videoUrl: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { recordedAt, videos, uploadToken, ...rest } = parsed.data;

  // The entry's own uploaded videos may be sent back as-is (kept or reordered); anything else
  // with videoSource UPLOAD must be a fresh pending/ upload with its token, which gets moved to
  // videos/ before the write -- see src/lib/pending-uploads.ts.
  const currentUploadUrls = [existing, ...existing.videos]
    .filter((v) => v.videoSource === "UPLOAD")
    .map((v) => v.videoUrl);
  const refs = [
    ...(rest.videoUrl !== undefined
      ? [{ videoSource: rest.videoSource ?? existing.videoSource, videoUrl: rest.videoUrl, uploadToken }]
      : []),
    ...(videos ?? []),
  ];
  let promotions: Promotions;
  try {
    promotions = await promoteEntryUploads(refs, session.userId, new Set(currentUploadUrls));
  } catch (err) {
    if (err instanceof UploadRejectedError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
  if (rest.videoUrl !== undefined) rest.videoUrl = refs[0].videoUrl;

  // Presence of `videos` (even []) means "replace the full set of extra videos" -- its absence
  // (e.g. a plain isFavorite toggle) leaves them untouched. Any of the entry's uploaded videos --
  // a replaced primary or a dropped extra -- that the entry no longer references after this save
  // gets its R2 object deleted once the write has committed. Only those: kept videos are sent back
  // with the same URL (and one can move between primary and extras) and must survive.
  const stillUsed = new Set([
    rest.videoUrl ?? existing.videoUrl,
    ...(videos ?? existing.videos).map((v) => v.videoUrl),
  ]);
  const staleUploadUrls = [...new Set(currentUploadUrls)].filter((url) => !stillUsed.has(url));
  try {
    const entry = await prisma.$transaction(async (tx) => {
      if (videos !== undefined) {
        await tx.entryVideo.deleteMany({ where: { entryId: id } });
        if (videos.length > 0) {
          await tx.entryVideo.createMany({
            data: videos.map((v, i) => ({ ...withoutUploadToken(v), entryId: id, order: i })),
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

    await promotions.commit();
    await Promise.all(staleUploadUrls.map(deleteStoredVideo));

    return NextResponse.json(entry);
  } catch {
    await promotions.rollback();
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
