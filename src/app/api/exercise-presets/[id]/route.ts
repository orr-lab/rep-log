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
  const preset = await prisma.exercisePreset.findUnique({ where: { id, userId: session.userId } });
  if (!preset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.exercisePreset.delete({ where: { id, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
