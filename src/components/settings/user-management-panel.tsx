"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, KeyRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PASSWORD_HINT = "At least 8 characters, with uppercase, lowercase, a number, and a symbol.";

interface UserRow {
  id: string;
  username: string;
  createdAt: string;
  hasVisitorPassword: boolean;
}

function ResetPasswordDialog({ userId, username }: { userId: string; username: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" ? data.error : "Couldn't reset that password."
        );
      }
      toast.success(`${username}'s password was reset`);
      setPassword("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={`Reset ${username}'s password`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <KeyRound className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset {username}&apos;s password</DialogTitle>
          <DialogDescription>
            They&apos;ll need this new password to log in — their old one stops working
            immediately. You won&apos;t be able to see it again after this.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`reset-${userId}`}>New password</Label>
            <PasswordInput
              id={`reset-${userId}`}
              name="newPassword"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UserManagementPanel({ initialUsers }: { initialUsers: UserRow[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" ? data.error : "Couldn't create that user."
        );
      }
      const created = await res.json();
      setUsers((prev) => [
        ...prev,
        {
          id: created.id,
          username: created.username,
          createdAt: created.createdAt,
          hasVisitorPassword: false,
        },
      ]);
      toast.success(`${created.username} created`);
      setUsername("");
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("User deleted");
      router.refresh();
    } catch {
      toast.error("Couldn't delete this user.");
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="space-y-3 rounded-lg border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="newUserUsername">Username</Label>
            <Input
              id="newUserUsername"
              name="username"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newUserPassword">Password</Label>
            <PasswordInput
              id="newUserPassword"
              name="newUserPassword"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
        <Button type="submit" disabled={creating}>
          {creating && <Loader2 className="size-4 animate-spin" />}
          Create user
        </Button>
      </form>

      {users.length > 0 && (
        <div className="space-y-2">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{user.username}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(user.createdAt).toLocaleDateString()}
                    {user.hasVisitorPassword ? " · has a visitor password" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <ResetPasswordDialog userId={user.id} username={user.username} />
                  <AlertDialog>
                    <AlertDialogTrigger
                      aria-label={`Delete ${user.username}`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className: "text-destructive hover:text-destructive",
                      })}
                    >
                      <Trash2 className="size-4" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {user.username}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes their account, entries, and uploaded videos.
                          This can&apos;t be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(user.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
