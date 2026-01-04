// app/(app)/approvals/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ApprovalInbox from "@/components/approvals/ApprovalInbox";
import ApprovalDetails from "@/components/approvals/ApprovalDetails";
import ApproveRejectModal from "@/components/approvals/ApproveRejectModal";
import type { ApprovalItem, ApprovalStatus, LeaveType } from "@/components/approvals/mockData";
import { supabase } from "@/lib/supabase/client";

type Role = "staff" | "line_manager" | "general_manager" | "admin";

const SLA_DAYS = 7;

function toISODateTimeDisplay(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function addDaysISO(iso?: string | null, days = 7) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatBookingRef(id: string, createdAt?: string | null) {
  // lightweight ref: LV-YYYY-<last6>
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  return `LV-${year}-${id.slice(-6).toUpperCase()}`;
}

function mapDbLeaveTypeToUi(code: string): LeaveType {
  const c = (code ?? "").toLowerCase();
  if (c === "sick") return "Sick";
  // UI currently only supports Annual | Birthday | Sick
  // Map others to Annual for now
  return "Annual";
}

function computeUiStatus(dbStatus: string, assignedAtIso?: string | null): ApprovalStatus {
  const s = (dbStatus ?? "").toLowerCase();
  if (s === "approved") return "APPROVED";
  if (s === "rejected") return "REJECTED";

  // Pending statuses -> PENDING or ESCALATED (visual only)
  if (s.startsWith("pending")) {
    if (assignedAtIso) {
      const due = addDaysISO(assignedAtIso, SLA_DAYS);
      if (due) {
        const dueMs = new Date(due).getTime();
        if (!Number.isNaN(dueMs) && Date.now() > dueMs) return "ESCALATED";
      }
    }
    return "PENDING";
  }

  // Ignore drafts/cancelled in inbox views typically; but if they show, treat as PENDING
  return "PENDING";
}

type DbLeaveRow = {
  id: string;
  requester_id: string;
  department_id: string | null;

  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;

  status: string;

  submitted_at: string | null;
  assigned_at: string | null;
  created_at: string | null;

  current_approver_id: string | null;
  decided_by: string | null;

  requester?: { full_name: string | null; email: string | null } | null;
  dept?: { name: string | null } | null;
};

export default function ApprovalsPage() {
  const [me, setMe] = useState<{ userId: string; role: Role } | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [filters, setFilters] = useState<{ status: "ALL" | any; query: string }>({
    status: "ALL",
    query: "",
  });

  const [modal, setModal] = useState<{
    open: boolean;
    mode: "APPROVE" | "REJECT";
  }>({ open: false, mode: "APPROVE" });

  const [data, setData] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();

    return data.filter((it) => {
      if (filters.status !== "ALL" && it.status !== filters.status) return false;

      if (
        q &&
        !(
          it.bookingRef.toLowerCase().includes(q) ||
          it.requesterName.toLowerCase().includes(q)
        )
      )
        return false;

      return true;
    });
  }, [data, filters]);

  const selectedItem = useMemo(
    () => data.find((x) => x.taskId === selectedTaskId) ?? null,
    [data, selectedTaskId]
  );

  function openApprove() {
    setModal({ open: true, mode: "APPROVE" });
  }

  function openReject() {
    setModal({ open: true, mode: "REJECT" });
  }

  function closeModal() {
    setModal((m) => ({ ...m, open: false }));
  }

  async function loadMe() {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;

    const userId = userData.user?.id;
    if (!userId) {
      setMe(null);
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", userId)
      .single();

    if (profErr) throw profErr;

    setMe({ userId: prof.id as string, role: prof.role as Role });
  }

  async function loadApprovals() {
    setLoading(true);
    setPageError(null);

    try {
      await loadMe();

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        setData([]);
        setSelectedTaskId(null);
        setPageError("You are not signed in.");
        return;
      }

      // Inbox strategy:
      // - show anything assigned to me (current_approver_id = me)
      // - plus my recent decisions (decided_by = me) so filters can show Approved/Rejected
      //
      // Admin could see more later; keep simple for now.
      const { data: rows, error } = await supabase
        .from("leave_requests")
        .select(
          `
          id,
          requester_id,
          department_id,
          leave_type,
          start_date,
          end_date,
          days,
          status,
          submitted_at,
          assigned_at,
          created_at,
          current_approver_id,
          decided_by,
          requester:profiles!leave_requests_requester_id_fkey(full_name,email),
          dept:departments!leave_requests_department_id_fkey(name)
        `
        )
        // Only relevant statuses for approvals UI
        .in("status", ["pending_lm", "pending_gm", "approved", "rejected"])
        // Use OR filter so we get assigned + history
        .or(`current_approver_id.eq.${userId},decided_by.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const mapped: ApprovalItem[] = (rows ?? []).map((r: any) => {
        const row = r as DbLeaveRow;

        const requesterName =
          row.requester?.full_name?.trim() ||
          row.requester?.email?.trim() ||
          row.requester_id.slice(0, 8);

        const requesterDepartment = row.dept?.name?.trim() || "Department";

        const submittedAt = toISODateTimeDisplay(row.submitted_at ?? row.created_at);
        const dueISO = addDaysISO(row.assigned_at ?? row.submitted_at ?? row.created_at, SLA_DAYS);
        const dueBy = dueISO ? toISODateTimeDisplay(dueISO) : "-";

        const uiStatus = computeUiStatus(row.status, row.assigned_at);

        // Escalation target (UI placeholder)
        const escalationTarget =
          row.status === "pending_lm" ? "General Manager" : "Assigned Approver";

        return {
          taskId: row.id,          // task == request id in our DB
          requestId: row.id,
          bookingRef: formatBookingRef(row.id, row.created_at),

          requesterName,
          requesterDepartment,

          leaveType: mapDbLeaveTypeToUi(row.leave_type),
          startDate: row.start_date,
          endDate: row.end_date,
          workingDays: Number(row.days ?? 0),

          status: uiStatus,

          submittedAt,
          dueBy,
          escalationTarget,

          // Not implemented yet (balance engine). Keep placeholders so UI stays consistent.
          fareOption: "SMART",
          breakdown: { carryForward: 0, currentYear: Number(row.days ?? 0) },

          policyNotes: [
            row.status.startsWith("pending")
              ? "Pending decision (RLS-enforced)."
              : "Finalized.",
          ],
        } satisfies ApprovalItem;
      });

      setData(mapped);

      // auto-select first pending item if nothing selected
      const preferred =
        mapped.find((x) => x.status === "PENDING" || x.status === "ESCALATED")?.taskId ??
        mapped[0]?.taskId ??
        null;

      setSelectedTaskId((prev) => prev ?? preferred);
    } catch (e: any) {
      setPageError(e?.message ?? "Failed to load approvals.");
      setData([]);
      setSelectedTaskId(null);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDecision(notes: string) {
    if (!selectedItem) return;

    try {
      setPageError(null);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const decision = modal.mode === "APPROVE" ? "approved" : "rejected";
      const nowIso = new Date().toISOString();

      // 1) Insert audit row (leave_approvals)
      const { error: insErr } = await supabase.from("leave_approvals").insert({
        leave_request_id: selectedItem.requestId,
        approver_id: userId,
        decision,
        comment: notes?.trim()?.length ? notes.trim() : null,
      });

      if (insErr) throw insErr;

      // 2) Update leave request (finalize)
      const { error: updErr } = await supabase
        .from("leave_requests")
        .update({
          status: decision,
          decided_at: nowIso,
          decided_by: userId,
          current_approver_id: null,
          assigned_at: null,
        })
        .eq("id", selectedItem.requestId);

      if (updErr) throw updErr;

      closeModal();

      // Refresh list from DB to keep it truthful
      await loadApprovals();
    } catch (e: any) {
      setPageError(e?.message ?? "Failed to apply decision.");
    }
  }

  useEffect(() => {
    loadApprovals();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadApprovals();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Requests assigned to you (RLS enforced) + your recent decisions.
        </p>

        {loading ? (
          <div className="mt-3 text-sm text-neutral-500">Loading approvals…</div>
        ) : null}

        {pageError ? (
          <div className="mt-3 text-sm text-red-600">{pageError}</div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <ApprovalInbox
          items={filtered}
          selectedTaskId={selectedTaskId}
          onSelect={setSelectedTaskId}
          filters={filters}
          onChangeFilters={setFilters}
        />

        <ApprovalDetails item={selectedItem} onApprove={openApprove} onReject={openReject} />
      </div>

      <ApproveRejectModal
        open={modal.open}
        mode={modal.mode}
        item={selectedItem}
        onClose={closeModal}
        onConfirm={confirmDecision}
      />
    </div>
  );
}
