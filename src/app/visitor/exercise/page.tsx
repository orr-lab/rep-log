import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { WorkoutEntry } from "@/lib/types";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { Badge } from "@/components/ui/badge";
import { getPublicAdminUserId } from "@/lib/public-scope";
import { personalRecords } from "@/lib/stats";
import { formatGrade } from "@/lib/climbing";

export const dynamic = "force-dynamic";

export default async function PublicExercisePage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; gym?: string; grade?: string }>;
}) {
  const adminId = await getPublicAdminUserId();
  if (!adminId) notFound();

  const { name, gym, grade: gradeParam } = await searchParams;
  const grade = gradeParam != null ? Number(gradeParam) : null;
  const isClimbView = Boolean(gym && grade != null && !Number.isNaN(grade));

  if (!isClimbView && !name) notFound();

  const rows = await prisma.workoutEntry.findMany({
    where: isClimbView
      ? { userId: adminId, gym: { equals: gym, mode: "insensitive" }, grade }
      : { userId: adminId, exerciseName: { equals: name, mode: "insensitive" } },
    orderBy: { recordedAt: "asc" },
  });

  if (rows.length === 0) notFound();

  const entries: WorkoutEntry[] = rows.map((r) => ({
    ...r,
    recordedAt: r.recordedAt.toISOString(),
    aiFeedbackAt: r.aiFeedbackAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const oldest = entries[0];
  const newest = entries[entries.length - 1];
  const allTags = Array.from(new Set(entries.flatMap((e) => e.tags)));

  const manualRows = isClimbView
    ? []
    : await prisma.manualRecord.findMany({
        where: { userId: adminId, exerciseName: { equals: name, mode: "insensitive" } },
      });
  const manualRecords = manualRows.map((r) => ({
    ...r,
    recordedAt: r.recordedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
  const pr = isClimbView ? null : personalRecords(entries, manualRecords)[0];
  const title = isClimbView ? `${gym} — ${formatGrade(grade as number)}` : (name as string);
  const unit = isClimbView ? "send" : "set";

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {entries.length} {unit}
            {entries.length === 1 ? "" : "s"}
          </Badge>
          {pr && (
            <Badge className="gap-1">
              <Trophy className="size-3.5" />
              PR: {pr.weight} lb/kg
            </Badge>
          )}
          {allTags.map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
        {pr && (
          <p className="mt-2 text-sm text-muted-foreground">
            Personal record set{" "}
            {new Date(pr.recordedAt).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {pr.source === "entry" ? (
              <>
                {" — "}
                <Link
                  href={`/visitor/entries/${pr.entryId}`}
                  className="text-primary hover:underline"
                >
                  view that entry
                </Link>
              </>
            ) : pr.link ? (
              <>
                {" — "}
                <a
                  href={pr.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  view reference link
                </a>
              </>
            ) : (
              " (added directly, no entry)"
            )}
          </p>
        )}
      </div>

      {entries.length > 1 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            First {unit} vs. latest {unit}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[oldest, newest].map((e, i) => (
              <Link
                key={e.id}
                href={`/visitor/entries/${e.id}`}
                className="block rounded-xl border p-3 transition-shadow hover:shadow-md"
              >
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {i === 0 ? `First ${unit}` : `Latest ${unit}`} ·{" "}
                  {new Date(e.recordedAt).toLocaleDateString()}
                </p>
                <VideoThumbnail entry={e} />
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isClimbView
                      ? `Exertion ${e.difficulty}/10`
                      : `${e.weight != null ? `${e.weight} lb/kg` : "Bodyweight"} · Exertion ${e.difficulty}/10`}
                  </span>
                  {e.isFavorite && <span className="text-primary">★ favorite</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <ol className="space-y-4 border-l border-border pl-6">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-background bg-primary" />
              <Link
                href={`/visitor/entries/${e.id}`}
                className="group -m-2 flex flex-col gap-3 rounded-lg p-2 hover:bg-muted sm:flex-row sm:items-center"
              >
                <div className="w-full shrink-0 sm:w-40">
                  <VideoThumbnail entry={e} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {new Date(e.recordedAt).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isClimbView ? (
                      <>
                        Exertion {e.difficulty}/10
                        {e.sets != null ? ` · ${e.sets} attempt${e.sets === 1 ? "" : "s"}` : ""}
                      </>
                    ) : (
                      <>
                        {e.weight != null ? `${e.weight} lb/kg · ` : ""}
                        Exertion {e.difficulty}/10
                        {e.sets != null && e.reps != null ? ` · ${e.sets}x${e.reps}` : ""}
                      </>
                    )}
                  </p>
                  {e.notes && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.notes}</p>}
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
