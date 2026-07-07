import Link from "next/link";
import { SignedOut } from "@neondatabase/auth/react/ui";
import { getCurrentAppUser } from "@/lib/auth/session";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "./app-sidebar";

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
            <Link href="/auth/sign-in" className="text-sm underline">
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
