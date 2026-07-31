"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function VisitorPasswordForm({ hasVisitorPassword }: { hasVisitorPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(hasVisitorPassword);
  const [submitting, setSubmitting] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleSet(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/me/visitor-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" ? data.error : "Couldn't set the visitor password."
        );
      }
      toast.success(hasPassword ? "Visitor password updated" : "Visitor password set");
      setHasPassword(true);
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      const res = await fetch("/api/users/me/visitor-password", { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Visitor password removed");
      setHasPassword(false);
    } catch {
      toast.error("Couldn't remove the visitor password.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <form onSubmit={handleSet} className="space-y-3 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="visitorPassword">
          {hasPassword ? "New visitor password" : "Visitor password"}
        </Label>
        <PasswordInput
          id="visitorPassword"
          name="visitorPassword"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          At least 8 characters, with uppercase, lowercase, a number, and a symbol.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {hasPassword ? "Update" : "Set visitor password"}
        </Button>
        {hasPassword && (
          <Button type="button" variant="ghost" onClick={handleClear} disabled={clearing}>
            {clearing && <Loader2 className="size-4 animate-spin" />}
            Remove visitor access
          </Button>
        )}
      </div>
    </form>
  );
}
