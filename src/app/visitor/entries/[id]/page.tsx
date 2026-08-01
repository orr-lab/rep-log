import Link from "next/link";
import { notFound } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { WorkoutEntry } from "@/lib/types";
import { VideoPlayer } from "@/components/video-player";
import { EntryActions } from "@/components/entry-actions";
import { AiFeedbackSection } from "@/components/ai-feedback-section";
import { Badge } from "@/components/ui/badge";
import { getPublicAdminUserId } from "@/lib/public-scope";
import { formatGrade } from "@/lib/climbing";

export const dynamic = "force-dynamic";

export default async function PublicEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adminId = await getPublicAdminUserId();
  if (!adminId) notFound();

  const { id } = await params;
  const row = await prisma.workoutEntry.findUnique({
    where: { id, userId: adminId },
  });
  if (!row) notFound();

  const entry: WorkoutEntry = {
    ...row,
    recordedAt: row.recordedAt.toISOString(),
    aiFeedbackAt: row.aiFeedbackAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  const isClimb = entry.gym != null && entry.grade != null;
  const groupHref = isClimb
    ? `/visitor/exercise?gym=${encodeURIComponent(entry.gym as string)}&grade=${entry.grade}`
    : `/visitor/exercise?name=${encodeURIComponent(entry.exerciseName)}`;

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
            {isClimb
              ? ` · ${entry.gym} · ${formatGrade(entry.grade as number)}`
              : entry.weight != null
                ? ` · ${entry.weight} lb/kg`
                : ""}
            {!isClimb && entry.sets != null && entry.reps != null
              ? ` · ${entry.sets}x${entry.reps}`
              : ""}
          </p>
        </div>
        <EntryActions id={entry.id} isFavorite={entry.isFavorite} role="visitor" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Exertion {entry.difficulty}/10</Badge>
        {!entry.succeeded && (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            {isClimb ? "Didn't send" : "Missed"}
          </Badge>
        )}
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
        role="visitor"
        aiRating={entry.aiRating}
        aiFeedback={entry.aiFeedback}
        aiFeedbackAt={entry.aiFeedbackAt}
      />

      <Link
        href={groupHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <Dumbbell className="size-4" />
        {isClimb ? "See every send at this grade" : "See every set of this exercise"}
      </Link>
    </div>
  );
}
