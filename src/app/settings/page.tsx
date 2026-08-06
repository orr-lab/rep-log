import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listUsers } from "@/lib/users";
import { getExerciseCategories } from "@/lib/data";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { VisitorPasswordForm } from "@/components/settings/visitor-password-form";
import { UserManagementPanel } from "@/components/settings/user-management-panel";
import { PublicProfileToggle } from "@/components/settings/public-profile-toggle";
import { VideoUploadToggle } from "@/components/settings/video-upload-toggle";
import { MaxUploadSizeInput } from "@/components/settings/max-upload-size-input";
import { ClimbingModeToggle } from "@/components/settings/climbing-mode-toggle";
import { ExercisePresetsPanel } from "@/components/settings/exercise-presets-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "owner") redirect("/");

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      username: true,
      visitorPasswordHash: true,
      publicProfileEnabled: true,
      videoUploadsEnabled: true,
      maxUploadMB: true,
      climbingMode: true,
    },
  });
  if (!me) redirect("/login");

  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  const users = session.isAdmin
    ? (await listUsers()).map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))
    : [];

  const exerciseCategories = await getExerciseCategories(session.userId);

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{me.username}</span>. Manage
          your account{session.isAdmin ? " and other users" : ""}.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your password</h2>
        <ChangePasswordForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Visitor access</h2>
        <p className="text-sm text-muted-foreground">
          Give someone read-only access to just your log with a separate password.
        </p>
        <VisitorPasswordForm hasVisitorPassword={me.visitorPasswordHash !== null} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Training style</h2>
        <ClimbingModeToggle initialEnabled={me.climbingMode} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Exercise presets</h2>
        <ExercisePresetsPanel
          initialCategories={exerciseCategories}
          climbingMode={me.climbingMode}
        />
      </section>

      {session.isAdmin && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Public view</h2>
          <p className="text-sm text-muted-foreground">
            Let anyone browse your log read-only without signing in.
          </p>
          <PublicProfileToggle initialEnabled={me.publicProfileEnabled} origin={origin} />
        </section>
      )}

      {session.isAdmin && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Storage</h2>
          <VideoUploadToggle initialEnabled={me.videoUploadsEnabled} />
          <MaxUploadSizeInput initialMaxUploadMB={me.maxUploadMB} />
        </section>
      )}

      {session.isAdmin && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Users</h2>
          <UserManagementPanel initialUsers={users} />
        </section>
      )}
    </div>
  );
}
