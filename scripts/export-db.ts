// Exports every row of every Prisma model to backup/db/<Model>.json (all fields), plus the
// _prisma_migrations bookkeeping table, schema.prisma and the migrations folder, and writes
// backup/db/counts.json. Read-only against the database. Verifies each exported row count against
// a raw SELECT COUNT(*). Prints counts only -- never row contents.
// Run with: npx tsx scripts/export-db.ts
import { config } from "dotenv";
import { Prisma } from "@prisma/client";
import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createScriptPrismaClient } from "./lib/db-client";

config({ path: [".env.local", ".env"], quiet: true });

const OUT_DIR = path.resolve("backup", "db");
const PAGE_SIZE = 1000;

function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

async function main() {
  const prisma = createScriptPrismaClient();
  await mkdir(OUT_DIR, { recursive: true });

  const models = Prisma.dmmf.datamodel.models.map((m) => m.name);
  const counts: Record<string, number> = {};
  const verification: Record<string, { exported: number; selectCount: number; ok: boolean }> = {};

  // One repeatable-read transaction so every table is exported from the same snapshot.
  await prisma.$transaction(
    async (tx) => {
      for (const model of models) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const delegate = (tx as any)[delegateName(model)];
        const rows: unknown[] = [];
        let cursor: string | undefined;
        for (;;) {
          const page: { id: string }[] = await delegate.findMany({
            take: PAGE_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { id: "asc" },
          });
          rows.push(...page);
          if (page.length < PAGE_SIZE) break;
          cursor = page[page.length - 1].id;
        }
        const [{ count }] = await tx.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT COUNT(*)::bigint AS count FROM "${model}"`
        );
        await writeFile(path.join(OUT_DIR, `${model}.json`), JSON.stringify(rows, null, 2));
        counts[model] = rows.length;
        verification[model] = { exported: rows.length, selectCount: Number(count), ok: Number(count) === rows.length };
      }

      const migrations = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM "_prisma_migrations" ORDER BY started_at`
      );
      await writeFile(
        path.join(OUT_DIR, "_prisma_migrations.json"),
        JSON.stringify(migrations, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 2)
      );
      counts["_prisma_migrations"] = migrations.length;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000, maxWait: 20_000 }
  );

  await writeFile(
    path.join(OUT_DIR, "counts.json"),
    JSON.stringify({ exportedAt: new Date().toISOString(), counts, verification }, null, 2)
  );
  await cp(path.resolve("prisma", "schema.prisma"), path.join(OUT_DIR, "schema.prisma"));
  await cp(path.resolve("prisma", "migrations"), path.join(OUT_DIR, "migrations"), { recursive: true });

  await prisma.$disconnect();

  for (const [model, v] of Object.entries(verification)) {
    console.log(`${v.ok ? "OK  " : "FAIL"} ${model}: exported=${v.exported} SELECT COUNT(*)=${v.selectCount}`);
  }
  console.log(`_prisma_migrations: ${counts["_prisma_migrations"]}`);
  if (Object.values(verification).some((v) => !v.ok)) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
