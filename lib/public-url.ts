import "server-only";
import { headers } from "next/headers";

// Next's basePath handling (see next.config.ts) covers next/link, useRouter(),
// and redirect()/NextResponse.redirect() automatically — but NOT hand-built
// absolute URLs handed to external systems (SMS text, PayU surl/furl). Those
// must go through here instead of concatenating headers()/origin with a bare
// path, or they silently 404 through nginx on the self-hosted /dashboard
// deployment.
export async function publicUrl(path: string) {
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${origin}${basePath}${path}`;
}
