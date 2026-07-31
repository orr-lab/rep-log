import Link from "next/link";
import type { ComponentType } from "react";
import { buttonVariants } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {actionHref && actionLabel && (
        <Link href={actionHref} className={buttonVariants({ size: "sm", className: "mt-2" })}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
