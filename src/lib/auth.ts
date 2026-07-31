export const SESSION_COOKIE = "replog_session";

export type Role = "owner" | "visitor";

export interface SessionPayload {
  userId: string;
  role: Role;
  isAdmin: boolean;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + padding);
}

/**
 * The session cookie must stay verifiable in middleware, which runs on the Edge runtime (no
 * node:crypto) — so signing uses Web Crypto HMAC, keyed off SITE_PASSWORD. This means
 * SITE_PASSWORD must stay set even after accounts move into the database (see README):
 * it no longer gates login directly, but it's still the session-signing secret.
 */
async function getSigningKey(): Promise<CryptoKey> {
  const secretHex = await sha256Hex(`replog-session-key:${process.env.SITE_PASSWORD ?? ""}`);
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(secretHex),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(payloadJson: string): Promise<string> {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadJson));
  return bytesToHex(new Uint8Array(signature));
}

async function verify(payloadJson: string, signatureHex: string): Promise<boolean> {
  const key = await getSigningKey();
  return crypto.subtle.verify(
    "HMAC",
    key,
    hexToBytes(signatureHex),
    new TextEncoder().encode(payloadJson)
  );
}

export async function createSessionCookieValue(payload: SessionPayload): Promise<string> {
  const payloadJson = JSON.stringify(payload);
  const signatureHex = await sign(payloadJson);
  return `${base64UrlEncode(payloadJson)}.${signatureHex}`;
}

export async function verifySessionCookie(
  value: string | undefined
): Promise<SessionPayload | null> {
  if (!value) return null;
  const separatorIndex = value.indexOf(".");
  if (separatorIndex === -1) return null;

  const payloadEncoded = value.slice(0, separatorIndex);
  const signatureHex = value.slice(separatorIndex + 1);

  let payloadJson: string;
  try {
    payloadJson = base64UrlDecode(payloadEncoded);
  } catch {
    return null;
  }

  if (!(await verify(payloadJson, signatureHex))) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Partial<SessionPayload>).userId !== "string" ||
    ((parsed as Partial<SessionPayload>).role !== "owner" &&
      (parsed as Partial<SessionPayload>).role !== "visitor") ||
    typeof (parsed as Partial<SessionPayload>).isAdmin !== "boolean"
  ) {
    return null;
  }

  return parsed as SessionPayload;
}
