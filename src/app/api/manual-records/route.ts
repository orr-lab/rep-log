import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { manualRecordInputSchema, firstZodError } from "@/lib/validation";
import { getSession } from "@/lib/session";

// Any authenticated session (owner or visitor) can read manual records -- they factor into the
// records page's PR/best-grade calculation the same way logged entries do. Only the owner can
// create one (see POST below): unlike comments/plans, a fabricated PR isn't something a visitor
// should be able to add.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await prisma.manualRecord.findMany({
    where: { userId: session.userId },
    orderBy: { recordedAt: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = manualRecordInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  const { recordedAt, ...rest } = parsed.data;

  const record = await prisma.manualRecord.create({
    data: {
      ...rest,
      recordedAt: new Date(recordedAt),
      userId: session.userId,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
