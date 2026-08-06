"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GRADE_OPTIONS, formatGrade } from "@/lib/climbing";
import { planDayKey } from "@/lib/plans";
import { findExercisePreset } from "@/lib/types";
import type { ExerciseCategory, WorkoutPlan } from "@/lib/types";

export function EditPlanDialog({
  plan,
  climbingMode,
  categories,
  onUpdated,
}: {
  plan: WorkoutPlan;
  climbingMode: boolean;
  /** The account's exercise-preset categories, see Settings > Exercise presets. */
  categories: ExerciseCategory[];
  onUpdated: (plan: WorkoutPlan) => void;
}) {
  const [open, setOpen] = useState(false);
  const [plannedDate, setPlannedDate] = useState(planDayKey(new Date(plan.plannedDate)));
  const [exerciseName, setExerciseName] = useState(plan.exerciseName);
  const [weight, setWeight] = useState(plan.weight != null ? String(plan.weight) : "");
  const [grade, setGrade] = useState(plan.grade != null ? String(plan.grade) : "");
  const [sets, setSets] = useState(plan.sets != null ? String(plan.sets) : "");
  const [reps, setReps] = useState(plan.reps != null ? String(plan.reps) : "");
  const [notes, setNotes] = useState(plan.notes ?? "");
  const [link, setLink] = useState(plan.link ?? "");
  const [submitting, setSubmitting] = useState(false);

  const hasPresets = categories.some((c) => c.presets.length > 0);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Re-sync from the current plan every time the dialog opens, in case it changed since the
      // last time (e.g. another edit, or a fresh mount reusing the same plan id).
      setPlannedDate(planDayKey(new Date(plan.plannedDate)));
      setExerciseName(plan.exerciseName);
      setWeight(plan.weight != null ? String(plan.weight) : "");
      setGrade(plan.grade != null ? String(plan.grade) : "");
      setSets(plan.sets != null ? String(plan.sets) : "");
      setReps(plan.reps != null ? String(plan.reps) : "");
      setNotes(plan.notes ?? "");
      setLink(plan.link ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!exerciseName.trim()) {
      toast.error(
        climbingMode ? "Give the route or problem a name first." : "Give the exercise a name first."
      );
      return;
    }
    if (climbingMode && grade === "") {
      toast.error("Pick a grade for this climb.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedDate: new Date(plannedDate).toISOString(),
          exerciseName: exerciseName.trim(),
          weight: !climbingMode && weight ? Number(weight) : null,
          grade: climbingMode && grade !== "" ? Number(grade) : null,
          sets: sets ? Number(sets) : null,
          reps: reps ? Number(reps) : null,
          notes: notes.trim() || null,
          link: link.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "Couldn't save that plan.");
      }
      const updated = await res.json();
      onUpdated(updated);
      toast.success("Plan updated");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        aria-label="Edit plan"
        className={buttonVariants({
          variant: "ghost",
          size: "icon-sm",
          className: "hover:border-border hover:bg-muted",
        })}
      >
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {climbingMode ? "climb" : "exercise"}</DialogTitle>
          <DialogDescription>Update the details of this planned {climbingMode ? "climb" : "set"}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-plan-date">Date</Label>
            <Input
              id="edit-plan-date"
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            {hasPresets && (
              <Select
                value=""
                onValueChange={(id) => {
                  const preset = id && findExercisePreset(categories, id);
                  if (!preset) return;
                  setExerciseName(preset.name);
                  setWeight(preset.weight != null ? String(preset.weight) : "");
                  setGrade(preset.grade != null ? String(preset.grade) : "");
                  setSets(preset.sets != null ? String(preset.sets) : "");
                  setReps(preset.reps != null ? String(preset.reps) : "");
                  setNotes(preset.notes ?? "");
                  setLink(preset.link ?? "");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={climbingMode ? "Choose a preset route…" : "Choose a preset exercise…"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c.presets.length > 0)
                    .map((category) => (
                      <SelectGroup key={category.id}>
                        <SelectLabel>{category.name}</SelectLabel>
                        {category.presets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                </SelectContent>
              </Select>
            )}
            <Label htmlFor="edit-plan-exercise">{climbingMode ? "Route / problem" : "Exercise"}</Label>
            <Input
              id="edit-plan-exercise"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              placeholder={climbingMode ? "e.g. Blue arête" : "Barbell Squat"}
              required
            />
          </div>

          {climbingMode ? (
            <div className="space-y-2">
              <Label htmlFor="edit-plan-grade">Grade</Label>
              <Select value={grade} onValueChange={(v) => v && setGrade(v)}>
                <SelectTrigger id="edit-plan-grade" className="w-full">
                  <SelectValue placeholder="Select a grade" />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      {formatGrade(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="edit-plan-weight">Weight (optional)</Label>
              <Input
                id="edit-plan-weight"
                type="number"
                min={0}
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 135"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-plan-sets">{climbingMode ? "Attempts" : "Sets"}</Label>
              <Input
                id="edit-plan-sets"
                type="number"
                min={1}
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                placeholder="e.g. 3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-plan-reps">{climbingMode ? "Sets" : "Reps"}</Label>
              <Input
                id="edit-plan-reps"
                type="number"
                min={1}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="e.g. 5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-plan-notes">Notes</Label>
            <Textarea
              id="edit-plan-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything they should know before doing this"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-plan-link">Link</Label>
            <Input
              id="edit-plan-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://… (beta video, reference, etc.)"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
