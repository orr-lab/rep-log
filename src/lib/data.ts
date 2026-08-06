import { prisma } from "@/lib/prisma";
import type { WorkoutEntry, ManualRecord, ExerciseCategory } from "@/lib/types";

export async function getAllEntries(userId: string): Promise<WorkoutEntry[]> {
  const rows = await prisma.workoutEntry.findMany({
    where: { userId },
    orderBy: { recordedAt: "desc" },
  });
  return rows.map((r) => ({
    ...r,
    recordedAt: r.recordedAt.toISOString(),
    aiFeedbackAt: r.aiFeedbackAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getAllManualRecords(userId: string): Promise<ManualRecord[]> {
  const rows = await prisma.manualRecord.findMany({
    where: { userId },
    orderBy: { recordedAt: "desc" },
  });
  return rows.map((r) => ({
    ...r,
    recordedAt: r.recordedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Every category with its presets nested inside, alphabetized -- the shape the picker UI (in
 *  AddPlanDialog and the main entry form) and the Settings management panel both want directly,
 *  no client-side grouping needed. */
export async function getExerciseCategories(userId: string): Promise<ExerciseCategory[]> {
  const rows = await prisma.exerciseCategory.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { presets: { orderBy: { name: "asc" } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt.toISOString(),
    presets: r.presets.map((p) => ({
      id: p.id,
      name: p.name,
      weight: p.weight,
      grade: p.grade,
      sets: p.sets,
      reps: p.reps,
      notes: p.notes,
      link: p.link,
      categoryId: p.categoryId,
      createdAt: p.createdAt.toISOString(),
    })),
  }));
}
