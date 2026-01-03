// app/(app)/approvals/page.tsx
"use client";

import { useMemo, useState } from "react";
import ApprovalInbox from "@/components/approvals/ApprovalInbox";
import ApprovalDetails from "@/components/approvals/ApprovalDetails";
import ApproveRejectModal from "@/components/approvals/ApproveRejectModal";
import { MOCK_APPROVALS, type ApprovalItem } from "@/components/approvals/mockData";

export default function ApprovalsPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    MOCK_APPROVALS.find((x) => x.status === "PENDING")?.taskId ?? MOCK_APPROVALS[0]?.taskId ?? null
  );

  const [filters, setFilters] = useState<{ status: "ALL" | any; query: string }>({
    status: "ALL",
    query: "",
  });

  const [modal, setModal] = useState<{
    open: boolean;
    mode: "APPROVE" | "REJECT";
  }>({ open: false, mode: "APPROVE" });

  const [data, setData] = useState<ApprovalItem[]>(MOCK_APPROVALS);

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

  function confirmDecision(notes: string) {
    if (!selectedItem) return;

    setData((prev) =>
      prev.map((x) => {
        if (x.taskId !== selectedItem.taskId) return x;
        return {
          ...x,
          status: modal.mode === "APPROVE" ? "APPROVED" : "REJECTED",
          policyNotes:
            notes.trim().length > 0
              ? [...x.policyNotes, `${modal.mode === "APPROVE" ? "Approval" : "Rejection"} notes: ${notes}`]
              : x.policyNotes,
        };
      })
    );

    closeModal();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Inbox-style approvals with SLA and escalation context (UI-first mock).
        </p>
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
