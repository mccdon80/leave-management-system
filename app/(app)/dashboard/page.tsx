"use client";

// app/(app)/dashboard/page.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

import BalanceCards, { type BalanceCardItem } from "@/components/dashboard/BalanceCards";
import RequestsTable, { type RequestRow } from "@/components/dashboard/RequestsTable";
import WhosOffToday, { type OffPerson } from "@/components/dashboard/WhosOffToday";

type Role = "staff" | "line_manager" | "general_manager" | "admin";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  department_id: string | null;
  grade_level?: number | null;
};

type PolicyRow = {
  policy_year: number;
  year_end_date: string; // date
  carry_forward_limit: number;
  carry_forward_expiry: string; // date
  annual_entitlement: number;
};

type BalanceRow = {
  user_id: string;
  policy_year: number;
  entitlement: number;
  used: number; // numeric(6,2)
  carried_forward: number;
  carried_forward_used: number;
};

type LeaveTypeRow = {
  code: string;
  name: string;
  default_days: number | null;
  active: boolean;
};

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mapDbStatusToBadge(db: string): RequestRow["status"] {
  const s = (db ?? "").toLowerCase();
  if (s === "draft") return "DRAFT";
  if (s === "approved") return "APPROVED";
  if (s === "rejected") return "REJECTED";
  if (s === "cancelled") return "CANCELLED";
  return "PENDING"; // submitted/pending_lm/pending_gm
}

function bookingRef(id: string, createdAt?: string | null) {
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  return `LV-${year}-${id.slice(-6).toUpperCase()}`;
}

function canSeeDepartment(role: Role) {
  return role === "line_manager" || role === "general_manager" || role === "admin";
}

function canSeeAll(role: Role) {
  return role === "general_manager" || role === "admin";
}

function computeAnnualEntitlementFromGrade(grade?: number | null) {
  if (grade == null || !Number.isFinite(grade)) return null;
  if (grade >= 1 && grade <= 15) return 22;
  if (grade >= 16) return 33;
  return null;
}

