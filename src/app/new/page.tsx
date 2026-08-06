import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { WorkoutEntryForm } from "@/components/workout-entry-form";
import { getSession } from "@/lib/session";
import { isVideoUploadEnabled, isClimbingModeEnabled, getMaxUploadBytes } from "@/lib/users";
import { prisma } from "@/lib/prisma";
import { formatGrade } from "@/lib/climbing";

export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { planId } = await searchParams;

  const [uploadsEnabled, maxUploadBytes, climbingMode, plan] = await Promise.all([
    isVideoUploadEnabled(),
    getMaxUploadBytes(),
    isClimbingModeEnabled(session.userId),
    planId
      ? prisma.workoutPlan.findUnique({ where: { id: planId, userId: session.userId } })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {climbingMode ? "Log a new climb" : "Log a new set"}
        </h1>
        <p className="text-muted-foreground">
          {climbingMode
            ? "Capture how this send went while it's fresh."
            : "Capture how this set went while it's fresh."}
        </p>
      </div>

      {plan && (
        <div className="mb-6 space-y-1 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">
            From this week&apos;s plan
            {plan.grade != null ? ` — ${formatGrade(plan.grade)}` : ""}
          </p>
          {plan.notes && <p className="text-sm text-muted-foreground">{plan.notes}</p>}
          {plan.link && (
            <a
              href={plan.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" /> Reference link
            </a>
          )}
        </div>
      )}

      <WorkoutEntryForm
        mode="create"
        userId={session.userId}
        uploadsEnabled={uploadsEnabled}
        maxUploadBytes={maxUploadBytes}
        climbingMode={climbingMode}
        fromPlan={
          plan
            ? {
                id: plan.id,
                exerciseName: plan.exerciseName,
                weight: plan.weight,
                grade: plan.grade,
                sets: plan.sets,
                reps: plan.reps,
                notes: plan.notes,
              }
            : undefined
        }
      />
    </div>
  );
}
