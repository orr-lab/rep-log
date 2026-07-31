import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { getAllEntries } from "@/lib/data";
import { EmptyState } from "@/components/empty-state";
import { personalRecords } from "@/lib/stats";
import { getPublicAdminUserId } from "@/lib/public-scope";
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

  const entries = await getAllEntries(adminId);
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
                <TableHead>Date</TableHead>
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
                  <TableCell className="text-muted-foreground">
                    {new Date(r.recordedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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
