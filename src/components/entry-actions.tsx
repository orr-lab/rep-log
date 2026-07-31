"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
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
import type { Role } from "@/lib/auth";

export function EntryActions({
  id,
  isFavorite,
  role,
}: {
  id: string;
  isFavorite: boolean;
  role: Role | null;
}) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(isFavorite);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (role !== "owner") {
    return isFavorite ? (
      <Badge variant="secondary" className="gap-1">
        <Star className="size-3.5 fill-primary text-primary" /> Milestone
      </Badge>
    ) : null;
  }

  async function toggleFavorite() {
    setTogglingFavorite(true);
    const next = !favorite;
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: next }),
      });
      if (!res.ok) throw new Error();
      setFavorite(next);
      router.refresh();
    } catch {
      toast.error("Couldn't update this entry.");
    } finally {
      setTogglingFavorite(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Entry deleted");
      router.push("/library");
      router.refresh();
    } catch {
      toast.error("Couldn't delete this entry.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={favorite ? "default" : "secondary"}
        size="sm"
        onClick={toggleFavorite}
        disabled={togglingFavorite}
      >
        <Star className={favorite ? "size-4 fill-current" : "size-4"} />
        {favorite ? "Milestone" : "Mark milestone"}
      </Button>
      <Link href={`/entries/${id}/edit`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
        <Pencil className="size-4" /> Edit
      </Link>
      <AlertDialog>
        <AlertDialogTrigger
          className={buttonVariants({ variant: "ghost", size: "sm", className: "text-destructive hover:text-destructive" })}
        >
          <Trash2 className="size-4" /> Delete
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the entry and its video permanently. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
