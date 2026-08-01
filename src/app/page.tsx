import Link from "next/link";
import { redirect } from "next/navigation";
import { Dumbbell, ClipboardList, Clock, Flame, Plus } from "lucide-react";
import { getAllEntries } from "@/lib/data";
import { StatTile } from "@/components/stat-tile";
import { EntryCard } from "@/components/entry-card";
import { EmptyState } from "@/components/empty-state";
import { TrendBarChart } from "@/components/charts/trend-bar-chart";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { isClimbingModeEnabled } from "@/lib/users";
import {
  currentStreak,
  entriesInLastDays,
  entriesPerMonth,
  formatHoursMinutes,
  totalWorkoutSeconds,
  uniqueExerciseCount,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [entries, climbingMode] = await Promise.all([
    getAllEntries(session.userId),
    isClimbingModeEnabled(session.userId),
  ]);
  const isOwner = session.role === "owner";

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={Dumbbell}
          title={isOwner ? "Log your first set!" : "No entries yet"}
          description={
            isOwner
              ? "Upload a video or paste a YouTube link of yourself training, and start tracking your progress over time."
              : "This training log doesn't have any entries logged yet."
          }
          actionHref={isOwner ? "/new" : undefined}
          actionLabel={isOwner ? "Log your first entry" : undefined}
        />
      </div>
    );
  }

  const recent = entries.slice(0, 8);
  const monthly = entriesPerMonth(entries).map((b) => ({ label: b.label, value: b.count }));
  const streak = currentStreak(entries);
  const thisWeekTracked = entriesInLastDays(entries, 7).filter((e) =>
    climbingMode ? e.grade != null : e.weight != null
  );

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isOwner ? "Welcome back" : "Training log"}
          </h1>
          <p className="text-muted-foreground">
            {isOwner ? "Here's how your training has been going." : "Here's how training has been going."}
          </p>
        </div>
        {isOwner && (
          <Link href="/new" className={buttonVariants()}>
            <Plus className="size-4" /> {climbingMode ? "Log a climb" : "Log a set"}
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={ClipboardList} label="Total entries" value={entries.length} />
        <StatTile
          icon={Dumbbell}
          label={climbingMode ? "Routes / problems climbed" : "Exercises trained"}
          value={uniqueExerciseCount(entries)}
        />
        <StatTile
          icon={Clock}
          label="Total time logged"
          value={formatHoursMinutes(totalWorkoutSeconds(entries))}
        />
        <StatTile icon={Flame} label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} />
      </div>

      {thisWeekTracked.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            {climbingMode ? "This week's sends" : "This week's weighted lifts"}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {thisWeekTracked.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Entries per month</h2>
        <div className="rounded-xl border p-4">
          <TrendBarChart data={monthly} valueLabel="entries" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent entries</h2>
          <Link href="/library" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {recent.map((e) => (
            <EntryCard key={e.id} entry={e} />
          ))}
        </div>
      </section>
    </div>
  );
}
