import { notFound } from "next/navigation";
import { AccountView } from "@neondatabase/auth/react/ui";
import { accountViewPaths } from "@neondatabase/auth/react/ui/server";

// Deliberately dynamic, not statically generated (unlike app/auth/[path],
// which is public and the same for everyone) — every account page is
// per-signed-in-user, matching this app's rendering model (see CLAUDE.md).
export default async function AccountPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  if (!Object.values(accountViewPaths).includes(path as (typeof accountViewPaths)[keyof typeof accountViewPaths])) {
    notFound();
  }
  return <AccountView pathname={path} />;
}
