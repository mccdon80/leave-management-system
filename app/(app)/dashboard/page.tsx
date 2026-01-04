"use client";

// app/(app)/dashboard/page.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

import BalanceCards, { type BalanceCardItem } from "@/components/dashboard/BalanceCards";
import RequestsTable, { type RequestRow } from "@/components/dashboard/RequestsTable";
import WhosOffToday, { type OffPerson } from "@/components/dashboard/WhosOffToday";

type LeaveTypeRow = {
  code: string;
  name: string;
  default_days: number | null;
  active: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  department_id: string | null;
};

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfYearISO(year: number) {
  return `${year}-01-01`;
}

function endOfYearISO(year: number) {
  return `${year}-12-31`;
}

function mapDbStatusToBadge(db: string): RequestRow["status"] {
  const s = (db ?? "").toLowerCase();

  if (s === "draft") return "DRAFT";
  if (s === "approved") return "APPROVED";
  if (s === "rejected") return "REJECTED";
  if (s === "cancelled") return "CANCELLED";

  // submitted / pending_lm / pending_gm => pending
  return "PENDING";
}

function formatBookingRef(id: string, createdAt?: string | null) {
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  return `LV-${year}-${id.slice(-6).toUpperCase()}`;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<{ userId: string; profile: ProfileRow } | null>(null);

  const [balanceCards, setBalanceCards] = useState<BalanceCardItem[]>([]);
  const [recentRequests, setRecentRequests] = useState<RequestRow[]>([]);
  const [offToday, setOffToday] = useState<OffPerson[]>([]);

  const todayISO = useMemo(() => isoDate(new Date()), []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1) Must be signed in
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const userId = userData.user?.id;
        if (!userId) throw new Error("Not signed in");

        // 2) My profile (for department visibility)
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("id,full_name,email,department_id")
          .eq("id", userId)
          .single();

        if (profErr) throw profErr;

        const profile = prof as ProfileRow;
        setMe({ userId, profile });

        // 3) Load active leave types (for balances)
        const { data: types, error: typesErr } = await supabase
          .from("leave_types")
          .select("code,name,default_days,active")
          .eq("active", true)
          .order("name", { ascending: true });

        if (typesErr) throw typesErr;

        const leaveTypes = (types ?? []) as LeaveTypeRow[];

        // 4) Compute used days per leave type for current year (approved only)
        const year = new Date().getFullYear();
        const from = startOfYearISO(year);
        const to = endOfYearISO(year);

        const { data: usedRows, error: usedErr } = await supabase
          .from("leave_requests")
          .select("leave_type,days,status,start_date,end_date")
          .eq("requester_id", userId)
          .eq("status", "approved")
          .lte("start_date", to)
          .gte("end_date", from);

        if (usedErr) throw usedErr;

        const usedByType = new Map<string, number>();
        (usedRows ?? []).forEach((r: any) => {
          const code = String(r.leave_type);
          const days = Number(r.days ?? 0);
          usedByType.set(code, (usedByType.get(code) ?? 0) + days);
        });

        // Build balance cards (DB-driven)
        const cards: BalanceCardItem[] = leaveTypes.map((lt) => {
          const entitlement = lt.default_days; // can be null
          const used = usedByType.get(lt.code) ?? 0;

          const remaining =
            typeof entitlement === "number" && Number.isFinite(entitlement)
              ? Math.max(entitlement - used, 0)
              : null;

          return {
            code: lt.code,
            title: lt.name,
            value: remaining === null ? "—" : String(remaining),
            subtitle:
              remaining === null
                ? "No fixed entitlement"
                : `Entitled: ${entitlement} day(s) • Used: ${used.toFixed(2)}`,
            hint: `Based on approved leaves in ${year}.`,
          };
        });

        setBalanceCards(cards);

        // 5) Recent requests (DB-driven) – join leave type name and current approver
        const { data: reqRows, error: reqErr } = await supabase
          .from("leave_requests")
          .select(
            `
            id,
            created_at,
            leave_type,
            start_date,
            end_date,
            days,
            status,
            current_approver_id,
            lt:leave_types!leave_requests_leave_type_fkey(name,code),
            approver:profiles!leave_requests_current_approver_id_fkey(full_name,email)
          `
          )
          .eq("requester_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (reqErr) throw reqErr;

        const mappedRequests: RequestRow[] = (reqRows ?? []).map((r: any) => {
          const leaveTypeName = r?.lt?.name ?? r.leave_type;
          const badgeStatus = mapDbStatusToBadge(r.status);

          const approverName =
            r?.approver?.full_name?.trim() ||
            r?.approver?.email?.trim() ||
            (r.current_approver_id ? String(r.current_approver_id).slice(0, 8) : "—");

          return {
            id: String(r.id),
            bookingRef: formatBookingRef(String(r.id), r.created_at ?? null),
            leaveType: String(leaveTypeName),
            startDate: String(r.start_date),
            endDate: String(r.end_date),
            workingDays: Number(r.days ?? 0),
            status: badgeStatus,
            approver: badgeStatus === "DRAFT" ? "—" : approverName,
          };
        });

        setRecentRequests(mappedRequests);

        // 6) Who’s off today (same department) – approved + pending only
        if (profile.department_id) {
          const { data: offRows, error: offErr } = await supabase
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
            .eq("department_id", profile.department_id)
            .lte("start_date", todayISO)
            .gte("end_date", todayISO)
            .neq("status", "cancelled")
            .order("start_date", { ascending: true });

          if (offErr) throw offErr;

          const people: OffPerson[] = (offRows ?? [])
            .map((r: any) => {
              const s = (r.status ?? "").toLowerCase();
              const uiStatus: OffPerson["status"] =
                s === "approved" ? "APPROVED" : s.startsWith("pending") || s === "submitted" ? "PENDING" : "PENDING";

              // Skip drafts
              if (s === "draft") return null;

              const name =
                r?.requester?.full_name?.trim() ||
                r?.requester?.email?.trim() ||
                "Employee";

              const deptName = r?.dept?.name?.trim() || "Department";
              const leaveTypeName = r?.lt?.name?.trim() || r.leave_type;

              return {
                name,
                department: deptName,
                leaveType: leaveTypeName,
                status: uiStatus,
              } satisfies OffPerson;
            })
            .filter(Boolean) as OffPerson[];

          setOffToday(people);
        } else {
          setOffToday([]);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load dashboard");
        setBalanceCards([]);
        setRecentRequests([]);
        setOffToday([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [todayISO]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            View balances, recent requests, and team availability.
          </p>
          {me?.profile?.full_name ? (
            <div className="text-xs text-neutral-500 mt-1">
              Signed in as <span className="font-medium">{me.profile.full_name}</span>
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

      {/* Balance cards */}
      <BalanceCards items={balanceCards} loading={loading} />

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <RequestsTable rows={recentRequests} loading={loading} />
        <div className="space-y-4">
          <WhosOffToday items={offToday} loading={loading} />

          <div className="rounded-xl border bg-white p-4">
            <div className="font-semibold">Quick tips</div>
            <ul className="mt-2 text-sm text-neutral-700 list-disc pl-5 space-y-1">
              <li>
                Use <span className="font-medium">Smart Apply</span> to consume buckets intelligently.
              </li>
              <li>Check the calendar before booking to avoid team conflicts.</li>
              <li>Pending approvals can escalate after 7 days (policy).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
