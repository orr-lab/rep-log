"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Role } from "@/lib/auth";
import type { WorkoutEntry } from "@/lib/types";

function RatingDots({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`size-2.5 rounded-full ${n <= rating ? "bg-primary" : "bg-muted"}`}
        />
      ))}
    </div>
  );
}

export function AiFeedbackSection({
  entryId,
  role,
  aiRating,
  aiFeedback,
  aiFeedbackAt,
}: {
  entryId: string;
  role: Role | null;
  aiRating: WorkoutEntry["aiRating"];
  aiFeedback: WorkoutEntry["aiFeedback"];
  aiFeedbackAt: WorkoutEntry["aiFeedbackAt"];
}) {
  const router = useRouter();
  const isOwner = role === "owner";
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(aiRating);
  const [feedback, setFeedback] = useState(aiFeedback);
  const [generatedAt, setGeneratedAt] = useState(aiFeedbackAt);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/entries/${entryId}/ai-feedback`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't generate feedback.");

      setRating(data.aiRating);
      setFeedback(data.aiFeedback);
      setGeneratedAt(data.aiFeedbackAt);
      toast.success("AI feedback ready");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate feedback.");
    } finally {
      setLoading(false);
    }
  }

  if (!feedback && !isOwner) return null;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" />
            AI form feedback
          </div>
          {rating != null && <RatingDots rating={rating} />}
        </div>

        {feedback ? (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{feedback}</p>
            {generatedAt && (
              <p className="text-xs text-muted-foreground">
                Generated {new Date(generatedAt).toLocaleDateString()}
              </p>
            )}
            {isOwner && (
              <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Regenerate
              </Button>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Get an AI-generated rating and pointers on form and safety — based on watching this
              set. This can take up to a minute.
            </p>
            <Button size="sm" onClick={handleGenerate} disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Get AI feedback
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
