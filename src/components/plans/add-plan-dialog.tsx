"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
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
import type { WorkoutPlan } from "@/lib/types";

export function AddPlanDialog({
  plannedDate,
  climbingMode,
  onCreated,
}: {
  /** YYYY-MM-DD for the day this plan is for. */
  plannedDate: string;
  climbingMode: boolean;
  onCreated: (plan: WorkoutPlan) => void;
}) {
  const [open, setOpen] = useState(false);
  const [exerciseName, setExerciseName] = useState("");
  const [weight, setWeight] = useState("");
  const [grade, setGrade] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setExerciseName("");
    setWeight("");
    setGrade("");
    setSets("");
    setReps("");
    setNotes("");
    setLink("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exerciseName.trim()) {
      toast.error(climbingMode ? "Give the route or problem a name first." : "Give the exercise a name first.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
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
        throw new Error(
          typeof data?.error === "string" ? data.error : "Couldn't add that plan."
        );
      }
      const created = await res.json();
      onCreated(created);
      toast.success("Plan added");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Add a plan"
        className={buttonVariants({ variant: "secondary", size: "sm", className: "w-full" })}
      >
        <Plus className="size-4" /> Add plan
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan {climbingMode ? "a climb" : "a set"}</DialogTitle>
          <DialogDescription>
            {new Date(plannedDate).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-exercise">{climbingMode ? "Route / problem" : "Exercise"}</Label>
            <Input
              id="plan-exercise"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              placeholder={climbingMode ? "e.g. Blue arête" : "Barbell Squat"}
              required
            />
          </div>

          {climbingMode ? (
            <div className="space-y-2">
              <Label htmlFor="plan-grade">Grade</Label>
              <Select value={grade} onValueChange={(v) => v && setGrade(v)}>
                <SelectTrigger id="plan-grade" className="w-full">
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
              <Label htmlFor="plan-weight">Weight (optional)</Label>
              <Input
                id="plan-weight"
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
              <Label htmlFor="plan-sets">{climbingMode ? "Attempts" : "Sets"}</Label>
              <Input
                id="plan-sets"
                type="number"
                min={1}
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                placeholder="e.g. 3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-reps">Reps</Label>
              <Input
                id="plan-reps"
                type="number"
                min={1}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="e.g. 5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-notes">Notes</Label>
            <Textarea
              id="plan-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything they should know before doing this"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-link">Link</Label>
            <Input
              id="plan-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://… (beta video, reference, etc.)"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Add plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
