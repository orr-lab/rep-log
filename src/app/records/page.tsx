import { redirect } from "next/navigation";
import { getAllEntries, getAllManualRecords } from "@/lib/data";
import { getSession } from "@/lib/session";
import { isClimbingModeEnabled } from "@/lib/users";
import { RecordsClient } from "@/components/records/records-client";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [entries, manualRecords, climbingMode] = await Promise.all([
    getAllEntries(session.userId),
    getAllManualRecords(session.userId),
    isClimbingModeEnabled(session.userId),
  ]);

  const exerciseSuggestions = Array.from(new Set(entries.map((e) => e.exerciseName))).sort(
    (a, b) => a.localeCompare(b)
  );
  const gymSuggestions = Array.from(
    new Set(entries.map((e) => e.gym).filter((g): g is string => g != null))
  ).sort((a, b) => a.localeCompare(b));

  return (
    <RecordsClient
      entries={entries}
      initialManualRecords={manualRecords}
      climbingMode={climbingMode}
      role={session.role}
      exerciseSuggestions={exerciseSuggestions}
      gymSuggestions={gymSuggestions}
    />
  );
}
