import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { getAllEntries } from "@/lib/data";
import { EmptyState } from "@/components/empty-state";
import { personalRecords } from "@/lib/stats";
import { getSession } from "@/lib/session";
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

  const entries = await getAllEntries(session.userId);
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
                <TableHead>Date</TableHead>
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
