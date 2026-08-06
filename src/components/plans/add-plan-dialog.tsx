"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
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
import type { ExerciseCategory, WorkoutPlan } from "@/lib/types";

interface PlanItemDraft {
  exerciseName: string;
  weight: string;
  grade: string;
  sets: string;
  reps: string;
  notes: string;
  link: string;
}

function emptyItem(): PlanItemDraft {
  return { exerciseName: "", weight: "", grade: "", sets: "", reps: "", notes: "", link: "" };
}

function PresetPicker({
  categories,
  onPick,
  climbingMode,
}: {
  categories: ExerciseCategory[];
  onPick: (name: string) => void;
  climbingMode: boolean;
}) {
  if (categories.every((c) => c.presets.length === 0)) return null;

  return (
    <Select value="" onValueChange={(v) => v && onPick(v)}>
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
                <SelectItem key={preset.id} value={preset.name}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
      </SelectContent>
    </Select>
  );
}

export function AddPlanDialog({
  plannedDate,
  climbingMode,
  categories,
  onCreated,
}: {
  /** YYYY-MM-DD for the day this plan is for. */
  plannedDate: string;
  climbingMode: boolean;
  /** The account's exercise-preset categories, see Settings > Exercise presets. */
  categories: ExerciseCategory[];
  onCreated: (plan: WorkoutPlan) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlanItemDraft[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);

  function updateItem(index: number, patch: Partial<PlanItemDraft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function reset() {
    setItems([emptyItem()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const missingName = items.some((item) => !item.exerciseName.trim());
    if (missingName) {
      toast.error(
        climbingMode
          ? "Give every route or problem a name first."
          : "Give every exercise a name first."
      );
      return;
    }
    if (climbingMode && items.some((item) => item.grade === "")) {
      toast.error("Pick a grade for every climb.");
      return;
    }

    setSubmitting(true);
    const results = await Promise.allSettled(
      items.map((item) =>
        fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plannedDate: new Date(plannedDate).toISOString(),
            exerciseName: item.exerciseName.trim(),
            weight: !climbingMode && item.weight ? Number(item.weight) : null,
            grade: climbingMode && item.grade !== "" ? Number(item.grade) : null,
            sets: item.sets ? Number(item.sets) : null,
            reps: item.reps ? Number(item.reps) : null,
            notes: item.notes.trim() || null,
            link: item.link.trim() || null,
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(typeof data?.error === "string" ? data.error : "Couldn't add that plan.");
          }
          return res.json();
        })
      )
    );

    const succeededIndices = new Set<number>();
    let firstError: string | null = null;
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        succeededIndices.add(i);
        onCreated(result.value);
      } else if (!firstError) {
        firstError = result.reason instanceof Error ? result.reason.message : "Something went wrong.";
      }
    });

    setSubmitting(false);

    if (succeededIndices.size === items.length) {
      toast.success(items.length === 1 ? "Plan added" : `${items.length} plans added`);
      reset();
      setOpen(false);
      return;
    }

    // Leave whatever didn't save in the form so it's not lost, and drop the ones that did.
    setItems((prev) => prev.filter((_, i) => !succeededIndices.has(i)));
    if (succeededIndices.size > 0) {
      toast.success(`${succeededIndices.size} of ${items.length} plans added`);
    }
    toast.error(firstError ?? "Couldn't add the rest.");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        aria-label="Add a plan"
        className={buttonVariants({ variant: "secondary", size: "sm", className: "w-full" })}
      >
        <Plus className="size-4" /> Add plan
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan {climbingMode ? "climbs" : "sets"}</DialogTitle>
          <DialogDescription>
            {new Date(plannedDate).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {items.map((item, index) => (
            <div
              key={index}
              className={items.length > 1 ? "space-y-4 rounded-lg border p-3" : "space-y-4"}
            >
              {items.length > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Exercise {index + 1}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove exercise ${index + 1}`}
                    onClick={() => removeItem(index)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <PresetPicker
                  categories={categories}
                  climbingMode={climbingMode}
                  onPick={(name) => updateItem(index, { exerciseName: name })}
                />
                <Label htmlFor={`plan-exercise-${index}`}>
                  {climbingMode ? "Route / problem" : "Exercise"}
                </Label>
                <Input
                  id={`plan-exercise-${index}`}
                  value={item.exerciseName}
                  onChange={(e) => updateItem(index, { exerciseName: e.target.value })}
                  placeholder={climbingMode ? "e.g. Blue arête" : "Barbell Squat"}
                  required
                />
              </div>

              {climbingMode ? (
                <div className="space-y-2">
                  <Label htmlFor={`plan-grade-${index}`}>Grade</Label>
                  <Select
                    value={item.grade}
                    onValueChange={(v) => v && updateItem(index, { grade: v })}
                  >
                    <SelectTrigger id={`plan-grade-${index}`} className="w-full">
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
                  <Label htmlFor={`plan-weight-${index}`}>Weight (optional)</Label>
                  <Input
                    id={`plan-weight-${index}`}
                    type="number"
                    min={0}
                    step="0.5"
                    value={item.weight}
                    onChange={(e) => updateItem(index, { weight: e.target.value })}
                    placeholder="e.g. 135"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`plan-sets-${index}`}>{climbingMode ? "Attempts" : "Sets"}</Label>
                  <Input
                    id={`plan-sets-${index}`}
                    type="number"
                    min={1}
                    value={item.sets}
                    onChange={(e) => updateItem(index, { sets: e.target.value })}
                    placeholder="e.g. 3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`plan-reps-${index}`}>{climbingMode ? "Sets" : "Reps"}</Label>
                  <Input
                    id={`plan-reps-${index}`}
                    type="number"
                    min={1}
                    value={item.reps}
                    onChange={(e) => updateItem(index, { reps: e.target.value })}
                    placeholder="e.g. 5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`plan-notes-${index}`}>Notes</Label>
                <Textarea
                  id={`plan-notes-${index}`}
                  rows={2}
                  value={item.notes}
                  onChange={(e) => updateItem(index, { notes: e.target.value })}
                  placeholder="Anything they should know before doing this"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`plan-link-${index}`}>Link</Label>
                <Input
                  id={`plan-link-${index}`}
                  value={item.link}
                  onChange={(e) => updateItem(index, { link: e.target.value })}
                  placeholder="https://… (beta video, reference, etc.)"
                />
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addItem}>
            <Plus className="size-3.5" /> Add another exercise
          </Button>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {items.length === 1 ? "Add plan" : `Add ${items.length} plans`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
