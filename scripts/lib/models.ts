// Model order and row (de)serialization shared by import-db.ts and wipe-database.ts.
import { Prisma } from "@prisma/client";

/** Parents before children, so inserts never violate a foreign key. Deletes run in reverse. */
export const MODELS_IN_FK_ORDER = [
  "User",
  "LoginAttempt",
  "ExerciseCategory",
  "ExercisePreset",
  "WorkoutPlan",
  "ManualRecord",
  "WorkoutEntry",
  "EntryVideo",
  "Comment",
] as const;

export type ModelName = (typeof MODELS_IN_FK_ORDER)[number];

export function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/** Fails loudly if the schema gained a model the ordered list above doesn't know about yet. */
export function assertModelListMatchesSchema(): void {
  const schemaModels = Prisma.dmmf.datamodel.models.map((m) => m.name).sort();
  const listed = [...MODELS_IN_FK_ORDER].sort();
  if (JSON.stringify(schemaModels) !== JSON.stringify(listed)) {
    throw new Error(
      `scripts/lib/models.ts is out of date: schema has [${schemaModels.join(", ")}], ` +
        `list has [${listed.join(", ")}]`
    );
  }
}

/** JSON.parse leaves DateTime fields as ISO strings; turn them back into Dates for createMany. */
export function reviveRow(model: string, row: Record<string, unknown>): Record<string, unknown> {
  const fields = Prisma.dmmf.datamodel.models.find((m) => m.name === model)!.fields;
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.kind === "object") continue;
    if (!(field.name in row)) continue;
    const value = row[field.name];
    out[field.name] = field.type === "DateTime" && typeof value === "string" ? new Date(value) : value;
  }
  return out;
}
