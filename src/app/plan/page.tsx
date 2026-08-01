"use client";

import { useEffect, useMemo, useState } from "react";
import { AddPlanDialog } from "@/components/plans/add-plan-dialog";
import { PlanCard } from "@/components/plans/plan-card";
import { getCurrentWeekDays, groupPlansByDay, planDayKey } from "@/lib/plans";
import type { Role } from "@/lib/auth";
import type { WorkoutPlan } from "@/lib/types";

export default function PlanPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [climbingMode, setClimbingMode] = useState(false);
  const [plans, setPlans] = useState<WorkoutPlan[] | null>(null);

  const weekDays = useMemo(() => getCurrentWeekDays(), []);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => {
        setRole(data.role);
        setClimbingMode(Boolean(data.climbingMode));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const start = weekDays[0].toISOString();
    const end = new Date(weekDays[6].getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
    fetch(`/api/plans?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .then((r) => r.json())
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]));
  }, [weekDays]);

  const grouped = useMemo(
    () => (plans ? groupPlansByDay(plans) : new Map<string, WorkoutPlan[]>()),
    [plans]
  );

  function handleCreated(plan: WorkoutPlan) {
    setPlans((prev) => (prev ? [...prev, plan] : [plan]));
  }

  function handleDeleted(id: string) {
    setPlans((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">This week&apos;s plan</h1>
        <p className="text-muted-foreground">
          {role === "visitor"
            ? "Add exercises for the coming week."
            : "See what's planned for the week, and log it once it's done."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {weekDays.map((day) => {
          const key = planDayKey(day);
          const dayPlans = grouped.get(key) ?? [];
          const isToday = key === planDayKey(new Date());
          return (
            <div
              key={key}
              className={`space-y-3 rounded-xl border p-3 ${isToday ? "border-primary/50 bg-primary/5" : ""}`}
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {day.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}
                </p>
                <p className="text-sm font-semibold">
                  {day.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </p>
              </div>

              <div className="space-y-2">
                {dayPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} role={role} onDeleted={handleDeleted} />
                ))}
              </div>

              <AddPlanDialog plannedDate={key} climbingMode={climbingMode} onCreated={handleCreated} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
