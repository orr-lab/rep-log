import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { planInputSchema } from "@/lib/validation";
import { getSession } from "@/lib/session";

// Both owner and visitor may list and create plans -- this is the "any non-public visitor can
// add a workout plan" feature. Visitors are otherwise blocked from every mutating API call (see
// the role check in middleware); POST here is one of the deliberate carve-outs, alongside
// comments (see VISITOR_ALLOWED_MUTATION_PATTERNS in src/middleware.ts).
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const start = params.get("start");
  const end = params.get("end");

  const plans = await prisma.workoutPlan.findMany({
    where: {
      userId: session.userId,
      ...(start && end
        ? { plannedDate: { gte: new Date(start), lte: new Date(end) } }
        : {}),
    },
    orderBy: { plannedDate: "asc" },
    include: { fulfillingEntries: { select: { id: true }, orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json(plans);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = planInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { plannedDate, ...rest } = parsed.data;

  const plan = await prisma.workoutPlan.create({
    data: {
      ...rest,
      plannedDate: new Date(plannedDate),
      createdByRole: session.role,
      userId: session.userId,
    },
    include: { fulfillingEntries: { select: { id: true } } },
  });

  return NextResponse.json(plan, { status: 201 });
}
