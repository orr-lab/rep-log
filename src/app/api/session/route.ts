import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isClimbingModeEnabled } from "@/lib/users";

export async function GET() {
  const session = await getSession();
  const climbingMode = session ? await isClimbingModeEnabled(session.userId) : false;
  return NextResponse.json({
    role: session?.role ?? null,
    isAdmin: session?.isAdmin ?? false,
    climbingMode,
  });
}
