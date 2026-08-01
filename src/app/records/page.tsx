import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy, ExternalLink } from "lucide-react";
import { getAllEntries } from "@/lib/data";
import { EmptyState } from "@/components/empty-state";
import { personalRecords } from "@/lib/stats";
import { gymRecords, formatGrade } from "@/lib/climbing";
import { getSession } from "@/lib/session";
import { isClimbingModeEnabled } from "@/lib/users";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [entries, climbingMode] = await Promise.all([
    getAllEntries(session.userId),
    isClimbingModeEnabled(session.userId),
  ]);

  if (climbingMode) {
    const records = gymRecords(entries);

    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gym records</h1>
          <p className="text-muted-foreground">Your hardest send at every gym.</p>
        </div>

        {records.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No records yet"
            description="Log a climb with a gym and grade and it'll show up here as a record."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gym</TableHead>
                  <TableHead>Best grade</TableHead>
                  <TableHead>Times at that grade</TableHead>
                  <TableHead className="text-right">First send</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.gym}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/exercise?gym=${encodeURIComponent(r.gym)}&grade=${r.bestGrade}`}
                        className="hover:underline"
                      >
                        {r.gym}
                      </Link>
                    </TableCell>
                    <TableCell>{formatGrade(r.bestGrade)}</TableCell>
                    <TableCell>
                      {r.timesAtBestGrade} time{r.timesAtBestGrade === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/entries/${r.oldestEntryId}`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        {new Date(r.oldestRecordedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  const records = personalRecords(entries).sort((a, b) => b.weight - a.weight);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Personal records</h1>
        <p className="text-muted-foreground">Your heaviest logged set for every exercise.</p>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No records yet"
          description="Log a set with a weight and it'll show up here as a personal record."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exercise</TableHead>
                <TableHead>PR</TableHead>
                <TableHead className="text-right">First hit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.exerciseName}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/exercise?name=${encodeURIComponent(r.exerciseName)}`}
                      className="hover:underline"
                    >
                      {r.exerciseName}
                    </Link>
                  </TableCell>
                  <TableCell>{r.weight} lb/kg</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/entries/${r.entryId}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      {new Date(r.recordedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
