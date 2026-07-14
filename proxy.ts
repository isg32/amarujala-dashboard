import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

// @neondatabase/auth's own middleware builds its login-page redirect via
// `new URL(loginUrl, request.url)`. loginUrl ("/auth/sign-in") must stay
// basePath-less for the library's OWN "is this already the sign-in page"
// check to keep matching Next's already-basePath-stripped
// request.nextUrl.pathname — but because it's root-relative, WHATWG URL
// resolution then throws away request.url's /dashboard prefix when building
// the actual redirect Location, always producing bare "/auth/sign-in"
// regardless of basePath (confirmed by reading the library's source). Only
// fixable by patching the Location header after the library builds its
// response.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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

export default async function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const response = await redirectUnauthenticated(request);

  if (BASE_PATH) {
    const location = response.headers.get("location");
    if (location) {
      const url = new URL(location, request.url);
      if (!url.pathname.startsWith(BASE_PATH)) {
        url.pathname = `${BASE_PATH}${url.pathname}`;
        response.headers.set("location", url.toString());
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
