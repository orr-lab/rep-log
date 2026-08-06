"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { PlanDayCard } from "@/components/plans/plan-day-card";
import { getWeekDays, getMonthGrid, groupPlansByDay, planDayKey } from "@/lib/plans";
import type { Role } from "@/lib/auth";
import type { ExerciseCategory, WorkoutPlan } from "@/lib/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

  // Covers both the two-week add-plan strips and whatever month is currently displayed on the
  // calendar (which can be paged independently of "this/next week") in a single fetch, so paging
  // the calendar never has to wait on a second round-trip just to light up its dots.
  useEffect(() => {
    const gridStart = monthGrid[0].date;
    const gridEndExclusive = new Date(monthGrid[monthGrid.length - 1].date.getTime() + MS_PER_DAY);
    const rangeStart = new Date(Math.min(thisWeek[0].getTime(), gridStart.getTime()));
    const rangeEndExclusive = new Date(
      Math.max(nextWeek[6].getTime() + MS_PER_DAY, gridEndExclusive.getTime())
    );

    const start = rangeStart.toISOString();
    const end = new Date(rangeEndExclusive.getTime() - 1).toISOString();

    let cancelled = false;
    fetch(`/api/plans?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPlans(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setPlans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [thisWeek, nextWeek, monthGrid]);

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
