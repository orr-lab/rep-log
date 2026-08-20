import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getPublicAdminUserId } from "@/lib/public-scope";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in -- middleware happily lets a valid session sit on /login (it's on the
  // always-allowed list so /api/login itself is reachable), but there's no reason to show the
  // form to someone who doesn't need it.
  if (await getSession()) redirect("/");

  const publicProfileAvailable = (await getPublicAdminUserId()) !== null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Suspense>
        <LoginForm publicProfileAvailable={publicProfileAvailable} />
      </Suspense>
    </div>
  );
}
