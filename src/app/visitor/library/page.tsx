import { notFound } from "next/navigation";
import { getPublicAdminUserId } from "@/lib/public-scope";
import { PublicLibraryClient } from "@/components/visitor/public-library-client";

export const dynamic = "force-dynamic";

export default async function PublicLibraryPage() {
  const adminId = await getPublicAdminUserId();
  if (!adminId) notFound();

  return <PublicLibraryClient />;
}
