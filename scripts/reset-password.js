// Break-glass password reset for when you're locked out of your own account. Requires direct
// DATABASE_URL access (from .env.local for local dev, or a production DATABASE_URL pulled/pasted
// in for prod) -- there is no API route or web-reachable path for this at all, on purpose: it
// can't be triggered from the hosted website by anyone, only by someone who already holds your
// database credentials.
//
// Run with: node scripts/reset-password.js <username> <newPassword>
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

// Mirrors the complexity rule in src/lib/validation.ts's passwordSchema.
function passwordError(password) {
  if (password.length < 8) return "Password must be at least 8 characters long";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must include a number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a symbol (e.g. ! @ # $ %)";
  return null;
}

async function main() {
  const [username, newPassword] = process.argv.slice(2);
  if (!username || !newPassword) {
    console.error("Usage: node scripts/reset-password.js <username> <newPassword>");
    process.exit(1);
  }

  const error = passwordError(newPassword);
  if (error) {
    console.error(`Rejected: ${error}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();

  const user = await prisma.user.findUnique({ where: { username }, select: { id: true, isAdmin: true } });
  if (!user) {
    console.error(`No user found with username "${username}".`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  console.log(`Password reset for "${username}"${user.isAdmin ? " (admin)" : ""}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
