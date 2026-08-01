import { notFound } from "next/navigation";
import { getAllEntries, getAllManualRecords } from "@/lib/data";
import { getPublicAdminUserId } from "@/lib/public-scope";
import { isClimbingModeEnabled } from "@/lib/users";
import { RecordsClient } from "@/components/records/records-client";

export const dynamic = "force-dynamic";

export default async function PublicRecordsPage() {
  const adminId = await getPublicAdminUserId();
  if (!adminId) notFound();

  const [entries, manualRecords, climbingMode] = await Promise.all([
    getAllEntries(adminId),
    getAllManualRecords(adminId),
    isClimbingModeEnabled(adminId),
  ]);

  return (
    <RecordsClient
      entries={entries}
      initialManualRecords={manualRecords}
      climbingMode={climbingMode}
      role="visitor"
      exerciseSuggestions={[]}
      gymSuggestions={[]}
      basePath="/visitor"
      isPublic
    />
  );
}
