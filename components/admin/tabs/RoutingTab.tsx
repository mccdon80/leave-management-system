// components/admin/tabs/RoutingTab.tsx
"use client";

import { useState } from "react";
import AdminModal from "../AdminModal";
import type { ApprovalRouting } from "../mockData";

export default function RoutingTab({
  routing,
  setRouting,
}: {
  routing: ApprovalRouting;
  setRouting: (r: ApprovalRouting) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ApprovalRouting>(routing);

  function openEdit() {
    setDraft(routing);
    setOpen(true);
  }

  function save() {
    setRouting(draft);
    setOpen(false);
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-4 border-b flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Approval Routing</div>
          <div className="text-sm text-neutral-500 mt-1">
            Configure primary approvers and escalation SLA.
          </div>
        </div>

        <button
          className="rounded-md bg-neutral-900 text-white px-3 py-2 text-sm hover:bg-neutral-800"
          type="button"
          onClick={openEdit}
        >
          Edit routing
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-lg border p-4">
          <div className="font-medium">Current routing (mock)</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Line Manager</span>
              <span className="font-semibold">{routing.primaryLineManager}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">General Manager</span>
              <span className="font-semibold">{routing.generalManager}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Backup Approver</span>
              <span className="font-semibold">{routing.backupApprover}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Escalation SLA</span>
              <span className="font-semibold">{routing.escalationDays} days</span>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            SLA escalation: Staff request → GM after SLA; LM request → next assigned approver (backup).
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="font-medium">Approval experience</div>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-neutral-700">
            <li>Approver receives email with View / Approve / Reject actions.</li>
            <li>Approvals require secure login (app page with SLA countdown).</li>
            <li>Escalations generate an audit event and notification.</li>
          </ul>
        </div>
      </div>

      <AdminModal
        open={open}
        title="Edit approval routing"
        subtitle="Applies per contract."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800" onClick={save}>
              Save
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Primary Line Manager</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              value={draft.primaryLineManager}
              onChange={(e) => setDraft({ ...draft, primaryLineManager: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">General Manager</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              value={draft.generalManager}
              onChange={(e) => setDraft({ ...draft, generalManager: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Backup Approver</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              value={draft.backupApprover}
              onChange={(e) => setDraft({ ...draft, backupApprover: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Escalation SLA (days)</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              type="number"
              value={draft.escalationDays}
              onChange={(e) => setDraft({ ...draft, escalationDays: Number(e.target.value) })}
            />
          </div>

          <div className="md:col-span-2 text-xs text-neutral-500">
            Later: store approver IDs (UUIDs) and resolve display names from `profiles`.
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
