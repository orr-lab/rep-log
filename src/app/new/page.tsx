import { redirect } from "next/navigation";
import { WorkoutEntryForm } from "@/components/workout-entry-form";
import { getSession } from "@/lib/session";
import { isVideoUploadEnabled } from "@/lib/users";

export default async function NewEntryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const uploadsEnabled = await isVideoUploadEnabled();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Log a new set</h1>
        <p className="text-muted-foreground">Capture how this set went while it&apos;s fresh.</p>
      </div>
      <WorkoutEntryForm mode="create" userId={session.userId} uploadsEnabled={uploadsEnabled} />
    </div>
  );
}
