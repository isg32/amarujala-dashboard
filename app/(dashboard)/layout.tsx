import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@neondatabase/auth/react/ui";
import { getCurrentAppUser } from "@/lib/auth/session";

const MASTER_DATA_LINKS = [
  { href: "/master-data/zones", label: "Zones" },
  { href: "/master-data/units", label: "Units" },
  { href: "/master-data/cities", label: "Cities" },
  { href: "/master-data/centers", label: "Centers" },
  { href: "/master-data/pocs", label: "POCs" },
  { href: "/master-data/pricing", label: "Pricing" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAppUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/dashboard" className="font-semibold">
          Reader Management Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <SignedOut>
            <Link href="/auth/sign-in" className="text-sm underline">
              Sign In
            </Link>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </header>
      {user && (
        <nav className="flex gap-4 border-b px-6 py-2 text-sm">
          <Link href="/readers" className="text-muted-foreground hover:text-foreground">
            Readers
          </Link>
          <Link href="/attendance" className="text-muted-foreground hover:text-foreground">
            Attendance
          </Link>
          <Link href="/payments" className="text-muted-foreground hover:text-foreground">
            Payments
          </Link>
          <Link href="/reports" className="text-muted-foreground hover:text-foreground">
            Reports
          </Link>
          {user.role === "admin" && (
            <Link href="/coupons" className="text-muted-foreground hover:text-foreground">
              Coupons
            </Link>
          )}
          {user.role === "admin" && (
            <Link href="/billing" className="text-muted-foreground hover:text-foreground">
              Billing
            </Link>
          )}
          {user.role === "admin" &&
            MASTER_DATA_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
                {link.label}
              </Link>
            ))}
        </nav>
      )}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
