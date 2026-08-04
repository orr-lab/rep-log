"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ publicProfileAvailable }: { publicProfileAvailable: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Read straight from the DOM via FormData rather than React state -- correct regardless of
    // whether a password manager autofilled the field via a path that fires input events or not.
    const formData = new FormData(e.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    const from = searchParams.get("from");
    router.push(from && from !== "/login" ? from : "/");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm border-border/70 shadow-lg">
      <CardHeader className="items-center text-center">
        <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Dumbbell className="size-6" />
        </div>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Enter your username and password to open your training log.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoFocus
              placeholder="Username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Checking…" : "Enter"}
          </Button>
        </form>

        {publicProfileAvailable && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>
            <Link href="/visitor" className={buttonVariants({ variant: "outline", className: "w-full" })}>
              View public profile
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
