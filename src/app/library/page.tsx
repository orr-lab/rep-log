"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Dumbbell, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EntryCard } from "@/components/entry-card";
import { EmptyState } from "@/components/empty-state";
import { exerciseKey, gymKey, type WorkoutEntry } from "@/lib/types";
import type { Role } from "@/lib/auth";

function groupByExerciseForDisplay(entries: WorkoutEntry[]) {
  const groups = new Map<
    string,
    { representative: WorkoutEntry; count: number; succeededCount: number }
  >();
  for (const e of entries) {
    const key = exerciseKey(e);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (e.succeeded) existing.succeededCount += 1;
    } else {
      groups.set(key, { representative: e, count: 1, succeededCount: e.succeeded ? 1 : 0 });
    }
  }
  return Array.from(groups.values());
}

/** Same "first-encountered-in-current-sort-order wins as representative" approach as
 *  groupByExerciseForDisplay, just keyed on gym+grade instead of exercise name. */
function groupByGymGradeForDisplay(entries: WorkoutEntry[]) {
  const groups = new Map<
    string,
    { representative: WorkoutEntry; count: number; succeededCount: number }
  >();
  for (const e of entries) {
    if (e.gym == null || e.grade == null) continue;
    const key = `${gymKey(e)}::${e.grade}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (e.succeeded) existing.succeededCount += 1;
    } else {
      groups.set(key, { representative: e, count: 1, succeededCount: e.succeeded ? 1 : 0 });
    }
  }
  return Array.from(groups.values());
}

const SORT_OPTIONS = [
  { value: "date:desc", label: "Newest first" },
  { value: "date:asc", label: "Oldest first" },
  { value: "difficulty:desc", label: "Hardest first" },
  { value: "difficulty:asc", label: "Easiest first" },
  { value: "exercise:asc", label: "Exercise name (A–Z)" },
];

const CLIMBING_SORT_OPTIONS = [
  { value: "grade:desc", label: "Hardest grade first" },
  { value: "grade:asc", label: "Easiest grade first" },
  { value: "date:desc", label: "Newest first" },
  { value: "date:asc", label: "Oldest first" },
];

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryPageContent />
    </Suspense>
  );
}

function LibraryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  const [entries, setEntries] = useState<WorkoutEntry[] | null>(null);
  const [facets, setFacets] = useState<{ exercises: string[]; tags: string[]; gyms: string[] }>({
    exercises: [],
    tags: [],
    gyms: [],
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tag, setTag] = useState("all");
  const [gymFilter, setGymFilter] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [favorite, setFavorite] = useState(false);
  const [sortValue, setSortValue] = useState("date:desc");
  const [sort, order] = sortValue.split(":");
  const [role, setRole] = useState<Role | null>(null);
  const [climbingMode, setClimbingMode] = useState<boolean | null>(null);

  // Reset the (now stale) results the moment any filter changes, so the loading skeleton shows
  // right away instead of the old list lingering until the new fetch resolves. Done here, during
  // render, rather than in the effect below -- see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const queryKey = [debouncedSearch, tag, gymFilter, difficulty, favorite, dateParam, sort, order].join(
    "|"
  );
  const [lastQueryKey, setLastQueryKey] = useState(queryKey);
  if (queryKey !== lastQueryKey) {
    setLastQueryKey(queryKey);
    setEntries(null);
  }

  useEffect(() => {
    fetch("/api/facets")
      .then((r) => r.json())
      .then(setFacets)
      .catch(() => {});
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => {
        setRole(data.role);
        setClimbingMode(Boolean(data.climbingMode));
      })
      .catch(() => {});
  }, []);

  // Once we know this account is in climbing mode, default the sort to hardest-grade-first
  // instead of newest-first -- computed during render (same pattern as queryKey above) rather
  // than in an effect, so it only fires the one time climbingMode resolves from null to a value.
  const [lastClimbingMode, setLastClimbingMode] = useState<boolean | null>(null);
  if (climbingMode !== lastClimbingMode) {
    setLastClimbingMode(climbingMode);
    if (climbingMode) setSortValue("grade:desc");
  }

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (tag !== "all") params.set("tag", tag);
    if (gymFilter !== "all") params.set("gym", gymFilter);
    if (difficulty !== "all") params.set("difficulty", difficulty);
    if (favorite) params.set("favorite", "true");
    if (dateParam) params.set("date", dateParam);
    params.set("sort", sort);
    params.set("order", order);

    let cancelled = false;
    fetch(`/api/entries?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, tag, gymFilter, difficulty, favorite, dateParam, sort, order]);

  const groups = useMemo(() => {
    if (!entries) return [];
    return climbingMode ? groupByGymGradeForDisplay(entries) : groupByExerciseForDisplay(entries);
  }, [entries, climbingMode]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="text-muted-foreground">
          {role === "owner"
            ? `Every ${climbingMode ? "climb" : "set"} you've logged, in one place.`
            : `Every ${climbingMode ? "climb" : "set"} logged here, in one place.`}
        </p>
      </div>

      {dateParam && (
        <Badge variant="secondary" className="w-fit gap-1.5 py-1.5 pr-1.5 pl-2.5 text-sm">
          {new Date(dateParam).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Clear date filter"
            onClick={() => router.push("/library")}
          >
            <X className="size-3" />
          </Button>
        </Badge>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={climbingMode ? "Search route / problem…" : "Search exercise…"}
            className="pl-8"
          />
        </div>

        {climbingMode ? (
          <Select value={gymFilter} onValueChange={(v) => v && setGymFilter(v)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Jump to gym" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Jump to gym…</SelectItem>
              {facets.gyms.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value="all"
            onValueChange={(v) => {
              if (v && v !== "all") setSearch(v);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Jump to exercise" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Jump to exercise…</SelectItem>
              {facets.exercises.map((ex) => (
                <SelectItem key={ex} value={ex}>
                  {ex}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={tag} onValueChange={(v) => v && setTag(v)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {facets.tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={difficulty} onValueChange={(v) => v && setDifficulty(v)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Exertion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any exertion</SelectItem>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => (
              <SelectItem key={d} value={String(d)}>
                Exertion {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortValue} onValueChange={(v) => v && setSortValue(v)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {(climbingMode ? CLIMBING_SORT_OPTIONS : SORT_OPTIONS).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 sm:ml-auto">
          <Switch id="favorite" checked={favorite} onCheckedChange={setFavorite} />
          <Label htmlFor="favorite" className="text-sm font-normal">
            Favorites only
          </Label>
        </div>
      </div>

      {entries === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No entries match these filters"
          description={
            role === "owner"
              ? `Try clearing a filter, or log a new ${climbingMode ? "climb" : "set"} to grow your library.`
              : "Try clearing a filter to see more."
          }
          actionHref={role === "owner" ? "/new" : undefined}
          actionLabel={role === "owner" ? `Log a new ${climbingMode ? "climb" : "set"}` : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {groups.map(({ representative, count, succeededCount }) => (
            <EntryCard
              key={representative.id}
              entry={representative}
              count={count}
              succeededCount={succeededCount}
              href={
                count > 1
                  ? climbingMode
                    ? `/exercise?gym=${encodeURIComponent(representative.gym as string)}&grade=${representative.grade}`
                    : `/exercise?name=${encodeURIComponent(representative.exerciseName)}`
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
