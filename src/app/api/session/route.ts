import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ role: session?.role ?? null, isAdmin: session?.isAdmin ?? false });
}
