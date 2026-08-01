"use client";

import Link from "next/link";
import { useState } from "react";
import { Trophy, ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { personalRecords } from "@/lib/stats";
import { gymRecords, formatGrade } from "@/lib/climbing";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddManualRecordDialog } from "@/components/records/add-manual-record-dialog";
import { DeleteManualRecordButton } from "@/components/records/delete-manual-record-button";
import type { WorkoutEntry, ManualRecord } from "@/lib/types";
import type { Role } from "@/lib/auth";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecordsClient({
  entries,
  initialManualRecords,
  climbingMode,
  role,
  exerciseSuggestions,
  gymSuggestions,
  basePath = "",
  isPublic = false,
}: {
  entries: WorkoutEntry[];
  initialManualRecords: ManualRecord[];
  climbingMode: boolean;
  role: Role;
  exerciseSuggestions: string[];
  gymSuggestions: string[];
  /** Prefix for entry/exercise links, e.g. "/visitor" for the public read-only mirror. */
  basePath?: string;
  /** True on the public, no-login mirror -- adjusts copy from "your" to a neutral third-person tone. */
  isPublic?: boolean;
}) {
  const [manualRecords, setManualRecords] = useState(initialManualRecords);

  function handleCreated(record: ManualRecord) {
    setManualRecords((prev) => [record, ...prev]);
  }
  function handleDeleted(id: string) {
    setManualRecords((prev) => prev.filter((r) => r.id !== id));
  }

  const addDialog = role === "owner" && (
    <AddManualRecordDialog
      climbingMode={climbingMode}
      exerciseSuggestions={exerciseSuggestions}
      gymSuggestions={gymSuggestions}
      onCreated={handleCreated}
    />
  );

  if (climbingMode) {
    const records = gymRecords(entries, manualRecords);

    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gym records</h1>
            <p className="text-muted-foreground">
              {isPublic ? "Hardest send at every gym." : "Your hardest send at every gym."}
            </p>
          </div>
          {addDialog}
        </div>

        {records.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No records yet"
            description={
              isPublic
                ? "There's nothing logged yet, so there's nothing to rank."
                : "Log a climb with a gym and grade, or add one directly, and it'll show up here as a record."
            }
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
                        href={`${basePath}/exercise?gym=${encodeURIComponent(r.gym)}&grade=${r.bestGrade}`}
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
                      <div className="flex items-center justify-end gap-1">
                        {r.source === "manual" && (
                          <Badge variant="outline" className="mr-1 shrink-0">
                            Manual
                          </Badge>
                        )}
                        {r.source === "entry" ? (
                          <Link
                            href={`${basePath}/entries/${r.oldestEntryId}`}
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                          >
                            {formatDate(r.oldestRecordedAt)}
                            <ExternalLink className="size-3.5" />
                          </Link>
                        ) : r.oldestLink ? (
                          <a
                            href={r.oldestLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                          >
                            {formatDate(r.oldestRecordedAt)}
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : (
                          <span className="px-2 text-sm text-muted-foreground">
                            {formatDate(r.oldestRecordedAt)}
                          </span>
                        )}
                        {role === "owner" && r.source === "manual" && r.oldestManualRecordId && (
                          <DeleteManualRecordButton
                            id={r.oldestManualRecordId}
                            onDeleted={handleDeleted}
                          />
                        )}
                      </div>
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

  const records = personalRecords(entries, manualRecords).sort((a, b) => b.weight - a.weight);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Personal records</h1>
          <p className="text-muted-foreground">
            {isPublic ? "Heaviest logged set for every exercise." : "Your heaviest logged set for every exercise."}
          </p>
        </div>
        {addDialog}
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No records yet"
          description={
            isPublic
              ? "There's nothing logged yet, so there's nothing to rank."
              : "Log a set with a weight, or add one directly, and it'll show up here as a personal record."
          }
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
                      href={`${basePath}/exercise?name=${encodeURIComponent(r.exerciseName)}`}
                      className="hover:underline"
                    >
                      {r.exerciseName}
                    </Link>
                  </TableCell>
                  <TableCell>{r.weight} lb/kg</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.source === "manual" && (
                        <Badge variant="outline" className="mr-1 shrink-0">
                          Manual
                        </Badge>
                      )}
                      {r.source === "entry" ? (
                        <Link
                          href={`${basePath}/entries/${r.entryId}`}
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          {formatDate(r.recordedAt)}
                          <ExternalLink className="size-3.5" />
                        </Link>
                      ) : r.link ? (
                        <a
                          href={r.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          {formatDate(r.recordedAt)}
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        <span className="px-2 text-sm text-muted-foreground">
                          {formatDate(r.recordedAt)}
                        </span>
                      )}
                      {role === "owner" && r.source === "manual" && r.manualRecordId && (
                        <DeleteManualRecordButton
                          id={r.manualRecordId}
                          onDeleted={handleDeleted}
                        />
                      )}
                    </div>
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
