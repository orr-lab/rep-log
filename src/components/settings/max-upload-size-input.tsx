"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MaxUploadSizeInput({ initialMaxUploadMB }: { initialMaxUploadMB: number }) {
  const [value, setValue] = useState(String(initialMaxUploadMB));
  const [saved, setSaved] = useState(initialMaxUploadMB);
  const [submitting, setSubmitting] = useState(false);

  const parsed = Number(value);
  const dirty = value.trim() !== "" && parsed !== saved;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/me/max-upload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUploadMB: parsed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" ? data.error : "Couldn't update this setting."
        );
      }
      setSaved(parsed);
      toast.success(`Raw upload cap set to ${parsed}MB`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-2 rounded-lg border p-4">
      <Label htmlFor="max-upload-mb">Raw upload cap</Label>
      <p className="text-sm text-muted-foreground">
        Applies to every account. This is a ceiling on the file a phone camera might produce —
        every upload is compressed client-side before it reaches Blob storage, so raising this
        doesn&apos;t proportionally raise your storage bill.
      </p>
      <div className="flex items-center gap-2">
        <Input
          id="max-upload-mb"
          type="number"
          min={10}
          max={10240}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-32"
        />
        <span className="text-sm text-muted-foreground">MB</span>
        <Button type="submit" size="sm" disabled={!dirty || submitting || Number.isNaN(parsed)}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}
