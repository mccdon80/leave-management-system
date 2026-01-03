
"use client";

type Status = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export default function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    DRAFT: "bg-neutral-100 text-neutral-700 border-neutral-200",
    PENDING: "bg-amber-50 text-amber-900 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-900 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
    CANCELLED: "bg-neutral-100 text-neutral-500 border-neutral-200",
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
