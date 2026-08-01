import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Owner can delete any plan for their own account (including fulfilled ones -- this never
// touches the WorkoutEntry it's linked to, only the plan record). A visitor may only delete
// plans they created themselves that haven't been fulfilled yet, so they can correct a mistake
// without being able to erase the owner's planning history or an already-completed plan.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const plan = await prisma.workoutPlan.findUnique({
    where: { id, userId: session.userId },
    select: { id: true, createdByRole: true, fulfilledEntryId: true },
  });

  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canDelete =
    session.role === "owner" ||
    (plan.createdByRole === "visitor" && plan.fulfilledEntryId === null);

  if (!canDelete) {
    return NextResponse.json(
      { error: "You can only delete your own plans that haven't been fulfilled yet." },
      { status: 403 }
    );
  }

  await prisma.workoutPlan.delete({ where: { id, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
