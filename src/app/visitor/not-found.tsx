import { EyeOff } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function VisitorNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <EmptyState
        icon={EyeOff}
        title="This profile isn't public right now"
        description="The owner hasn't made this training log publicly viewable. If you have an account, you can log in instead."
        actionHref="/login"
        actionLabel="Log in"
      />
    </div>
  );
}
