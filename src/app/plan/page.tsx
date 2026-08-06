"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { PlanDayCard } from "@/components/plans/plan-day-card";
import { getWeekDays, getMonthGrid, groupPlansByDay, planDayKey } from "@/lib/plans";
import type { Role } from "@/lib/auth";
import type { ExerciseCategory, WorkoutPlan } from "@/lib/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Reopening this page soon after leaving it shouldn't feel like starting from scratch -- this
// caches the last-fetched session/categories/plans in sessionStorage (survives navigating away
// and back, or reloading the same tab; cleared when the tab closes) so a revisit within a few
// minutes renders instantly from cache, while a fresh fetch still quietly runs underneath to
// catch anything that changed (stale-while-revalidate) instead of the page starting empty every
// single time.
const PLAN_CACHE_KEY = "planPageCache:v1";
const PLAN_CACHE_TTL_MS = 5 * 60 * 1000;

interface PlanPageCache {
  fetchedAt: number;
  rangeStart: string;
  rangeEnd: string;
  role: Role | null;
  climbingMode: boolean;
  categories: ExerciseCategory[];
  plans: WorkoutPlan[];
}

function readPlanCache(rangeStart: string, rangeEnd: string): PlanPageCache | null {
  try {
    const raw = sessionStorage.getItem(PLAN_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as PlanPageCache;
    if (cache.rangeStart !== rangeStart || cache.rangeEnd !== rangeEnd) return null;
    if (Date.now() - cache.fetchedAt > PLAN_CACHE_TTL_MS) return null;
    return cache;
  } catch {
    return null;
  }
}

function writePlanCache(cache: PlanPageCache) {
  try {
    sessionStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable (private browsing, etc.) -- caching is a nice-to-have, not
    // required for the page to work, so fail silently.
  }
}

export default function PlanPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [climbingMode, setClimbingMode] = useState(false);
  const [plans, setPlans] = useState<WorkoutPlan[] | null>(null);
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });

  const thisWeek = useMemo(() => getWeekDays(0), []);
  const nextWeek = useMemo(() => getWeekDays(1), []);
  const monthGrid = useMemo(
    () => getMonthGrid(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth()),
    [calendarMonth]
  );

  // Covers both the two-week add-plan strips and whatever month is currently displayed on the
  // calendar (which can be paged independently of "this/next week") in a single range, so paging
  // the calendar never has to wait on a second round-trip just to light up its dots. Hoisted out
  // of the fetch effect below so the cache-read effect can use the exact same range.
  const { rangeStart, rangeEnd } = useMemo(() => {
    const gridStart = monthGrid[0].date;
    const gridEndExclusive = new Date(monthGrid[monthGrid.length - 1].date.getTime() + MS_PER_DAY);
    const start = new Date(Math.min(thisWeek[0].getTime(), gridStart.getTime()));
    const endExclusive = new Date(
      Math.max(nextWeek[6].getTime() + MS_PER_DAY, gridEndExclusive.getTime())
    );
    return {
      rangeStart: start.toISOString(),
      rangeEnd: new Date(endExclusive.getTime() - 1).toISOString(),
    };
  }, [thisWeek, nextWeek, monthGrid]);

  // Render instantly from cache (if any) for this exact range, before either fetch below even
  // starts -- both still run right after to keep things current. Deferred to a microtask so
  // setState isn't called synchronously in the effect body itself (still resolves before paint,
  // so there's no visible delay).
  useEffect(() => {
    queueMicrotask(() => {
      const cached = readPlanCache(rangeStart, rangeEnd);
      if (!cached) return;
      setRole(cached.role);
      setClimbingMode(cached.climbingMode);
      setCategories(cached.categories);
      setPlans(cached.plans);
    });
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => {
        setRole(data.role);
        setClimbingMode(Boolean(data.climbingMode));
      })
      .catch(() => {});
    fetch("/api/exercise-categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/plans?start=${encodeURIComponent(rangeStart)}&end=${encodeURIComponent(rangeEnd)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPlans(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // Keep whatever we already have (e.g. from cache) rather than wiping it on a transient
        // network blip -- only fall back to empty if there was nothing to show yet.
        if (!cancelled) setPlans((prev) => prev ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd]);

  // Keeps the cache current so the next visit can skip the wait too. Fires whenever any piece
  // changes, once there's a real plans array to persist (skips the initial null/loading state).
  useEffect(() => {
    if (plans === null) return;
    writePlanCache({ fetchedAt: Date.now(), rangeStart, rangeEnd, role, climbingMode, categories, plans });
  }, [plans, role, climbingMode, categories, rangeStart, rangeEnd]);

  const grouped = useMemo(
    () => (plans ? groupPlansByDay(plans) : new Map<string, WorkoutPlan[]>()),
    [plans]
  );

  const fulfilledDates = useMemo(
    () => (plans ?? []).filter((p) => p.fulfilledEntryId != null).map((p) => new Date(p.plannedDate)),
    [plans]
  );

  function handleCreated(plan: WorkoutPlan) {
    setPlans((prev) => (prev ? [...prev, plan] : [plan]));
  }

  function handleUpdated(plan: WorkoutPlan) {
    setPlans((prev) => (prev ? prev.map((p) => (p.id === plan.id ? plan : p)) : prev));
  }

  function handleDeleted(id: string) {
    setPlans((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  }

  function renderWeekStrip(days: Date[], label: string) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{label}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          {days.map((day) => {
            const key = planDayKey(day);
            const dayPlans = grouped.get(key) ?? [];
            const isToday = key === planDayKey(new Date());
            return (
              <PlanDayCard
                key={key}
                day={day}
                dayPlans={dayPlans}
                role={role}
                climbingMode={climbingMode}
                categories={categories}
                isToday={isToday}
                onCreated={handleCreated}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
        <p className="text-muted-foreground">
          {role === "visitor"
            ? "Add exercises for the coming weeks."
            : "Browse past workouts on the calendar, and plan what's coming up below."}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <Calendar
          timeZone="UTC"
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          modifiers={{ dot: fulfilledDates }}
          onDayClick={(day) => router.push(`/library?date=${planDayKey(day)}`)}
          className="rounded-xl border"
        />
        <p className="text-xs text-muted-foreground">
          Dots mark days a planned workout was completed — click a day to see what was logged.
        </p>
      </div>

      <div className="space-y-8">
        {renderWeekStrip(thisWeek, "This week")}
        {renderWeekStrip(nextWeek, "Next week")}
      </div>
    </div>
  );
}
