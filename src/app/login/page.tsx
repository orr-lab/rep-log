import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { getPublicAdminUserId } from "@/lib/public-scope";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const publicProfileAvailable = (await getPublicAdminUserId()) !== null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Suspense>
        <LoginForm publicProfileAvailable={publicProfileAvailable} />
      </Suspense>
    </div>
  );
}
