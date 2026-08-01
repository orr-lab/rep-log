import type { WorkoutEntry, ManualRecord } from "@/lib/types";
import { gymKey } from "@/lib/types";

export const MAX_GRADE = 17;

/** V0 through V17 (bouldering V-scale). Stored as a plain integer so "best grade" and
 *  "sort by hardest first" are numeric comparisons, not string comparisons across
 *  incompatible grade notations. */
export const GRADE_OPTIONS = Array.from({ length: MAX_GRADE + 1 }, (_, n) => n);

export function formatGrade(grade: number): string {
  return `V${grade}`;
}

/** Climbing-specific tag catalog, used instead of the general COMMON_TAGS catalog
 *  (src/lib/exercise-catalog.ts) when the account is in climbing mode -- Push/Legs/Chest/etc.
 *  don't apply here. */
export const COMMON_CLIMBING_TAGS = [
  "Bouldering",
  "Lead",
  "Top Rope",
  "Slab",
  "Overhang",
  "Crimpy",
  "Slopers",
  "Dyno",
  "Technical",
  "Powerful",
  "Endurance",
  "Footwork",
  "Core",
  "Flash",
  "Send",
  "Project",
  "Outdoor",
  "Comp",
  "Warmup",
];

export interface GymRecord {
  gym: string;
  bestGrade: number;
  timesAtBestGrade: number;
  /** "entry" if logged sends hold this record, "manual" if a directly-entered ManualRecord (see
   *  /records) is the only one at the best grade. */
  source: "entry" | "manual";
  oldestEntryId: string | null;
  oldestManualRecordId: string | null;
  oldestRecordedAt: string;
  oldestLink: string | null;
}

type GymCandidate = {
  gym: string;
  grade: number;
  recordedAt: string;
  source: "entry" | "manual";
  id: string;
  link: string | null;
};

/** Groups climbing entries and manual records by gym, and for each gym finds the hardest grade
 *  climbed there, how many sends are at that grade, and the earliest (oldest) one -- the send
 *  that first reached that grade at that gym. Entries/records missing a gym or grade are
 *  excluded; there's nothing to rank them by. Entries logged as unsuccessful (didn't send) are
 *  also excluded -- a failed attempt at a new PR grade shouldn't silently become the new record. */
export function gymRecords(entries: WorkoutEntry[], manualRecords: ManualRecord[] = []): GymRecord[] {
  const candidates: GymCandidate[] = [];
  for (const e of entries) {
    if (e.gym == null || e.grade == null || !e.succeeded) continue;
    candidates.push({
      gym: e.gym,
      grade: e.grade,
      recordedAt: e.recordedAt,
      source: "entry",
      id: e.id,
      link: null,
    });
  }
  for (const m of manualRecords) {
    if (m.gym == null || m.grade == null) continue;
    candidates.push({
      gym: m.gym,
      grade: m.grade,
      recordedAt: m.recordedAt,
      source: "manual",
      id: m.id,
      link: m.link,
    });
  }

  const byGym = new Map<string, { gym: string; candidates: GymCandidate[] }>();
  for (const c of candidates) {
    const key = gymKey({ gym: c.gym });
    const existing = byGym.get(key);
    if (existing) existing.candidates.push(c);
    else byGym.set(key, { gym: c.gym, candidates: [c] });
  }

  const records: GymRecord[] = [];
  for (const { gym, candidates: gymCandidates } of byGym.values()) {
    const bestGrade = Math.max(...gymCandidates.map((c) => c.grade));
    const atBestGrade = gymCandidates
      .filter((c) => c.grade === bestGrade)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const oldest = atBestGrade[0];

    records.push({
      gym,
      bestGrade,
      timesAtBestGrade: atBestGrade.length,
      source: oldest.source,
      oldestEntryId: oldest.source === "entry" ? oldest.id : null,
      oldestManualRecordId: oldest.source === "manual" ? oldest.id : null,
      oldestRecordedAt: oldest.recordedAt,
      oldestLink: oldest.link,
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
