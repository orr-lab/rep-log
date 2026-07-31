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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !username || !password}>
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
