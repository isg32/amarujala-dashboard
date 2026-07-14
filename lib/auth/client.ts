import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react";

// @neondatabase/auth/next's createAuthClient() takes no arguments and
// always issues requests against a hardcoded same-origin "/api/auth/*" path
// — correct on Vercel (root-mounted), but wrong under the self-hosted
// /dashboard basePath deployment (see next.config.ts), where our actual
// route handler only exists at /dashboard/api/auth/*. Fell through as raw
// 404s on every getSession/sign-in XHR. The generic (non-Next) client takes
// an explicit base URL — building the exact same React-hooks adapter by
// hand here lets us prefix it with the basePath.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Better Auth appends API paths (e.g. /sign-in/email) directly to the
// baseURL. Our auth handler is at /api/auth/* (auto-prefixed by Next.js
// basePath when deployed), so the baseURL must include /api/auth.
const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";

export const authClient = createAuthClient(
  `${origin}${basePath}/api/auth`,
  { adapter: BetterAuthReactAdapter() },
);
