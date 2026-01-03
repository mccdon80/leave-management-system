// components/approvals/ApprovalInbox.tsx
"use client";

import ApprovalStatusBadge from "./ApprovalStatusBadge";
import type { ApprovalItem, ApprovalStatus } from "./mockData";

type Filters = {
  status: "ALL" | ApprovalStatus;
  query: string;
};

export default function ApprovalInbox({
  items,
  selectedTaskId,
  onSelect,
  onChangeFilters,
  filters,
}: {
  items: ApprovalItem[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  filters: Filters;
  onChangeFilters: (next: Filters) => void;
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-4 border-b space-y-3">
        <div>
          <div className="font-semibold">Approvals inbox</div>
          <div className="text-sm text-neutral-500 mt-1">
            Review pending requests and take action.
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Search</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              placeholder="Booking ref or employee..."
              value={filters.query}
              onChange={(e) => onChangeFilters({ ...filters, query: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Status</label>
            <select
              className="w-full rounded-md border p-2 text-sm bg-white"
              value={filters.status}
              onChange={(e) => onChangeFilters({ ...filters, status: e.target.value as any })}
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ESCALATED">Escalated</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
            onClick={() => onChangeFilters({ status: "ALL", query: "" })}
          >
            Reset
          </button>
          <div className="text-xs text-neutral-500">
            Approve/reject requires secure login (later enforced by auth).
          </div>
        </div>
      </div>

      <div className="divide-y">
        {items.map((it) => {
          const active = it.taskId === selectedTaskId;
          return (
            <button
              key={it.taskId}
              type="button"
              onClick={() => onSelect(it.taskId)}
              className={[
                "w-full text-left p-4 hover:bg-neutral-50 transition",
                active ? "bg-neutral-900 text-white hover:bg-neutral-900" : "bg-white",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={["font-mono text-sm font-semibold truncate", active ? "text-white" : "text-neutral-900"].join(" ")}>
                      {it.bookingRef}
                    </div>
                    {!active ? <ApprovalStatusBadge status={it.status} /> : null}
                  </div>

                  <div className={["mt-1 text-sm truncate", active ? "text-neutral-100" : "text-neutral-700"].join(" ")}>
                    {it.requesterName} • {it.requesterDepartment}
                  </div>

                  <div className={["mt-1 text-xs truncate", active ? "text-neutral-200" : "text-neutral-500"].join(" ")}>
                    {it.leaveType} • {it.startDate} → {it.endDate} • {it.workingDays} day(s)
                  </div>
                </div>

                <div className="text-right">
                  <div className={["text-xs", active ? "text-neutral-200" : "text-neutral-500"].join(" ")}>
                    Due by
                  </div>
                  <div className={["text-sm font-medium", active ? "text-white" : "text-neutral-900"].join(" ")}>
                    {it.dueBy}
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {items.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">
            No approvals match your filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
