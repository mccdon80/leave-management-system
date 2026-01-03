// components/approvals/ApprovalDetails.tsx
"use client";

import type { ApprovalItem } from "./mockData";
import ApprovalStatusBadge from "./ApprovalStatusBadge";

function Tag({ text }: { text: string }) {
  return (
    <span className="inline-flex rounded-full px-2 py-1 text-xs bg-neutral-100 text-neutral-700">
      {text}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-900 text-right">{value}</span>
    </div>
  );
}

export default function ApprovalDetails({
  item,
  onApprove,
  onReject,
}: {
  item: ApprovalItem | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (!item) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="font-semibold">Select a request</div>
        <div className="text-sm text-neutral-500 mt-2">
          Choose an approval item from the left to view details and take action.
        </div>
      </div>
    );
  }

  const canAct = item.status === "PENDING" || item.status === "ESCALATED";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-sm font-semibold">{item.bookingRef}</div>
              <ApprovalStatusBadge status={item.status} />
            </div>
            <div className="mt-1 text-lg font-semibold">{item.requesterName}</div>
            <div className="text-sm text-neutral-500 mt-1">
              {item.requesterDepartment} • {item.leaveType}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tag text={`Fare: ${item.fareOption}`} />
            <Tag text={`${item.workingDays} day(s)`} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="font-semibold">Request summary</div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="font-medium">Itinerary</div>
            <div className="mt-2 space-y-2">
              <InfoRow label="Dates" value={`${item.startDate} → ${item.endDate}`} />
              <InfoRow label="Working days" value={item.workingDays} />
              <InfoRow label="Submitted" value={item.submittedAt} />
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="font-medium">Consumption</div>
            <div className="mt-2 space-y-2">
              <InfoRow label="Carry-forward" value={`${item.breakdown.carryForward} day(s)`} />
              <InfoRow label="Current-year" value={`${item.breakdown.currentYear} day(s)`} />
            </div>
          </div>

          <div className="rounded-lg border p-4 md:col-span-2">
            <div className="font-medium">SLA & escalation</div>
            <div className="mt-2 space-y-2">
              <InfoRow label="Due by" value={item.dueBy} />
              <InfoRow label="Escalates to" value={item.escalationTarget} />
              <div className="text-xs text-neutral-500">
                (Later: countdown timer + escalation event logging)
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="font-medium">Policy notes</div>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-neutral-700">
            {item.policyNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>

        <div className="border-t pt-3">
          <div className="font-medium">Team context (placeholder)</div>
          <div className="mt-2 text-sm text-neutral-500">
            We’ll show department calendar overlaps and “who else is off” here.
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Actions</div>
            <div className="text-sm text-neutral-500 mt-1">
              Approve or reject (requires secure login).
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
              disabled={!canAct}
              onClick={onReject}
            >
              Reject
            </button>
            <button
              type="button"
              className="rounded-md bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50"
              disabled={!canAct}
              onClick={onApprove}
            >
              Approve
            </button>
          </div>
        </div>

        {!canAct ? (
          <div className="mt-3 text-sm text-neutral-500">
            This request is already finalized.
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="font-semibold">Timeline (mock)</div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Submitted</span>
            <span className="font-medium">{item.submittedAt}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Due by</span>
            <span className="font-medium">{item.dueBy}</span>
          </div>
          <div className="text-xs text-neutral-500">
            (Later: Viewed / Reminder Sent / Escalated / Approved / Rejected events)
          </div>
        </div>
      </div>
    </div>
  );
}
