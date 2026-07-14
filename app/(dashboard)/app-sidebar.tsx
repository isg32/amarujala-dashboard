"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  BarChart3,
  Ticket,
  Receipt,
  Landmark,
  Building2,
  MapPinned,
  Map,
  UserCog,
  Tag,
  MessageSquareText,
  FlaskConical,
} from "lucide-react";
import { UserButton } from "@neondatabase/auth/react/ui";
import { ThemeToggle } from "./theme-toggle";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const MAIN_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/readers", label: "Readers", icon: Users },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const ADMIN_LINKS = [
  { href: "/coupons", label: "Coupons", icon: Ticket },
  { href: "/billing", label: "Billing", icon: Receipt },
];

const MASTER_DATA_LINKS = [
  { href: "/master-data/zones", label: "Zones", icon: Map },
  { href: "/master-data/units", label: "Units", icon: MapPinned },
  { href: "/master-data/cities", label: "Cities", icon: Building2 },
  { href: "/master-data/centers", label: "Centers", icon: Landmark },
  { href: "/master-data/pocs", label: "POCs", icon: UserCog },
  { href: "/master-data/pricing", label: "Pricing", icon: Tag },
  { href: "/master-data/sms-templates", label: "SMS Templates", icon: MessageSquareText },
  { href: "/master-data/diagnostics", label: "SMS & Payment Testing", icon: FlaskConical },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} render={<Link href={href} prefetch={false} />}>
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  isAdmin,
  userName,
  userEmail,
}: {
  isAdmin: boolean;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-3 py-4">
        <Link
          href="/"
          prefetch={false}
          className="flex items-center gap-2 px-1 font-semibold text-sidebar-foreground"
        >
          <Image
            src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/amar-ujala-logo.png`}
            alt="Amar Ujala"
            width={160}
            height={26}
            priority
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_LINKS.map((link) => (
                <NavLink
                  key={link.href}
                  {...link}
                  active={isActive(link.href)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_LINKS.map((link) => (
                  <NavLink
                    key={link.href}
                    {...link}
                    active={isActive(link.href)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Master Data</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {MASTER_DATA_LINKS.map((link) => (
                  <NavLink
                    key={link.href}
                    {...link}
                    active={isActive(link.href)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="gap-3 border-t border-sidebar-border p-3 pb-12">
        <div className="flex items-center justify-between gap-2 rounded-md bg-sidebar-accent p-2">
          <div className="min-w-0 max-w-sm">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
              {userName}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/70 overflow-x-hidden text-ellipsis">
              {userEmail}
            </p>
          </div>
          <UserButton size="icon" />
        </div>
        <div className="flex items-center justify-between px-1">
          <Link
            href="/account/settings"
            prefetch={false}
            className="text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            Settings
          </Link>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
