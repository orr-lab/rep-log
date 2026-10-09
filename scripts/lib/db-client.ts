// PrismaClient factory for the maintenance scripts. Remote (Neon) databases go through the Neon
// driver adapter over WebSockets on port 443 -- some networks block outbound 5432, which is what
// the plain Prisma engine needs. A localhost DATABASE_URL uses the normal engine.
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

export function createScriptPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const host = new URL(connectionString).hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return new PrismaClient({ datasourceUrl: connectionString });
  }
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}
