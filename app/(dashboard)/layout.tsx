import Link from "next/link";
import { Suspense } from "react";
import { SignedOut } from "@neondatabase/auth/react/ui";
import { getCurrentAppUser } from "@/lib/auth/session";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { NavigationProgress } from "@/components/navigation-progress";
import { AppSidebar } from "./app-sidebar";

// Every route in this group reads the session (cookies) in this layout and
// scopes its data per-user/per-role — none can ever be static. Declaring it
// here stops `next build` from attempting a static prerender pass that is
// guaranteed to bail, which is what produced the noisy
// "[neon-auth] Cookie validation error … DYNAMIC_SERVER_USAGE" build logs.
// (Route segment config still applies here — Cache Components is disabled;
// see next.config.ts and CLAUDE.md.)
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAppUser();

  if (!user) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-6 py-3">
          <span className="font-semibold">Reader Management Dashboard</span>
          <SignedOut>
            <Link href="/auth/sign-in" prefetch={false} className="text-sm underline">
              Sign In
            </Link>
          </SignedOut>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <AppSidebar isAdmin={user.role === "admin"} userName={user.name} userEmail={user.email} />
      <SidebarInset>
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm text-muted-foreground">
            {user.role === "admin" ? "Administrator" : "AU POC"}
          </span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
