import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

const redirectUnauthenticated = auth.middleware({ loginUrl: "/auth/sign-in" });

// Only gate GET/HEAD (page navigations) so unauthenticated users get bounced
// to sign-in before seeing a protected page. POST requests are Server
// Actions / route handlers, which already call requireAdmin()/requireAppUser()
// themselves (lib/auth/session.ts) — that's the real authorization boundary,
// per Next.js's own guidance that Proxy/middleware is an optimistic check,
// not the enforcement point. Running the middleware's cookie-cache-based
// session revalidation against non-GET requests was observed to misfire
// (redirecting an authenticated Server Action submission), so we skip it here.
// /pay and /api/invoice are the only genuinely public, unauthenticated GET
// surfaces in the app — a reader opening a PayU payment link or an invoice
// link from SMS has no session at all. The txnId in the URL is their bearer
// credential (see lib/data/payments.ts), not a login.
const PUBLIC_PATHS = ["/pay", "/api/invoice"];

export default function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  return redirectUnauthenticated(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
