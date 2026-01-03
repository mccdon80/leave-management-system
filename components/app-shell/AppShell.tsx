"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  PlaneTakeoff,
  Inbox,
  Settings,
  Menu,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: "exact" | "prefix";
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: "exact",
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    match: "exact",
  },
  {
    href: "/leave/new",
    label: "Book Leave",
    icon: PlaneTakeoff,
    match: "prefix",
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: Inbox,
    match: "exact",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Settings,
    match: "prefix",
  },
];

function isActive(
  pathname: string,
  href: string,
  match: "exact" | "prefix" = "exact"
) {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(href);
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <aside className="h-full border-r bg-white p-4">
      <div className="font-semibold text-lg">Leave Management</div>
      <p className="text-xs text-muted-foreground mt-1">
        Booking-style leave requests
      </p>

      <nav className="mt-6 space-y-1">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href, item.match);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={[
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-700 hover:bg-black/5",
              ].join(" ")}
            >
              <Icon
                className={[
                  "h-4 w-4",
                  active ? "text-white" : "text-neutral-500",
                ].join(" ")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-[320px] bg-white shadow-xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-h-screen md:grid md:grid-cols-[260px_1fr]">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        <div className="flex flex-col">
          {/* Topbar */}
          <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden border rounded-md p-2"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="text-sm text-muted-foreground">
                Contract{" "}
                <span className="font-medium text-black">
                  Demo Contract
                </span>
              </div>
            </div>

            <div className="text-sm">
              <span className="text-muted-foreground">Signed in as</span>{" "}
              <span className="font-medium">User</span>
            </div>
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
