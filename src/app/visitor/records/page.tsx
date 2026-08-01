import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, ExternalLink } from "lucide-react";
import { getAllEntries } from "@/lib/data";
import { EmptyState } from "@/components/empty-state";
import { personalRecords } from "@/lib/stats";
import { gymRecords, formatGrade } from "@/lib/climbing";
import { getPublicAdminUserId } from "@/lib/public-scope";
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

export default async function PublicRecordsPage() {
  const adminId = await getPublicAdminUserId();
  if (!adminId) notFound();

  const [entries, climbingMode] = await Promise.all([
    getAllEntries(adminId),
    isClimbingModeEnabled(adminId),
  ]);

  if (climbingMode) {
    const records = gymRecords(entries);

    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gym records</h1>
          <p className="text-muted-foreground">Hardest send at every gym.</p>
        </div>

        {records.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No records yet"
            description="There's nothing logged yet, so there's nothing to rank."
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
                        href={`/visitor/exercise?gym=${encodeURIComponent(r.gym)}&grade=${r.bestGrade}`}
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
                        href={`/visitor/entries/${r.oldestEntryId}`}
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
        <p className="text-muted-foreground">Heaviest logged set for every exercise.</p>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No records yet"
          description="There's nothing logged yet, so there's nothing to rank."
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
                      href={`/visitor/exercise?name=${encodeURIComponent(r.exerciseName)}`}
                      className="hover:underline"
                    >
                      {r.exerciseName}
                    </Link>
                  </TableCell>
                  <TableCell>{r.weight} lb/kg</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/visitor/entries/${r.entryId}`}
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
