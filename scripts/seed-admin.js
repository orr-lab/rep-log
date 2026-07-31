// One-time, idempotent bootstrap script. Creates the admin User row from SITE_PASSWORD/
// VISITOR_PASSWORD (hashing them the same way src/lib/password-hash.ts does). Optional
// ADMIN_USERNAME env var sets the admin's username (defaults to "admin").
// Run with: node scripts/seed-admin.js
require("dotenv").config({ path: [".env.local", ".env"] });
const { randomBytes, scrypt } = require("node:crypto");
const { promisify } = require("node:util");
const { PrismaClient } = require("@prisma/client");

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

async function hashPassword(plain) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(plain, salt, KEY_LENGTH);
  return `${salt}:${derived.toString("hex")}`;
}

async function main() {
  const prisma = new PrismaClient();

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
