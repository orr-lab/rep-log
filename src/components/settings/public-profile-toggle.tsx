"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function PublicProfileToggle({
  initialEnabled,
  origin,
}: {
  initialEnabled: boolean;
  origin: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [submitting, setSubmitting] = useState(false);

  async function handleChange(next: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/me/public-profile", {
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
      toast.success(next ? "Public view enabled" : "Public view disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="public-profile">Make my log publicly viewable</Label>
          <p className="text-sm text-muted-foreground">
            Anyone with the link can browse it read-only — no login required. Off by default.
          </p>
        </div>
        <Switch
          id="public-profile"
          checked={enabled}
          onCheckedChange={handleChange}
          disabled={submitting}
        />
      </div>
      {enabled && (
        <p className="text-sm text-muted-foreground">
          Live at{" "}
          <a href="/visitor" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {origin}/visitor
          </a>
        </p>
      )}
    </div>
  );
}
