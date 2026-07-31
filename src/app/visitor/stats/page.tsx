import { BarChart3 } from "lucide-react";
import { notFound } from "next/navigation";
import { getAllEntries } from "@/lib/data";
import { EmptyState } from "@/components/empty-state";
import { TrendBarChart } from "@/components/charts/trend-bar-chart";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { RankedBarChart } from "@/components/charts/ranked-bar-chart";
import { StreakHeatmap } from "@/components/charts/streak-heatmap";
import {
  difficultyTrendByMonth,
  entriesPerMonth,
  topByFrequency,
  workoutMinutesPerMonth,
} from "@/lib/stats";
import { getPublicAdminUserId } from "@/lib/public-scope";

export const dynamic = "force-dynamic";

export default async function PublicStatsPage() {
  const adminId = await getPublicAdminUserId();
  if (!adminId) notFound();

  const entries = await getAllEntries(adminId);

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={BarChart3}
          title="No stats yet"
          description="There's nothing logged yet, so there's nothing to chart."
        />
      </div>
    );
  }

  const monthlyEntries = entriesPerMonth(entries).map((b) => ({
    label: b.label,
    value: b.count,
  }));
  const monthlyMinutes = workoutMinutesPerMonth(entries).map((b) => ({
    label: b.label,
    value: b.count,
  }));
  const difficultyTrend = difficultyTrendByMonth(entries).map((b) => ({
    label: b.label,
    value: b.value,
  }));
  const exerciseBreakdown = topByFrequency(entries.map((e) => e.exerciseName));
  const tagBreakdown = topByFrequency(entries.flatMap((e) => e.tags));

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="text-muted-foreground">The long view of training here.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Workout streak</h2>
        <div className="overflow-x-auto rounded-xl border p-4">
          <StreakHeatmap entries={entries} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Entries over time</h2>
          <div className="rounded-xl border p-4">
            <TrendBarChart data={monthlyEntries} valueLabel="entries" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Workout time over time</h2>
          <div className="rounded-xl border p-4">
            <TrendBarChart data={monthlyMinutes} valueLabel="minutes" />
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Exertion trend</h2>
        <p className="text-sm text-muted-foreground">
          Average self-rated exertion of sets logged each month.
        </p>
        <div className="rounded-xl border p-4">
          <TrendLineChart data={difficultyTrend} valueLabel="avg. exertion" domain={[1, 5]} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Most-performed exercises</h2>
          <div className="rounded-xl border p-4">
            <RankedBarChart data={exerciseBreakdown} valueLabel="sets" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Top tags</h2>
          <div className="rounded-xl border p-4">
            {tagBreakdown.length > 0 ? (
              <RankedBarChart data={tagBreakdown} valueLabel="sets" />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No tags logged yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
