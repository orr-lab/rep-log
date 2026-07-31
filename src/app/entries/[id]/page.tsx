import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { WorkoutEntry, EntryComment } from "@/lib/types";
import { VideoPlayer } from "@/components/video-player";
import { EntryActions } from "@/components/entry-actions";
import { AiFeedbackSection } from "@/components/ai-feedback-section";
import { CommentsSection } from "@/components/comments-section";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const role = session.role;
  const row = await prisma.workoutEntry.findUnique({
    where: { id, userId: session.userId },
    include: { comments: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) notFound();

  const entry: WorkoutEntry = {
    ...row,
    recordedAt: row.recordedAt.toISOString(),
    aiFeedbackAt: row.aiFeedbackAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  const comments: EntryComment[] = row.comments.map((c) => ({
    id: c.id,
    body: c.body,
    authorName: c.authorName,
    postedByRole: c.postedByRole,
    createdAt: c.createdAt.toISOString(),
  }));

  const exerciseHref = `/exercise?name=${encodeURIComponent(entry.exerciseName)}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <VideoPlayer entry={entry} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{entry.exerciseName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(entry.recordedAt).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {entry.weight != null ? ` · ${entry.weight} lb/kg` : ""}
            {entry.sets != null && entry.reps != null ? ` · ${entry.sets}x${entry.reps}` : ""}
          </p>
        </div>
        <EntryActions id={entry.id} isFavorite={entry.isFavorite} role={role} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Exertion {entry.difficulty}/5</Badge>
        {entry.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>

      {entry.notes && (
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Notes</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.notes}</p>
        </div>
      )}

      <AiFeedbackSection
        entryId={entry.id}
        role={role}
        aiRating={entry.aiRating}
        aiFeedback={entry.aiFeedback}
        aiFeedbackAt={entry.aiFeedbackAt}
      />

      <CommentsSection entryId={entry.id} role={role} comments={comments} />

      <Link
        href={exerciseHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <Dumbbell className="size-4" />
        See every set of this exercise
      </Link>
    </div>
  );
}
