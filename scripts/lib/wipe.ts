// The actual row deletion behind scripts/wipe-database.ts, split out so it can be exercised against
// a local throwaway database (scripts/test-db-scripts-local.ts) without the CLI's interactive
// guards. Deletes rows only -- no DROP/TRUNCATE -- so the schema and _prisma_migrations stay.
import type { PrismaClient } from "@prisma/client";
import { delegateName, MODELS_IN_FK_ORDER } from "./models";

export async function countRows(prisma: PrismaClient): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const model of MODELS_IN_FK_ORDER) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    counts[model] = await (prisma as any)[delegateName(model)].count();
  }
  return counts;
}

/** Children before parents, all in one transaction: either every table is emptied or none is. */
export async function deleteAllRows(prisma: PrismaClient): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {};
  await prisma.$transaction(
    async (tx) => {
      for (const model of [...MODELS_IN_FK_ORDER].reverse()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (tx as any)[delegateName(model)].deleteMany({});
        deleted[model] = count;
      }
    },
    { timeout: 120_000, maxWait: 20_000 }
  );
  return deleted;
}
