// Loads a JSON export made by scripts/export-db.ts back into a database whose schema is already
// migrated (run `npx prisma migrate deploy` against it first). Inserts every model in foreign-key
// order inside one transaction, preserving ids and timestamps, then checks the row counts against
// counts.json. Refuses to touch a database that already has rows in any table.
//
// Run with:
//   npx tsx scripts/import-db.ts --target-url "<postgres url>" [--dir backup/db] [--allow-remote]
// --allow-remote is required for anything other than localhost, so a test run can't accidentally
// hit a real database.
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createScriptPrismaClient } from "./lib/db-client";
import { assertModelListMatchesSchema, delegateName, MODELS_IN_FK_ORDER, reviveRow } from "./lib/models";

config({ path: [".env.local", ".env"], quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

export async function importDb(targetUrl: string, dir: string): Promise<Record<string, number>> {
  assertModelListMatchesSchema();
  const expected: { counts: Record<string, number> } = JSON.parse(
    await readFile(path.join(dir, "counts.json"), "utf8")
  );
  const prisma = createScriptPrismaClient(targetUrl);
  try {
    for (const model of MODELS_IN_FK_ORDER) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const n = await (prisma as any)[delegateName(model)].count();
      if (n > 0) throw new Error(`Target database is not empty (${model} has ${n} rows) -- refusing to import.`);
    }

    await prisma.$transaction(
      async (tx) => {
        for (const model of MODELS_IN_FK_ORDER) {
          const rows: Record<string, unknown>[] = JSON.parse(
            await readFile(path.join(dir, `${model}.json`), "utf8")
          );
          if (rows.length === 0) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (tx as any)[delegateName(model)].createMany({ data: rows.map((r) => reviveRow(model, r)) });
        }
      },
      { timeout: 300_000, maxWait: 20_000 }
    );

    const actual: Record<string, number> = {};
    for (const model of MODELS_IN_FK_ORDER) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actual[model] = await (prisma as any)[delegateName(model)].count();
      if (actual[model] !== expected.counts[model]) {
        throw new Error(`${model}: imported ${actual[model]} rows, counts.json says ${expected.counts[model]}`);
      }
    }
    return actual;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const targetUrl = arg("--target-url");
  const dir = path.resolve(arg("--dir") ?? path.join("backup", "db"));
  if (!targetUrl) throw new Error("Pass --target-url <postgres url> (it is never read from DATABASE_URL).");
  const host = new URL(targetUrl).hostname;
  if (!["localhost", "127.0.0.1"].includes(host) && !process.argv.includes("--allow-remote")) {
    throw new Error(`Target host is not localhost; pass --allow-remote if you really mean to restore there.`);
  }
  const counts = await importDb(targetUrl, dir);
  for (const [model, n] of Object.entries(counts)) console.log(`OK ${model}: ${n}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
