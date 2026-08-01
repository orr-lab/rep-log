import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { WorkoutEntry } from "@/lib/types";
import { WorkoutEntryForm } from "@/components/workout-entry-form";
import { getSession } from "@/lib/session";
import { isVideoUploadEnabled, isClimbingModeEnabled } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const row = await prisma.workoutEntry.findUnique({
    where: { id, userId: session.userId },
  });
  if (!row) notFound();

  const [uploadsEnabled, climbingMode] = await Promise.all([
    isVideoUploadEnabled(),
    isClimbingModeEnabled(session.userId),
  ]);

  const entry: WorkoutEntry = {
    ...row,
    recordedAt: row.recordedAt.toISOString(),
    aiFeedbackAt: row.aiFeedbackAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Edit entry</h1>
        <p className="text-muted-foreground">{entry.exerciseName}</p>
      </div>
      <WorkoutEntryForm
        mode="edit"
        initialData={entry}
        userId={session.userId}
        uploadsEnabled={uploadsEnabled}
        climbingMode={climbingMode}
      />
    </div>
  );
}
