"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditPlanDialog } from "@/components/plans/edit-plan-dialog";
import { formatGrade } from "@/lib/climbing";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";
import type { ExerciseCategory, WorkoutPlan } from "@/lib/types";

export function PlanCard({
  plan,
  role,
  climbingMode,
  categories,
  onDeleted,
  onUpdated,
  compact = true,
}: {
  plan: WorkoutPlan;
  role: Role | null;
  climbingMode: boolean;
  /** The account's exercise-preset categories, see Settings > Exercise presets. */
  categories: ExerciseCategory[];
  onDeleted: (id: string) => void;
  onUpdated: (plan: WorkoutPlan) => void;
  /** Compact (the default) truncates the name and clamps notes to fit the narrow day-strip
   *  columns on desktop -- fine for a quick glance, but the exercise name and notes can get cut
   *  off entirely. Pass `false` for a full-text rendering, e.g. inside a per-day detail dialog. */
  compact?: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const isClimb = plan.grade != null;
  const isFulfilled = plan.fulfilledEntryId != null;
  // Same rule for edit and delete: the owner can touch any plan, a visitor only their own
  // not-yet-fulfilled ones (enforced again, authoritatively, by the API routes themselves).
  const canModify =
    role === "owner" || (role === "visitor" && plan.createdByRole === "visitor" && !isFulfilled);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/plans/${plan.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "Couldn't delete that plan.");
      }
      onDeleted(plan.id);
      toast.success("Plan removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p className={cn("min-w-0 text-sm font-medium leading-tight", compact && "truncate")}>
          {plan.exerciseName}
        </p>
        {isFulfilled ? (
          <Badge variant="secondary" className="shrink-0 gap-1">
            <CheckCircle2 className="size-3.5" /> Done
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">
            {plan.createdByRole === "visitor" ? "Visitor" : "Planned"}
          </Badge>
        )}
      </div>

      {/* Its own row, deliberately outside the flex row above -- sharing that row with the status
          badge left it squeezed down to a couple of characters on the narrow desktop day-strip
          columns (7 across), which is exactly the info someone glancing at the calendar needs.
          Pulled back up against the name via -mt to stay a tight title/subtitle pair despite no
          longer being nested in the same div (the parent's space-y-2 would otherwise push it as
          far from the name as from the next unrelated section). */}
      <p className={cn("-mt-1.5 text-xs text-muted-foreground", compact && "truncate")}>
        {isClimb
          ? formatGrade(plan.grade as number)
          : plan.weight != null
            ? `${plan.weight} lb/kg`
            : "Bodyweight"}
        {plan.sets != null && plan.reps != null ? ` · ${plan.sets}x${plan.reps}` : ""}
      </p>

      {plan.notes && (
        <p
          className={cn(
            "whitespace-pre-wrap text-xs text-muted-foreground",
            compact && "line-clamp-2"
          )}
        >
          {plan.notes}
        </p>
      )}

      {plan.link && (
        <a
          href={plan.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3" /> Reference link
        </a>
      )}

      <div className="flex items-center pt-1">
        {isFulfilled ? (
          <Link
            href={`/entries/${plan.fulfilledEntryId}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            View entry
          </Link>
        ) : role === "owner" ? (
          <Link
            href={`/new?planId=${plan.id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <Plus className="size-3.5" /> Log this
          </Link>
        ) : (
          <span />
        )}
      </div>

      {canModify && (
        // A second row, not sharing space with "Log this" above -- the day-strip columns on
        // desktop are narrow enough (7 across) that Log this + edit + delete side by side would
        // overflow the card's border instead of wrapping.
        <div className="flex items-center justify-end gap-1">
          <EditPlanDialog
            plan={plan}
            climbingMode={climbingMode}
            categories={categories}
            onUpdated={onUpdated}
          />
          <AlertDialog>
            <AlertDialogTrigger
              aria-label="Delete plan"
              className={buttonVariants({
                variant: "ghost",
                size: "icon-sm",
                className: "text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive",
              })}
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this plan?</AlertDialogTitle>
                <AlertDialogDescription>
                  This only removes the plan, not any logged entry it points to. This can&apos;t be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting && <Loader2 className="size-4 animate-spin" />}
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
