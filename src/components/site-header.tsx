"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dumbbell, LogOut, LogIn, Plus, Settings } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/library", label: "Library" },
  { href: "/stats", label: "Stats" },
  { href: "/records", label: "Records" },
];

// Authenticated-only (owner + visitor) -- there's no public /visitor/plan mirror, since planning
// is part of the authenticated visitor-password flow, not the fully public no-login surface.
const AUTHENTICATED_ONLY_NAV_LINKS = [{ href: "/plan", label: "Plan" }];

export function SiteHeader({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const isOwner = role === "owner";
  const isPublicView = pathname.startsWith("/visitor");

  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  const homeHref = isPublicView ? "/visitor" : "/";
  const navLinks = isPublicView
    ? NAV_LINKS.map((link) => ({ ...link, href: `/visitor${link.href === "/" ? "" : link.href}` }))
    : [...NAV_LINKS, ...AUTHENTICATED_ONLY_NAV_LINKS];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href={homeHref} className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Dumbbell className="size-5" />
          </span>
          <span>Rep Log</span>
          {role === "visitor" && !isPublicView && (
            <Badge variant="secondary" className="font-normal">
              Visitor
            </Badge>
          )}
          {isPublicView && (
            <Badge variant="secondary" className="font-normal">
              Public view
            </Badge>
          )}
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                pathname === link.href && "bg-secondary text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {isOwner && (
            <>
              <Link
                href="/new"
                className={buttonVariants({ size: "sm", className: "hidden sm:inline-flex" })}
              >
                <Plus className="size-4" />
                Log a set
              </Link>
              <Link
                href="/new"
                aria-label="Log a set"
                className={buttonVariants({ size: "icon", variant: "secondary", className: "sm:hidden" })}
              >
                <Plus className="size-4" />
              </Link>
              <Link
                href="/settings"
                aria-label="Settings"
                className={buttonVariants({ size: "icon", variant: "ghost" })}
              >
                <Settings className="size-4" />
              </Link>
            </>
          )}
          <ThemeToggle />
          {isPublicView ? (
            <Link href="/login" aria-label="Log in" className={buttonVariants({ variant: "ghost", size: "icon" })}>
              <LogIn className="size-4" />
            </Link>
          ) : (
            <Button variant="ghost" size="icon" aria-label="Log out" onClick={handleLogout}>
              <LogOut className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-4 py-1.5 sm:hidden">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              pathname === link.href && "bg-secondary text-foreground"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
