// One-time, idempotent bootstrap script. Creates the admin User row from SITE_PASSWORD/
// VISITOR_PASSWORD (hashing them the same way src/lib/password-hash.ts does). Optional
// ADMIN_USERNAME env var sets the admin's username (defaults to "admin").
// Run with: node scripts/seed-admin.js
require("dotenv").config({ path: [".env.local", ".env"] });
const { randomBytes, scrypt } = require("node:crypto");
const { promisify } = require("node:util");
const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

async function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(plain, salt, KEY_LENGTH);
  return `${salt}:${derived.toString("hex")}`;
}

// Remote (Neon) databases go over WebSockets on port 443 via the Neon driver adapter -- some
// networks block outbound 5432, which the plain engine needs. Localhost uses the normal engine.
function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set.");
  const { hostname } = new URL(url);
  if (hostname === "localhost" || hostname === "127.0.0.1") return new PrismaClient();
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
}

async function main() {
  const prisma = createPrismaClient();

  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    throw new Error("SITE_PASSWORD must be set to seed the admin account.");
  }

  const existing = await prisma.user.findFirst({ where: { isAdmin: true }, select: { id: true } });

  if (existing) {
    console.log(`Admin user already exists: ${existing.id} (skipping creation)`);
    await prisma.$disconnect();
    return;
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const passwordHash = await hashPassword(sitePassword);
  const visitorPasswordHash = process.env.VISITOR_PASSWORD
    ? await hashPassword(process.env.VISITOR_PASSWORD)
    : null;

  const admin = await prisma.user.create({
    data: { username, isAdmin: true, passwordHash, visitorPasswordHash },
    select: { id: true, username: true },
  });
  console.log(`Created admin user ${admin.id} (username: ${admin.username})`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
