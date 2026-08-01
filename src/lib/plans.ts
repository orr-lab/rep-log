import type { WorkoutPlan } from "@/lib/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The current calendar week (Sunday through Saturday, UTC), as seven day-start Dates. Matches
 *  the week convention already used by the streak heatmap, rather than a rolling 7-day window --
 *  a planning calendar should show "this week," not shift underneath you every time you load it
 *  mid-day. */
export function getCurrentWeekDays(): Date[] {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfWeek = new Date(today.getTime() - today.getUTCDay() * MS_PER_DAY);
  return Array.from({ length: 7 }, (_, i) => new Date(startOfWeek.getTime() + i * MS_PER_DAY));
}

export function groupPlansByDay(plans: WorkoutPlan[]): Map<string, WorkoutPlan[]> {
  const groups = new Map<string, WorkoutPlan[]>();
  for (const plan of plans) {
    const key = toDayKey(new Date(plan.plannedDate));
    const existing = groups.get(key);
    if (existing) existing.push(plan);
    else groups.set(key, [plan]);
  }
  return groups;
}

export { toDayKey as planDayKey };