export default function DashboardPage() {
  const todayISO = useMemo(() => isoDate(new Date()), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [policy, setPolicy] = useState<PolicyRow | null>(null);

  const [balanceCards, setBalanceCards] = useState<BalanceCardItem[]>([]);
  const [recentRequests, setRecentRequests] = useState<RequestRow[]>([]);
  const [offToday, setOffToday] = useState<OffPerson[]>([]);
  const [offNote, setOffNote] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      setOffNote(null);

      try {
        // 1) Must be signed in
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const userId = userData.user?.id;
        if (!userId) throw new Error("Not signed in");

        const year = new Date().getFullYear();
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;

        // 2) My profile (include grade_level)
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("id,full_name,email,role,department_id,grade_level")
          .eq("id", userId)
          .single();

        if (profErr) throw profErr;
        const me = prof as ProfileRow;
        setProfile(me);

        // 3) Policy (optional; for expiry/limit display)
        const { data: pol, error: polErr } = await supabase
          .from("leave_policies")
          .select("policy_year,year_end_date,carry_forward_limit,carry_forward_expiry,annual_entitlement")
          .eq("policy_year", year)
          .maybeSingle();

        const polRow = (!polErr && pol ? (pol as PolicyRow) : null);
        setPolicy(polRow);

        // 4) Leave balances (for carry-forward cards + also useful for UI consistency)
        const { data: bal, error: balErr } = await supabase
          .from("leave_balances")
          .select("user_id,policy_year,entitlement,used,carried_forward,carried_forward_used")
          .eq("user_id", userId)
          .eq("policy_year", year)
          .maybeSingle();

        if (balErr) throw balErr;
        const b = (bal ?? null) as BalanceRow | null;

        // 5) Load leave types (per-type cards)
        const { data: ltRows, error: ltErr } = await supabase
          .from("leave_types")
          .select("code,name,default_days,active")
          .eq("active", true)
          .order("name", { ascending: true });

        if (ltErr) throw ltErr;
        const leaveTypes = (ltRows ?? []) as LeaveTypeRow[];

        // 6) Sum APPROVED leave usage per type for this user within this year
        const { data: approvedRows, error: apprErr } = await supabase
          .from("leave_requests")
          .select("leave_type,days,start_date,end_date,status")
          .eq("requester_id", userId)
          .eq("status", "approved")
          .gte("start_date", yearStart)
          .lte("end_date", yearEnd);

        if (apprErr) throw apprErr;

        const usedByType = new Map<string, number>();
        for (const r of approvedRows ?? []) {
          const code = String((r as any).leave_type ?? "").toUpperCase();
          const days = Number((r as any).days ?? 0);
          if (!code) continue;
          usedByType.set(code, (usedByType.get(code) ?? 0) + (Number.isFinite(days) ? days : 0));
        }

        // 7) Build cards per leave type
        const gradeAnnual = computeAnnualEntitlementFromGrade(me.grade_level);
        const policyAnnualFallback = polRow?.annual_entitlement ?? null;

        const typeCards: BalanceCardItem[] = leaveTypes.map((lt) => {
          const code = String(lt.code).toUpperCase();

          // Entitlement rules:
          // - Annual: grade rule (22/33), fallback to policy annual_entitlement, fallback to leave_types.default_days, else 0
          // - Others: leave_types.default_days (if null -> 0)
          let entitlement = 0;
          if (code === "ANNUAL") {
            entitlement =
              gradeAnnual ??
              policyAnnualFallback ??
              (typeof lt.default_days === "number" ? lt.default_days : 0);
          } else {
            entitlement = typeof lt.default_days === "number" ? lt.default_days : 0;
          }

          const used = usedByType.get(code) ?? 0;
          const remaining = Math.max(entitlement - used, 0);

          const hintParts: string[] = [];
          if (code === "ANNUAL") {
            if (me.grade_level != null) hintParts.push(`Grade: ${me.grade_level}`);
            if (gradeAnnual != null) hintParts.push(`Rule: ${gradeAnnual} days`);
            else if (policyAnnualFallback != null) hintParts.push(`Policy: ${policyAnnualFallback} days`);
          }

          return {
            code,
            title: lt.name,
            value: `${remaining}`,
            subtitle: `Entitled: ${entitlement} • Used: ${used.toFixed(2)}`,
            hint: hintParts.length ? hintParts.join(" • ") : undefined,
          };
        });

        // 8) Carry-forward cards (separate)
        const cf = Number(b?.carried_forward ?? 0);
        const cfUsed = Number(b?.carried_forward_used ?? 0);
        const cfRemaining = Math.max(cf - cfUsed, 0);

        const carryCards: BalanceCardItem[] = [
          {
            code: "CARRY_FORWARD_REMAINING",
            title: "Carry-forward remaining",
            value: `${cfRemaining}`,
            subtitle: `Carried: ${cf.toFixed(2)} • Used: ${cfUsed.toFixed(2)}`,
            hint: polRow?.carry_forward_expiry
              ? `Expires: ${polRow.carry_forward_expiry}`
              : "Expiry configured in leave_policies",
          },
          {
            code: "CARRY_FORWARD_EXPIRY",
            title: "Carry-forward expiry",
            value: polRow?.carry_forward_expiry ?? "—",
            subtitle:
              polRow?.carry_forward_limit != null
                ? `Max carry-forward: ${polRow.carry_forward_limit} day(s)`
                : "No policy configured",
            hint: "Configured in leave_policies",
          },
        ];

        setBalanceCards([...typeCards, ...carryCards]);

        // 9) Recent requests (my own)
        const { data: reqRows, error: reqErr } = await supabase
          .from("leave_requests")
          .select(
            `
            id,
            created_at,
            start_date,
            end_date,
            days,
            status,
            leave_type,
            lt:leave_types!leave_requests_leave_type_fkey(name,code),
            current_approver_id
          `
          )
          .eq("requester_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (reqErr) throw reqErr;

        const mappedReq: RequestRow[] = (reqRows ?? []).map((r: any) => {
          const leaveTypeName = r?.lt?.name ?? r.leave_type;
          const badgeStatus = mapDbStatusToBadge(r.status);

          const approver =
            badgeStatus === "DRAFT" ? "—" : badgeStatus === "PENDING" ? "Pending approval" : "—";

          return {
            id: String(r.id),
            bookingRef: bookingRef(String(r.id), r.created_at ?? null),
            leaveType: String(leaveTypeName),
            startDate: String(r.start_date),
            endDate: String(r.end_date),
            workingDays: Number(r.days ?? 0),
            status: badgeStatus,
            approver,
          };
        });

        setRecentRequests(mappedReq);

        // 10) Who’s off today (RLS-aware)
        const role = me.role;

        if (!canSeeDepartment(role)) {
          // Staff: only show themselves (if off today)
          const { data: mineToday, error: mineErr } = await supabase
            .from("leave_requests")
            .select(
              `
              id,
              start_date,
              end_date,
              status,
              leave_type,
              lt:leave_types!leave_requests_leave_type_fkey(name,code)
            `
            )
            .eq("requester_id", userId)
            .lte("start_date", todayISO)
            .gte("end_date", todayISO)
            .neq("status", "cancelled")
            .order("start_date", { ascending: true });

          if (mineErr) throw mineErr;

          const itemsOff: OffPerson[] = (mineToday ?? [])
            .map((r: any) => {
              const s = String(r.status ?? "").toLowerCase();
              if (s === "draft") return null;

              const uiStatus: OffPerson["status"] = s === "approved" ? "APPROVED" : "PENDING";
              const ltName = r?.lt?.name ?? r.leave_type;

              return {
                name: me.full_name?.trim() || me.email?.trim() || "You",
                department: "My department",
                leaveType: String(ltName),
                status: uiStatus,
              } satisfies OffPerson;
            })
            .filter(Boolean) as OffPerson[];

          setOffToday(itemsOff);

          if (itemsOff.length === 0) {
            setOffNote("Department view is available for Line Managers / GM / Admin.");
          }
        } else {
          // LM => department. GM/Admin => all
          if (!me.department_id && !canSeeAll(role)) {
            setOffToday([]);
            setOffNote("No department assigned to your profile.");
          } else {
            let q = supabase
              .from("leave_requests")
              .select(
                `
                id,
                start_date,
                end_date,
                status,
                leave_type,
                department_id,
                requester:profiles!leave_requests_requester_id_fkey(full_name,email),
                lt:leave_types!leave_requests_leave_type_fkey(name,code),
                dept:departments!leave_requests_department_id_fkey(name)
              `
              )
              .lte("start_date", todayISO)
              .gte("end_date", todayISO)
              .neq("status", "cancelled")
              .order("start_date", { ascending: true });

            if (!canSeeAll(role)) {
              q = q.eq("department_id", me.department_id);
            }

            const { data: offRows, error: offErr } = await q;
            if (offErr) throw offErr;

            const itemsOff: OffPerson[] = (offRows ?? [])
              .map((r: any) => {
                const s = String(r.status ?? "").toLowerCase();
                if (s === "draft") return null;

                const uiStatus: OffPerson["status"] = s === "approved" ? "APPROVED" : "PENDING";
                const name =
                  r?.requester?.full_name?.trim() || r?.requester?.email?.trim() || "Employee";
                const deptName = r?.dept?.name?.trim() || "Department";
                const ltName = r?.lt?.name?.trim() || r.leave_type;

                return {
                  name,
                  department: deptName,
                  leaveType: String(ltName),
                  status: uiStatus,
                } satisfies OffPerson;
              })
              .filter(Boolean) as OffPerson[];

            setOffToday(itemsOff);
            setOffNote(null);
          }
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load dashboard");
        setBalanceCards([]);
        setRecentRequests([]);
        setOffToday([]);
        setOffNote(null);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Balances, recent requests, and availability (database + RLS).
          </p>
          {profile?.full_name ? (
            <div className="text-xs text-neutral-500 mt-1">
              Signed in as <span className="font-medium">{profile.full_name}</span> • Role:{" "}
              <span className="font-medium">{profile.role}</span>
              {profile.grade_level != null ? (
                <>
                  {" "}
                  • Grade: <span className="font-medium">{profile.grade_level}</span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/calendar"
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            View calendar
          </Link>
          <Link
            href="/leave/new"
            className="inline-flex items-center rounded-md bg-neutral-900 text-white px-3 py-2 text-sm hover:bg-neutral-800"
          >
            Book leave
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Balance cards (PER LEAVE TYPE + Carry Forward) */}
      <BalanceCards items={balanceCards} loading={loading} />

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <RequestsTable rows={recentRequests} loading={loading} />

        <div className="space-y-4">
          {offNote ? (
            <div className="rounded-xl border bg-white p-3 text-xs text-neutral-600">{offNote}</div>
          ) : null}

          <WhosOffToday items={offToday} loading={loading} />
        </div>
      </div>
    </div>
  );
}
