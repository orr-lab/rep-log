import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { entryUpdateSchema } from "@/lib/validation";
import { getSession } from "@/lib/session";

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

  const { recordedAt, ...rest } = parsed.data;

  try {
    const entry = await prisma.workoutEntry.update({
      where: { id, userId: session.userId },
      data: {
        ...rest,
        ...(recordedAt ? { recordedAt: new Date(recordedAt) } : {}),
      },
    });
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
  });

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (entry.videoSource === "UPLOAD" && entry.videoUrl) {
    await del(entry.videoUrl).catch(() => {});
  }

  try {
    await prisma.workoutEntry.delete({ where: { id, userId: session.userId } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
