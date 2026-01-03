// components/approvals/ApproveRejectModal.tsx
"use client";

import { useEffect, useState } from "react";
import type { ApprovalItem } from "./mockData";

export default function ApproveRejectModal({
  open,
  mode,
  item,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mode: "APPROVE" | "REJECT";
  item: ApprovalItem | null;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) setNotes("");
  }, [open]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white shadow-xl">
        <div className="p-4 border-b">
          <div className="font-semibold">
            {mode === "APPROVE" ? "Approve request" : "Reject request"}
          </div>
          <div className="text-sm text-neutral-500 mt-1">
            {item.bookingRef} • {item.requesterName} • {item.leaveType}
          </div>
        </div>

        <div className="p-4 space-y-2">
          <label className="text-sm font-medium">Notes (optional)</label>
          <textarea
            className="w-full rounded-md border p-2 text-sm min-h-[100px]"
            placeholder={
              mode === "APPROVE"
                ? "Approval notes (optional)"
                : "Reason for rejection (recommended)"
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="text-xs text-neutral-500">
            Notes will appear in the request timeline and audit log.
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={[
              "rounded-md px-4 py-2 text-sm text-white",
              mode === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700",
            ].join(" ")}
            onClick={() => onConfirm(notes)}
          >
            {mode === "APPROVE" ? "Approve" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
