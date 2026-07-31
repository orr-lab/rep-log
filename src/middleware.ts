import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/auth";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};

const OWNER_ONLY_PAGE_PATTERNS = [
  /^\/new$/,
  /^\/entries\/[^/]+\/edit$/,
  /^\/settings$/,
];

// Deliberately excludes /api/users/me/* — every owner (admin or not) manages their own
// password/visitor password there, not just the admin.
const ADMIN_ONLY_API_PATTERNS = [
  /^\/api\/users$/,
  /^\/api\/users\/[^/]+$/,
  /^\/api\/users\/(?!me\/)[^/]+\/password$/,
];

// The public, no-login "visitor profile" — gated behind the admin's Settings toggle, checked
// fresh on every request by getPublicAdminUserId() inside each of these pages/routes. Middleware
// only decides these paths don't need a session; it never decides whether content is actually
// available (it can't — Prisma needs the Node runtime, middleware runs on Edge). GET only: any
// other method against these exact paths is rejected outright, on top of the route files simply
// not exporting POST/PUT/DELETE handlers at all.
const PUBLIC_PATH_PATTERNS = [
  /^\/visitor$/,
  /^\/visitor\/library$/,
  /^\/visitor\/exercise$/,
  /^\/visitor\/entries\/[^/]+$/,
  /^\/visitor\/stats$/,
  /^\/visitor\/records$/,
  /^\/api\/public\/entries$/,
  /^\/api\/public\/facets$/,
];

// Visitors are otherwise blocked from every mutating API call (see the role check below) — this
// is the one deliberate exception: a visitor-password holder may leave a comment on an entry.
// Deleting a comment stays owner-only (not listed here), enforced by this same role check.
const VISITOR_ALLOWED_MUTATION_PATTERNS = [/^\/api\/entries\/[^/]+\/comments$/];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  if (PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    if (request.method !== "GET") {
      return NextResponse.json({ error: "Not allowed." }, { status: 405 });
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionCookie(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { role, isAdmin } = session;
  const isMutatingApiCall = pathname.startsWith("/api/") && request.method !== "GET";
  const isOwnerOnlyPage = OWNER_ONLY_PAGE_PATTERNS.some((pattern) => pattern.test(pathname));
  const isVisitorAllowedMutation =
    request.method === "POST" &&
    VISITOR_ALLOWED_MUTATION_PATTERNS.some((pattern) => pattern.test(pathname));

  if (role !== "owner" && (isMutatingApiCall || isOwnerOnlyPage) && !isVisitorAllowedMutation) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Visitors can't make changes." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  const isAdminOnlyApiCall = ADMIN_ONLY_API_PATTERNS.some((pattern) => pattern.test(pathname));
  if (isAdminOnlyApiCall && !(isAdmin && role === "owner")) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  return NextResponse.next();
}
