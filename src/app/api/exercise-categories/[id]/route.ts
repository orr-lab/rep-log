import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const category = await prisma.exerciseCategory.findUnique({ where: { id, userId: session.userId } });
  if (!category) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascades to its presets (see onDelete: Cascade on ExercisePreset.category).
  await prisma.exerciseCategory.delete({ where: { id, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
