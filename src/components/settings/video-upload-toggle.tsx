"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function VideoUploadToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [submitting, setSubmitting] = useState(false);

  async function handleChange(next: boolean) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/me/video-uploads", {
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
      toast.success(next ? "Direct video uploads enabled" : "Direct video uploads disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div>
        <Label htmlFor="video-uploads">Allow direct video uploads</Label>
        <p className="text-sm text-muted-foreground">
          Applies to every account. When off, everyone can still log sets with a YouTube link —
          only direct file uploads (which use Blob storage) are turned off.
        </p>
      </div>
      <Switch
        id="video-uploads"
        checked={enabled}
        onCheckedChange={handleChange}
        disabled={submitting}
      />
    </div>
  );
}
