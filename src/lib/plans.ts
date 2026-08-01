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
  return getWeekDays(0);
}

/** Same Sunday-first week convention as `getCurrentWeekDays()`, offset by whole weeks --
 *  `weeksAhead: 1` gives next week's seven days. */
export function getWeekDays(weeksAhead: number): Date[] {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfWeek = new Date(
    today.getTime() - today.getUTCDay() * MS_PER_DAY + weeksAhead * 7 * MS_PER_DAY
  );
  return Array.from({ length: 7 }, (_, i) => new Date(startOfWeek.getTime() + i * MS_PER_DAY));
}

export interface MonthCalendarDay {
  date: Date;
  inMonth: boolean;
}

/** A full 6-week (42-day) grid for the given month (0-indexed), Sunday-first, padded with the
 *  trailing days of the previous month and the leading days of the next so every week is
 *  complete -- the standard month-calendar layout. `year`/`month` describe the month to display,
 *  not necessarily the current one (the calendar can be paged). */
export function getMonthGrid(year: number, month: number): MonthCalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startOffset = firstOfMonth.getUTCDay();
  const gridStart = new Date(firstOfMonth.getTime() - startOffset * MS_PER_DAY);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getTime() + i * MS_PER_DAY);
    return { date, inMonth: date.getUTCMonth() === month };
  });
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
