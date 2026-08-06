import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getExerciseCategories } from "@/lib/data";
import { exerciseCategoryInputSchema, firstZodError } from "@/lib/validation";

// Any signed-in session (owner or visitor) can read the catalog -- a trainer using the visitor
// role needs it to pick presets when planning a session. Only the owner can create categories
// (see POST below); visitor mutations are blocked by default in middleware, no carve-out needed.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await getExerciseCategories(session.userId);
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = exerciseCategoryInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  try {
    const category = await prisma.exerciseCategory.create({
      data: { name: parsed.data.name, userId: session.userId },
    });
    return NextResponse.json({ ...category, presets: [] }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "You already have a category with that name." }, { status: 409 });
    }
    throw err;
  }
}
