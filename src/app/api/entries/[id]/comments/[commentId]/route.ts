import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Belt-and-suspenders: middleware already blocks non-owner mutations on this path (it's not
  // in VISITOR_ALLOWED_MUTATION_PATTERNS), but only the entry's own owner may delete a comment.
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can delete comments." }, { status: 403 });
  }

  const { id, commentId } = await params;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, entryId: true, entry: { select: { userId: true } } },
  });

  if (!comment || comment.entryId !== id || comment.entry.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.comment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
