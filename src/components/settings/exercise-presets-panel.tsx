"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import type { ExerciseCategory } from "@/lib/types";

function AddPresetRow({
  categoryId,
  onAdded,
}: {
  categoryId: string;
  onAdded: (categoryId: string, preset: { id: string; name: string; categoryId: string; createdAt: string }) => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/exercise-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), categoryId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "Couldn't add that exercise.");
      }
      const created = await res.json();
      onAdded(categoryId, created);
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Overhang project"
        className="h-7 flex-1 text-xs"
      />
      <Button type="submit" size="icon-sm" variant="ghost" disabled={submitting || !name.trim()}>
        {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
      </Button>
    </form>
  );
}

export function ExercisePresetsPanel({
  initialCategories,
}: {
  initialCategories: ExerciseCategory[];
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

  function handlePresetAdded(
    categoryId: string,
    preset: { id: string; name: string; categoryId: string; createdAt: string }
  ) {
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
                    {category.presets.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50"
                      >
                        <span>{preset.name}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${preset.name}`}
                          onClick={() => handleDeletePreset(category.id, preset.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                    <AddPresetRow categoryId={category.id} onAdded={handlePresetAdded} />
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
