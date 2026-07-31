import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const separatorIndex = stored.indexOf(":");
  if (separatorIndex === -1) return false;

  const salt = stored.slice(0, separatorIndex);
  const hashHex = stored.slice(separatorIndex + 1);
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
