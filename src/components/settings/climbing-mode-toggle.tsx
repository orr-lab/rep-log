"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ClimbingModeToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [submitting, setSubmitting] = useState(false);

  async function handleChange(next: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/me/climbing-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" ? data.error : "Couldn't update this setting."
        );
      }
      setEnabled(next);
      toast.success(next ? "Climbing mode enabled" : "Climbing mode disabled");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div>
        <Label htmlFor="climbing-mode">Climbing mode</Label>
        <p className="text-sm text-muted-foreground">
          Personal to your account. Switches new entries to grades (V0–V17) and a gym field
          instead of weight, and groups your library, records, and stats by gym and grade.
          Entries you&apos;ve already logged aren&apos;t changed.
        </p>
      </div>
      <Switch
        id="climbing-mode"
        checked={enabled}
        onCheckedChange={handleChange}
        disabled={submitting}
      />
    </div>
  );
}
