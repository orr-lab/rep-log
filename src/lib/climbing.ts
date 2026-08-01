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

/** Average grade climbed per month, over the trailing `months` months -- the climbing-mode
 *  counterpart to `difficultyTrendByMonth()` in src/lib/stats.ts. Entries without a grade are
 *  skipped rather than counted as 0, same reasoning as that function skipping months with no
 *  logged entries (a null-average month vs. a zero-average month are different things). */
export function gradeTrendByMonth(
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
    if (e.grade == null) continue;
    const d = new Date(e.recordedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const i = index.get(key);
    if (i != null) {
      buckets[i].sum += e.grade;
      buckets[i].n += 1;
    }
  }

  return buckets.map((b) => ({
    month: b.month,
    label: b.label,
    value: b.n > 0 ? Math.round((b.sum / b.n) * 10) / 10 : null,
  }));
}

/** Y-axis bounds for the grade trend chart, zoomed to the range this account actually climbs in
 *  rather than the full V0-V17 scale -- someone topping out around V4 shouldn't see their whole
 *  trend squashed into the bottom quarter of a chart that goes to V17. Pads a grade on either
 *  side of the account's actual min/max (clamped to the real scale) so the line isn't pinned to
 *  the edges. Falls back to the full scale if nothing's been graded yet. */
export function gradeChartDomain(entries: WorkoutEntry[]): [number, number] {
  const grades = entries.map((e) => e.grade).filter((g): g is number => g != null);
  if (grades.length === 0) return [0, MAX_GRADE];
  const min = Math.min(...grades);
  const max = Math.max(...grades);
  return [Math.max(0, min - 1), Math.min(MAX_GRADE, max + 1)];
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
