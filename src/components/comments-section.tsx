"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Role } from "@/lib/auth";
import type { EntryComment } from "@/lib/types";

const COMMENT_AUTHOR_NAME_KEY = "repLogCommentAuthorName";

export function CommentsSection({
  entryId,
  role,
  comments,
}: {
  entryId: string;
  role: Role | null;
  comments: EntryComment[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canComment = role === "owner" || role === "visitor";

  // Client-only (avoids an SSR/hydration mismatch, since the server has no localStorage) --
  // pre-fills the name field with whatever was last used, so it doesn't have to be retyped on
  // every comment. Deferred to a microtask so setState isn't called synchronously in the effect
  // body itself (still resolves before paint, so there's no visible delay).
  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem(COMMENT_AUTHOR_NAME_KEY);
      if (saved) setAuthorName(saved);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const trimmedName = authorName.trim();
      const res = await fetch(`/api/entries/${entryId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, authorName: trimmedName || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" ? data.error : "Couldn't post that comment."
        );
      }
      // Only remembered when actually provided -- an accidental blank name on one comment
      // shouldn't erase a name already remembered from an earlier one.
      if (trimmedName) localStorage.setItem(COMMENT_AUTHOR_NAME_KEY, trimmedName);
      setBody("");
      toast.success("Comment posted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    setDeletingId(commentId);
    try {
      const res = await fetch(`/api/entries/${entryId}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Comment deleted");
      router.refresh();
    } catch {
      toast.error("Couldn't delete this comment.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="size-4 text-primary" />
          Comments
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      {c.postedByRole === "owner" ? "Owner" : "Visitor"}
                    </Badge>
                    {c.authorName && <span className="font-medium">{c.authorName}</span>}
                    <span>
                      {new Date(c.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {role === "owner" && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Delete comment"
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                    </Button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
              </li>
            ))}
          </ul>
        )}

        {canComment && (
          <form onSubmit={handleSubmit} className="space-y-2 border-t pt-4">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Leave a comment…"
              rows={3}
              required
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name (optional)"
                className="max-w-[200px]"
              />
              <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Post comment
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
