import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { commentInputSchema } from "@/lib/validation";
import { getSession } from "@/lib/session";

// Both owner and visitor roles may post -- this is the one write action a visitor-password
// holder is allowed (see the middleware carve-out in src/middleware.ts). Deleting is owner-only,
// enforced in the [commentId] route below.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await prisma.workoutEntry.findUnique({
    where: { id, userId: session.userId },
    select: { id: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsed = commentInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      body: parsed.data.body,
      authorName: parsed.data.authorName || null,
      postedByRole: session.role,
      entryId: id,
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
