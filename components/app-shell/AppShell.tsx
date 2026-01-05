// components/app-shell/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  PlaneTakeoff,
  Inbox,
  Menu,
  ChevronDown,
  LogOut,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: "exact" | "prefix";
};

function isActive(pathname: string, href: string, match: "exact" | "prefix" = "exact") {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(href);
}

/**
 * Your DB roles:
 * - staff
 * - line_manager
 * - general_manager
 */
type DbRole = "staff" | "line_manager" | "general_manager" | string;

function normalizeRole(roleRaw: string | null | undefined): DbRole {
  return String(roleRaw ?? "staff").trim().toLowerCase();
}

function canSeeApprovals(role: DbRole) {
  return role === "line_manager" || role === "general_manager";
}

// You currently do not have an "admin" role in DB, so Admin is disabled for everyone.
// When you add it, update this function.
function canSeeAdmin(_role: DbRole) {
  return false;
}

function getNavItemsForRole(role: DbRole): NavItem[] {
  const base: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: "exact" },
    { href: "/calendar", label: "Calendar", icon: CalendarDays, match: "exact" },
    { href: "/leave/new", label: "Book Leave", icon: PlaneTakeoff, match: "prefix" },
  ];

  if (canSeeApprovals(role)) {
    base.push({ href: "/approvals", label: "Approvals", icon: Inbox, match: "exact" });
  }

  // Admin disabled for now (no admin role)
  if (canSeeAdmin(role)) {
    // base.push({ href: "/admin", label: "Admin", icon: Settings, match: "prefix" });
  }

  return base;
}

type ShellUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  contract_id: string | null;
  contract_name: string | null;
};

function initialsFrom(name: string | null, email: string | null) {
  const src = (name?.trim() || email?.trim() || "").toUpperCase();
  if (!src) return "U";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.slice(0, 2);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loadingMe, setLoadingMe] = useState(true);
  const [me, setMe] = useState<ShellUser | null>(null);

  // User menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close user menu on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Load current user + profile + contract
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      setLoadingMe(true);

      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;

      const user = data.user;
      if (error || !user) {
        setMe(null);
        setLoadingMe(false);
        router.replace("/test-auth");
        return;
      }

      // Join profile -> contracts(name)
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, contract_id, contracts(name)")
        .eq("id", user.id)
        .single();

      if (!alive) return;

      if (profileErr || !profile) {
        // fallback (still show email)
        setMe({
          id: user.id,
          email: user.email ?? null,
          full_name: null,
          role: null,
          contract_id: null,
          contract_name: null,
        });
        setLoadingMe(false);
        return;
      }

      const contractName = (profile as any)?.contracts?.name ?? null;

      setMe({
        id: user.id,
        email: user.email ?? null,
        full_name: (profile as any)?.full_name ?? null,
        role: (profile as any)?.role ?? null,
        contract_id: (profile as any)?.contract_id ?? null,
        contract_name: contractName,
      });

      setLoadingMe(false);
    }

    loadMe();
    return () => {
      alive = false;
    };
  }, [router]);

  const role = useMemo<DbRole>(() => normalizeRole(me?.role), [me?.role]);
  const roleNavItems = useMemo(() => getNavItemsForRole(role), [role]);

  // Client-side guard:
  // - staff cannot access /approvals
  // - admin is disabled for everyone (no admin role yet)
  useEffect(() => {
    if (!me) return;

    const tryingApprovals = pathname === "/approvals";
    const tryingAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

    if (tryingApprovals && !canSeeApprovals(role)) {
      router.replace("/dashboard");
      return;
    }

    if (tryingAdmin && !canSeeAdmin(role)) {
      router.replace("/dashboard");
      return;
    }
  }, [me, role, pathname, router]);

  const contractLabel = useMemo(() => {
    if (loadingMe) return "Loading...";
    return me?.contract_name ?? "No Contract";
  }, [loadingMe, me]);

  const displayName = useMemo(() => me?.full_name || me?.email || "User", [me]);
  const avatar = useMemo(() => initialsFrom(me?.full_name ?? null, me?.email ?? null), [me]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.replace("/test-auth");
    router.refresh();
  }

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <aside className="h-full border-r bg-white p-4">
      <div className="font-semibold text-lg">Leave Management</div>
      <p className="text-xs text-muted-foreground mt-1">Booking-style leave requests</p>

      <nav className="mt-6 space-y-1">
        {roleNavItems.map((item) => {
          const active = isActive(pathname, item.href, item.match);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={[
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-black/5",
              ].join(" ")}
            >
              <Icon className={["h-4 w-4", active ? "text-white" : "text-neutral-500"].join(" ")} />
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

      <div className="mx-auto flex min-h-screen">
        {/* Desktop sidebar */}
        <div className="hidden md:block w-64">
          <Sidebar />
        </div>

        {/* Content */}
        <div className="flex-1">
          <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  className="md:hidden border rounded-md p-2"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open navigation"
                >
                  <Menu className="h-4 w-4" />
                </button>

                <div className="text-sm text-muted-foreground">
                  Contract : <span className="font-semibold text-black">{contractLabel}</span>
                </div>
              </div>

              {/* User menu */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm hover:bg-neutral-50"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white text-xs font-semibold">
                    {avatar}
                  </div>
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="font-medium text-neutral-900">{displayName}</span>
                    <span className="text-xs text-neutral-500">{String(role).toUpperCase()}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-neutral-500" />
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-md border bg-white shadow-lg overflow-hidden"
                    role="menu"
                  >
                    <div className="px-3 py-2 border-b">
                      <div className="text-sm font-medium text-neutral-900 truncate">{displayName}</div>
                      {me?.email ? <div className="text-xs text-neutral-500 truncate">{me.email}</div> : null}
                    </div>

                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50 text-red-600"
                      onClick={handleSignOut}
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
