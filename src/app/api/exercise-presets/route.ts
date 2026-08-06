import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { exercisePresetInputSchema, firstZodError } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = exercisePresetInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  const category = await prisma.exerciseCategory.findUnique({
    where: { id: parsed.data.categoryId, userId: session.userId },
  });
  if (!category) {
    return NextResponse.json({ error: "That category no longer exists." }, { status: 404 });
  }

  try {
    const preset = await prisma.exercisePreset.create({
      data: {
        name: parsed.data.name,
        weight: parsed.data.weight ?? null,
        grade: parsed.data.grade ?? null,
        sets: parsed.data.sets ?? null,
        reps: parsed.data.reps ?? null,
        notes: parsed.data.notes ?? null,
        link: parsed.data.link ?? null,
        categoryId: category.id,
        userId: session.userId,
      },
    });
    return NextResponse.json(preset, { status: 201 });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return NextResponse.json(
        { error: "That category already has an exercise with that name." },
        { status: 409 }
      );
    }
    throw err;
  }
}
