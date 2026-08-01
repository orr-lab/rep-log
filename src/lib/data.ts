import { prisma } from "@/lib/prisma";
import type { WorkoutEntry, ManualRecord } from "@/lib/types";

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
