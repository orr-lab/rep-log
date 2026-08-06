"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { GRADE_OPTIONS, formatGrade } from "@/lib/climbing";
import type { ExerciseCategory, ExercisePreset } from "@/lib/types";

/** Summarizes a preset's stored details (if any) the same way PlanCard summarizes a plan --
 *  so it's clear at a glance which presets have everything set ahead of time vs. just a name. */
function presetSummary(preset: ExercisePreset, climbingMode: boolean): string | null {
  const parts: string[] = [];
  if (climbingMode && preset.grade != null) parts.push(formatGrade(preset.grade));
  if (!climbingMode && preset.weight != null) parts.push(`${preset.weight} lb/kg`);
  if (preset.sets != null && preset.reps != null) parts.push(`${preset.sets}x${preset.reps}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function AddPresetDialog({
  categoryId,
  climbingMode,
  onAdded,
}: {
  categoryId: string;
  climbingMode: boolean;
  onAdded: (categoryId: string, preset: ExercisePreset) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [grade, setGrade] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setWeight("");
    setGrade("");
    setSets("");
    setReps("");
    setNotes("");
    setLink("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/exercise-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          categoryId,
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
        throw new Error(typeof data?.error === "string" ? data.error : "Couldn't add that exercise.");
      }
      const created = await res.json();
      onAdded(categoryId, created);
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
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
        aria-label="Add exercise preset"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "w-full" })}
      >
        <Plus className="size-3.5" /> Add exercise
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add {climbingMode ? "route" : "exercise"} preset</DialogTitle>
          <DialogDescription>
            Set everything ahead of time -- picking this preset later fills it all in at once, and
            it can still be tweaked for that one plan or entry.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preset-name">{climbingMode ? "Route / problem" : "Exercise"}</Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={climbingMode ? "e.g. Blue arête" : "Barbell Squat"}
              required
            />
          </div>

          {climbingMode ? (
            <div className="space-y-2">
              <Label htmlFor="preset-grade">Grade (optional)</Label>
              <Select value={grade} onValueChange={(v) => v && setGrade(v)}>
                <SelectTrigger id="preset-grade" className="w-full">
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
              <Label htmlFor="preset-weight">Weight (optional)</Label>
              <Input
                id="preset-weight"
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
              <Label htmlFor="preset-sets">{climbingMode ? "Attempts" : "Sets"}</Label>
              <Input
                id="preset-sets"
                type="number"
                min={1}
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                placeholder="e.g. 3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preset-reps">{climbingMode ? "Sets" : "Reps"}</Label>
              <Input
                id="preset-reps"
                type="number"
                min={1}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="e.g. 5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preset-notes">Notes</Label>
            <Textarea
              id="preset-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything they should know before doing this"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preset-link">Link</Label>
            <Input
              id="preset-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://… (beta video, reference, etc.)"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Add exercise
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExercisePresetsPanel({
  initialCategories,
  climbingMode,
}: {
  initialCategories: ExerciseCategory[];
  climbingMode: boolean;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(initialCategories.map((c) => c.id)));
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const res = await fetch("/api/exercise-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "Couldn't add that category.");
      }
      const created = await res.json();
      setCategories((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setExpanded((prev) => new Set(prev).add(created.id));
      setNewCategoryName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    try {
      const res = await fetch(`/api/exercise-categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Category removed");
    } catch {
      toast.error("Couldn't remove that category.");
    }
  }

  async function handleDeletePreset(categoryId: string, presetId: string) {
    try {
      const res = await fetch(`/api/exercise-presets/${presetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId ? { ...c, presets: c.presets.filter((p) => p.id !== presetId) } : c
        )
      );
    } catch {
      toast.error("Couldn't remove that exercise.");
    }
  }

  function handlePresetAdded(categoryId: string, preset: ExercisePreset) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? { ...c, presets: [...c.presets, preset].sort((a, b) => a.name.localeCompare(b.name)) }
          : c
      )
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Group your commonly-used exercises into categories, so you (and anyone with your visitor
        password, like a trainer) can pick one from a dropdown when planning or logging instead of
        typing it out every time.
      </p>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet — add one below.</p>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => {
            const isOpen = expanded.has(category.id);
            return (
              <div key={category.id} className="rounded-lg border">
                <div className="flex items-center justify-between gap-2 p-2">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(category.id)}
                    className="flex flex-1 items-center gap-1.5 text-left text-sm font-medium"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    {category.name}
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {category.presets.length}
                    </Badge>
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      aria-label={`Delete ${category.name} category`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "icon-sm",
                        className: "text-destructive hover:text-destructive",
                      })}
                    >
                      <Trash2 className="size-3.5" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete &quot;{category.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This also deletes every exercise preset in this category. It won&apos;t
                          affect anything already logged or planned using these names. This can&apos;t
                          be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {isOpen && (
                  <div className="space-y-1.5 border-t p-2">
                    {category.presets.map((preset) => {
                      const summary = presetSummary(preset, climbingMode);
                      return (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50"
                        >
                          <div className="min-w-0">
                            <p className="truncate">{preset.name}</p>
                            {summary && (
                              <p className="truncate text-xs text-muted-foreground">{summary}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${preset.name}`}
                            onClick={() => handleDeletePreset(category.id, preset.id)}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      );
                    })}
                    <AddPresetDialog
                      categoryId={category.id}
                      climbingMode={climbingMode}
                      onAdded={handlePresetAdded}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleCreateCategory} className="flex items-center gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="new-category-name" className="sr-only">
            New category name
          </Label>
          <Input
            id="new-category-name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category, e.g. Warmup"
          />
        </div>
        <Button type="submit" size="sm" disabled={creatingCategory || !newCategoryName.trim()}>
          {creatingCategory && <Loader2 className="size-4 animate-spin" />}
          <Plus className="size-3.5" /> Add category
        </Button>
      </form>
    </div>
  );
}
