import type { WorkoutEntry } from "@/lib/types";
import { gymKey } from "@/lib/types";

export const MAX_GRADE = 17;

/** V0 through V17 (bouldering V-scale). Stored as a plain integer so "best grade" and
 *  "sort by hardest first" are numeric comparisons, not string comparisons across
 *  incompatible grade notations. */
export const GRADE_OPTIONS = Array.from({ length: MAX_GRADE + 1 }, (_, n) => n);

export function formatGrade(grade: number): string {
  return `V${grade}`;
}

export interface GymRecord {
  gym: string;
  bestGrade: number;
  timesAtBestGrade: number;
  oldestEntryId: string;
  oldestRecordedAt: string;
}

/** Groups climbing entries by gym, and for each gym finds the hardest grade climbed there, how
 *  many logged sends are at that grade, and the earliest (oldest) one -- the send that first
 *  reached that grade at that gym. Entries missing a gym or grade are excluded; there's nothing
 *  to rank them by. */
export function gymRecords(entries: WorkoutEntry[]): GymRecord[] {
  const byGym = new Map<string, { gym: string; entries: WorkoutEntry[] }>();

  for (const e of entries) {
    if (e.gym == null || e.grade == null) continue;
    const key = gymKey(e);
    const existing = byGym.get(key);
    if (existing) existing.entries.push(e);
    else byGym.set(key, { gym: e.gym, entries: [e] });
  }

  const records: GymRecord[] = [];
  for (const { gym, entries: gymEntries } of byGym.values()) {
    const bestGrade = Math.max(...gymEntries.map((e) => e.grade as number));
    const atBestGrade = gymEntries
      .filter((e) => e.grade === bestGrade)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const oldest = atBestGrade[0];

    records.push({
      gym,
      bestGrade,
      timesAtBestGrade: atBestGrade.length,
      oldestEntryId: oldest.id,
      oldestRecordedAt: oldest.recordedAt,
    });
  }

  return records.sort((a, b) => b.bestGrade - a.bestGrade || a.gym.localeCompare(b.gym));
}

/** Groups climbing entries into gym+grade "stacks" (the multi-take card look), analogous to
 *  groupByExercise but keyed on the (gym, grade) pair instead of exercise name -- in climbing
 *  mode that pair, not the route/problem label, is the meaningful grouping unit. */
export function groupByGymGrade(entries: WorkoutEntry[]): Map<string, WorkoutEntry[]> {
  const groups = new Map<string, WorkoutEntry[]>();
  for (const e of entries) {
    if (e.gym == null || e.grade == null) continue;
    const key = `${gymKey(e)}::${e.grade}`;
    const existing = groups.get(key);
    if (existing) existing.push(e);
    else groups.set(key, [e]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  }
  return groups;
}
