// DESTRUCTIVE: deletes every row from every table in the DATABASE_URL database (accounts
// included), for a fresh start. Schema and migration history are kept -- rows only, no DROP.
//
// Only run this after checking the backup made by scripts/backup-videos.ts + scripts/export-db.ts:
//   npx tsx scripts/wipe-database.ts --i-have-checked-the-backup
// It shows the row counts it's about to delete and asks you to type WIPE before doing anything.
import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { createScriptPrismaClient } from "./lib/db-client";
import { assertModelListMatchesSchema } from "./lib/models";
import { countRows, deleteAllRows } from "./lib/wipe";

config({ path: [".env.local", ".env"], quiet: true });

const COUNTS_FILE = path.resolve("backup", "db", "counts.json");

async function main() {
  if (!process.argv.includes("--i-have-checked-the-backup")) {
    console.error("Refusing to run: pass --i-have-checked-the-backup once you've verified backup/.");
    process.exit(1);
  }
  if (!existsSync(COUNTS_FILE)) {
    console.error(`Refusing to run: ${path.relative(process.cwd(), COUNTS_FILE)} is missing -- run scripts/export-db.ts first.`);
    process.exit(1);
  }
  assertModelListMatchesSchema();

  const backupCounts: Record<string, number> = JSON.parse(readFileSync(COUNTS_FILE, "utf8")).counts;
  const prisma = createScriptPrismaClient();
  try {
    const host = new URL(process.env.DATABASE_URL!).hostname;
    const live = await countRows(prisma);

    console.log(`\nAbout to DELETE ALL ROWS in the database at ${host}:\n`);
    console.log("  table               live rows   rows in backup");
    let drift = false;
    for (const [model, n] of Object.entries(live)) {
      const b = backupCounts[model];
      if (b !== n) drift = true;
      console.log(`  ${model.padEnd(18)} ${String(n).padStart(10)}   ${String(b ?? "?").padStart(14)}${b !== n ? "  <-- differs" : ""}`);
    }
    if (drift) {
      console.log("\nWARNING: live counts differ from the backup -- rows were added/removed since export-db ran.");
      console.log("Consider re-running `npx tsx scripts/export-db.ts` first.");
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("\nType WIPE to delete everything (anything else aborts): ");
    rl.close();
    if (answer.trim() !== "WIPE") {
      console.log("Aborted. Nothing was deleted.");
      return;
    }

    const deleted = await deleteAllRows(prisma);
    console.log("\nDeleted:");
    for (const [model, n] of Object.entries(deleted)) console.log(`  ${model}: ${n}`);
    const after = await countRows(prisma);
    console.log(`\nRows remaining: ${Object.values(after).reduce((a, b) => a + b, 0)}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log(`
Next: create the first admin account. scripts/seed-admin.js reads SITE_PASSWORD (required),
VISITOR_PASSWORD (optional) and ADMIN_USERNAME (optional, defaults to "admin") from .env.local:

  node scripts/seed-admin.js

(If your network blocks port 5432 locally, run it from a network that doesn't, or set the same
variables inline: SITE_PASSWORD=... ADMIN_USERNAME=... node scripts/seed-admin.js)
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
