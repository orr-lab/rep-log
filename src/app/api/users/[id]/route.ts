import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { deleteUserCascade, CannotDeleteAdminError, UserNotFoundError } from "@/lib/users";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!(session?.isAdmin && session.role === "owner")) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const { id } = await params;
  try {
    await deleteUserCascade(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof CannotDeleteAdminError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
