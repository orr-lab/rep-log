import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { planUpdateSchema } from "@/lib/validation";
import { getSession } from "@/lib/session";

// Same ownership rule as DELETE below: owner can edit any plan for their own account (including
// fulfilled ones -- editing never touches the WorkoutEntry rows a plan is linked to), a visitor
// may only edit plans they created themselves that don't have any logged entries yet.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.workoutPlan.findUnique({
    where: { id, userId: session.userId },
    select: { id: true, createdByRole: true, _count: { select: { fulfillingEntries: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canEdit =
    session.role === "owner" ||
    (existing.createdByRole === "visitor" && existing._count.fulfillingEntries === 0);

  if (!canEdit) {
    return NextResponse.json(
      { error: "You can only edit your own plans that haven't been fulfilled yet." },
      { status: 403 }
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = planUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { plannedDate, ...rest } = parsed.data;

  const plan = await prisma.workoutPlan.update({
    where: { id, userId: session.userId },
    data: { ...rest, plannedDate: new Date(plannedDate) },
    include: { fulfillingEntries: { select: { id: true }, orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json(plan);
}

// Owner can delete any plan for their own account (including fulfilled ones -- this never
// touches the WorkoutEntry rows it's linked to, only the plan record). A visitor may only delete
// plans they created themselves that don't have any logged entries yet, so they can correct a
// mistake without being able to erase the owner's planning history or an already-completed plan.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const plan = await prisma.workoutPlan.findUnique({
    where: { id, userId: session.userId },
    select: { id: true, createdByRole: true, _count: { select: { fulfillingEntries: true } } },
  });

  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canDelete =
    session.role === "owner" ||
    (plan.createdByRole === "visitor" && plan._count.fulfillingEntries === 0);

  if (!canDelete) {
    return NextResponse.json(
      { error: "You can only delete your own plans that haven't been fulfilled yet." },
      { status: 403 }
    );
  }

  await prisma.workoutPlan.delete({ where: { id, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
