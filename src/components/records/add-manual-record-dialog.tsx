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
import { AutocompleteInput } from "@/components/autocomplete-input";
import { GRADE_OPTIONS, formatGrade } from "@/lib/climbing";
import type { ManualRecord } from "@/lib/types";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function AddManualRecordDialog({
  climbingMode,
  exerciseSuggestions,
  gymSuggestions,
  onCreated,
}: {
  climbingMode: boolean;
  exerciseSuggestions: string[];
  gymSuggestions: string[];
  onCreated: (record: ManualRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [exerciseName, setExerciseName] = useState("");
  const [weight, setWeight] = useState("");
  const [gym, setGym] = useState("");
  const [grade, setGrade] = useState("");
  const [recordedAt, setRecordedAt] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setExerciseName("");
    setWeight("");
    setGym("");
    setGrade("");
    setRecordedAt(todayInputValue());
    setNotes("");
    setLink("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exerciseName.trim()) {
      toast.error(climbingMode ? "Give the route or problem a name first." : "Give the exercise a name first.");
      return;
    }
    if (climbingMode && (!gym.trim() || grade === "")) {
      toast.error("Add a gym and a grade first.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/manual-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseName: exerciseName.trim(),
          weight: !climbingMode && weight ? Number(weight) : null,
          gym: climbingMode ? gym.trim() : null,
          grade: climbingMode && grade !== "" ? Number(grade) : null,
          recordedAt: new Date(recordedAt).toISOString(),
          notes: notes.trim() || null,
          link: link.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "Couldn't add that record.");
      }
      const created = await res.json();
      onCreated(created);
      toast.success("Record added");
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
        aria-label="Add a record"
        className={buttonVariants({ variant: "secondary", size: "sm" })}
      >
        <Plus className="size-4" /> Add record
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a {climbingMode ? "gym record" : "personal record"}</DialogTitle>
          <DialogDescription>
            Backfill a PR without logging a full entry — no video required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="record-exercise">{climbingMode ? "Route / problem" : "Exercise"}</Label>
            <AutocompleteInput
              id="record-exercise"
              value={exerciseName}
              onChange={setExerciseName}
              suggestions={exerciseSuggestions}
              placeholder={climbingMode ? "e.g. Blue arête (optional detail)" : "Barbell Squat"}
            />
          </div>

          {climbingMode ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="record-gym">Gym</Label>
                <AutocompleteInput
                  id="record-gym"
                  value={gym}
                  onChange={setGym}
                  suggestions={gymSuggestions}
                  placeholder="e.g. Movement, Brooklyn Boulders"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="record-grade">Grade</Label>
                <Select value={grade} onValueChange={(v) => v && setGrade(v)}>
                  <SelectTrigger id="record-grade" className="w-full">
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
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="record-weight">Weight</Label>
              <Input
                id="record-weight"
                type="number"
                min={0}
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 315"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="record-date">Date achieved</Label>
            <Input
              id="record-date"
              type="date"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="record-notes">Notes</Label>
            <Textarea
              id="record-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How you know, where it happened, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="record-link">Link (optional)</Label>
            <Input
              id="record-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://… (proof, if you have it)"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Add record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
