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

// Better Auth's client validates its base URL with `new URL(...)` at
// construction time, which requires an absolute URL — but this module gets
// evaluated during SSR too (window is undefined there), and a bare relative
// path throws immediately, breaking the whole build. This client is only
// ever actually used for real fetches once mounted in the browser (session
// hooks, sign-in submissions), so the dummy origin below is never hit — it
// only needs to make the constructor happy during server-side evaluation.
const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";

export const authClient = createAuthClient(`${origin}${basePath}`, { adapter: BetterAuthReactAdapter() });
