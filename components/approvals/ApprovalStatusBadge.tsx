// components/approvals/ApprovalStatusBadge.tsx
"use client";

import type { ApprovalStatus } from "./mockData";

export default function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const styles: Record<ApprovalStatus, string> = {
    PENDING: "bg-amber-50 text-amber-900 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-900 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
    ESCALATED: "bg-violet-50 text-violet-900 border-violet-200",
  };

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium",
        styles[status],
      ].join(" ")}
    >
      {status}
    </span>
  );
}
