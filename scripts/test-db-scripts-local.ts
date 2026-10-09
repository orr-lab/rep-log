// Round-trip test for the backup tooling, entirely against an in-memory PGlite database exposed on
// localhost -- never the real DATABASE_URL. Applies prisma/migrations, restores backup/db with
// importDb(), checks every row matches the export field-for-field, then runs the wipe's
// deleteAllRows() and checks every table is empty but still exists.
// Run with: npx tsx scripts/test-db-scripts-local.ts
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { importDb } from "./import-db";
import { createScriptPrismaClient } from "./lib/db-client";
import { delegateName, MODELS_IN_FK_ORDER } from "./lib/models";
import { countRows, deleteAllRows } from "./lib/wipe";

const PORT = 54329;
const LOCAL_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable&connection_limit=1`;
const BACKUP_DIR = path.resolve("backup", "db");

async function main() {
  const db = await PGlite.create();
  const migrationsDir = path.resolve("prisma", "migrations");
  const migrations = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const m of migrations) await db.exec(await readFile(path.join(migrationsDir, m, "migration.sql"), "utf8"));
  console.log(`Applied ${migrations.length} migrations to in-memory PGlite`);

  const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
  await server.start();
  let failures = 0;
  try {
    const imported = await importDb(LOCAL_URL, BACKUP_DIR);
    console.log("Imported:", JSON.stringify(imported));

    const prisma = createScriptPrismaClient(LOCAL_URL);
    for (const model of MODELS_IN_FK_ORDER) {
      const exported: { id: string }[] = JSON.parse(await readFile(path.join(BACKUP_DIR, `${model}.json`), "utf8"));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const restored: { id: string }[] = await (prisma as any)[delegateName(model)].findMany({ orderBy: { id: "asc" } });
      const same = JSON.stringify(JSON.parse(JSON.stringify(restored))) === JSON.stringify(exported);
      if (!same) failures++;
      console.log(`${same ? "OK  " : "FAIL"} ${model}: ${restored.length} rows identical to export`);
    }

    // A second import into a non-empty database must be refused. (The socket server takes one
    // connection at a time, so release ours first; Prisma reconnects on the next query.)
    await prisma.$disconnect();
    const refused = await importDb(LOCAL_URL, BACKUP_DIR).then(
      () => false,
      (e: Error) => /not empty/.test(e.message)
    );
    if (!refused) failures++;
    console.log(`${refused ? "OK  " : "FAIL"} import refuses a non-empty target`);

    const deleted = await deleteAllRows(prisma);
    console.log("Wipe deleted:", JSON.stringify(deleted));
    const after = await countRows(prisma);
    const empty = Object.values(after).every((n) => n === 0);
    if (!empty) failures++;
    console.log(`${empty ? "OK  " : "FAIL"} every table empty after wipe`);
    await prisma.$disconnect();

    const tables = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const kept = tables.rows[0].n === MODELS_IN_FK_ORDER.length;
    if (!kept) failures++;
    console.log(`${kept ? "OK  " : "FAIL"} schema intact after wipe (${tables.rows[0].n} tables)`);
  } finally {
    await server.stop();
    await db.close();
  }
  if (failures) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("All local round-trip checks passed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
