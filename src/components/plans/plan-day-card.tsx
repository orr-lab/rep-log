"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddPlanDialog } from "@/components/plans/add-plan-dialog";
import { PlanCard } from "@/components/plans/plan-card";
import { planDayKey } from "@/lib/plans";
import type { Role } from "@/lib/auth";
import type { ExerciseCategory, WorkoutPlan } from "@/lib/types";

export function PlanDayCard({
  day,
  dayPlans,
  role,
  climbingMode,
  categories,
  isToday,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  day: Date;
  dayPlans: WorkoutPlan[];
  role: Role | null;
  climbingMode: boolean;
  categories: ExerciseCategory[];
  isToday: boolean;
  onCreated: (plan: WorkoutPlan) => void;
  onUpdated: (plan: WorkoutPlan) => void;
  onDeleted: (id: string) => void;
}) {
  const key = planDayKey(day);
  const weekday = day.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
  const monthDay = day.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const fullDate = day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const header = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {weekday}
      </p>
      <p className="text-sm font-semibold">{monthDay}</p>
    </>
  );

  return (
    <div
      className={`space-y-4 rounded-xl border p-3 ${isToday ? "border-primary/50 bg-primary/5" : ""}`}
    >
      {dayPlans.length > 0 ? (
        // The day-strip columns are too narrow on desktop for the inline plan cards below to
        // show their full exercise name/notes without truncating -- this header doubles as a
        // trigger for a dialog with the same plans rendered at full (non-compact) width instead.
        <Dialog>
          <DialogTrigger
            aria-label={`View ${fullDate}'s plan in full`}
            // -mx/-mt (not -m) deliberately excludes the bottom side -- a full -m-1 cancels out
            // the parent's space-y-4 gap to the plan list below (margin-bottom stacks against
            // margin-block-end from space-y, and the negative one wins), which is exactly what
            // made the header and first card look jammed together.
            className="-mx-1 -mt-1 block w-full rounded-md px-1 pt-1 text-left transition-colors hover:bg-muted/60"
          >
            {header}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{fullDate}</DialogTitle>
              <DialogDescription>
                {dayPlans.length} plan{dayPlans.length === 1 ? "" : "s"} for this day
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {dayPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  role={role}
                  climbingMode={climbingMode}
                  categories={categories}
                  onDeleted={onDeleted}
                  onUpdated={onUpdated}
                  compact={false}
                />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <div>{header}</div>
      )}

      <div className="space-y-2">
        {dayPlans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            role={role}
            climbingMode={climbingMode}
            categories={categories}
            onDeleted={onDeleted}
            onUpdated={onUpdated}
          />
        ))}
      </div>

      <AddPlanDialog
        plannedDate={key}
        climbingMode={climbingMode}
        categories={categories}
        onCreated={onCreated}
      />
    </div>
  );
}
