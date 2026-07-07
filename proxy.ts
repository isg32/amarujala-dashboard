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
export default function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }
  return redirectUnauthenticated(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
