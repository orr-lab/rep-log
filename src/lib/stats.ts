import type { WorkoutEntry, ManualRecord } from "@/lib/types";
import { exerciseKey } from "@/lib/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function currentStreak(entries: WorkoutEntry[]): number {
  if (entries.length === 0) return 0;

  const days = new Set(entries.map((e) => toDayKey(new Date(e.recordedAt))));
  let cursor = todayUtcMidnight();

  if (!days.has(toDayKey(cursor))) {
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
    if (!days.has(toDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(toDayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
  }
  return streak;
}

export function totalWorkoutSeconds(entries: WorkoutEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.durationSec ?? 0), 0);
}

export function uniqueExerciseCount(entries: WorkoutEntry[]): number {
  return new Set(entries.map((e) => exerciseKey(e))).size;
}

export function formatHoursMinutes(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function entriesPerMonth(
  entries: WorkoutEntry[],
  months = 12
): { month: string; label: string; count: number }[] {
  const now = new Date();
  const buckets: { month: string; label: string; count: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      month: key,
      label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      count: 0,
    });
  }

  const index = new Map(buckets.map((b, i) => [b.month, i]));
  for (const e of entries) {
    const d = new Date(e.recordedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const i = index.get(key);
    if (i != null) buckets[i].count += 1;
  }

  return buckets;
}

export function workoutMinutesPerMonth(
  entries: WorkoutEntry[],
  months = 12
): { month: string; label: string; count: number }[] {
  const now = new Date();
  const buckets: { month: string; label: string; count: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      month: key,
      label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      count: 0,
    });
  }

  const index = new Map(buckets.map((b, i) => [b.month, i]));
  for (const e of entries) {
    const d = new Date(e.recordedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const i = index.get(key);
    if (i != null) buckets[i].count += Math.round((e.durationSec ?? 0) / 60);
  }

  return buckets;
}

export function difficultyTrendByMonth(
  entries: WorkoutEntry[],
  months = 12
): { month: string; label: string; value: number | null }[] {
  const now = new Date();
  const buckets: { month: string; label: string; sum: number; n: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      month: key,
      label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      sum: 0,
      n: 0,
    });
  }

  const index = new Map(buckets.map((b, i) => [b.month, i]));
  for (const e of entries) {
    const d = new Date(e.recordedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const i = index.get(key);
    if (i != null) {
      buckets[i].sum += e.difficulty;
      buckets[i].n += 1;
    }
  }

  return buckets.map((b) => ({
    month: b.month,
    label: b.label,
    value: b.n > 0 ? Math.round((b.sum / b.n) * 10) / 10 : null,
  }));
}

export function topByFrequency(
  values: string[],
  topN = 8
): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN).reduce((sum, [, c]) => sum + c, 0);

  const result = top.map(([label, value]) => ({ label, value }));
  if (rest > 0) result.push({ label: "Other", value: rest });
  return result;
}

export function groupByExercise(entries: WorkoutEntry[]): Map<string, WorkoutEntry[]> {
  const groups = new Map<string, WorkoutEntry[]>();
  for (const e of entries) {
    const key = exerciseKey(e);
    const existing = groups.get(key);
    if (existing) existing.push(e);
    else groups.set(key, [e]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  }
  return groups;
}

export interface PersonalRecord {
  exerciseName: string;
  weight: number;
  recordedAt: string;
  /** "entry" if a logged WorkoutEntry holds this record, "manual" if a directly-entered
   *  ManualRecord (see /records) currently beats every logged entry for this exercise. */
  source: "entry" | "manual";
  entryId: string | null;
  manualRecordId: string | null;
  link: string | null;
}

/** Heaviest weight per exercise, drawn from logged entries and manually-entered records
 *  together -- a manual record (backfilled PR with no video) can win the same way a logged entry
 *  can. Bodyweight-only exercises (no candidate has a weight) don't produce a record -- there's
 *  nothing to rank them by. Entries logged as unsuccessful (missed the lift) are excluded -- a
 *  failed attempt at a new PR weight shouldn't silently become the new record, even though it
 *  still shows up everywhere else in the app. Ties keep the earliest-achieved candidate. */
export function personalRecords(
  entries: WorkoutEntry[],
  manualRecords: ManualRecord[] = []
): PersonalRecord[] {
  type Candidate = {
    exerciseName: string;
    weight: number;
    recordedAt: string;
    source: "entry" | "manual";
    id: string;
    link: string | null;
  };

  const candidates: Candidate[] = [];
  for (const e of entries) {
    if (e.succeeded && e.weight != null) {
      candidates.push({
        exerciseName: e.exerciseName,
        weight: e.weight,
        recordedAt: e.recordedAt,
        source: "entry",
        id: e.id,
        link: null,
      });
    }
  }
  for (const m of manualRecords) {
    if (m.weight != null) {
      candidates.push({
        exerciseName: m.exerciseName,
        weight: m.weight,
        recordedAt: m.recordedAt,
        source: "manual",
        id: m.id,
        link: m.link,
      });
    }
  }

  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = exerciseKey({ exerciseName: c.exerciseName });
    const existing = groups.get(key);
    if (existing) existing.push(c);
    else groups.set(key, [c]);
  }

  const records: PersonalRecord[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    let best: Candidate | null = null;
    for (const c of group) {
      if (best == null || c.weight > best.weight) best = c;
    }
    if (best) {
      records.push({
        exerciseName: best.exerciseName,
        weight: best.weight,
        recordedAt: best.recordedAt,
        source: best.source,
        entryId: best.source === "entry" ? best.id : null,
        manualRecordId: best.source === "manual" ? best.id : null,
        link: best.link,
      });
    }
  }

  return records.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

export function entriesInLastDays(entries: WorkoutEntry[], days = 7): WorkoutEntry[] {
  const cutoff = Date.now() - days * MS_PER_DAY;
  return entries.filter((e) => new Date(e.recordedAt).getTime() >= cutoff);
}
