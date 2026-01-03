// components/admin/tabs/CarryForwardTab.tsx
"use client";

import { useState } from "react";
import AdminModal from "../AdminModal";
import type { CarryForwardPolicy } from "../mockData";

function monthName(m: number) {
  const d = new Date(2026, (m || 1) - 1, 1);
  return d.toLocaleString(undefined, { month: "long" });
}

export default function CarryForwardTab({
  policy,
  setPolicy,
}: {
  policy: CarryForwardPolicy;
  setPolicy: (p: CarryForwardPolicy) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CarryForwardPolicy>(policy);

  function openEdit() {
    setDraft(policy);
    setOpen(true);
  }

  function save() {
    setPolicy(draft);
    setOpen(false);
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-4 border-b flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Carry-forward</div>
          <div className="text-sm text-neutral-500 mt-1">
            Configure how many days can be carried forward and the expiry window.
          </div>
        </div>

        <button
          className="rounded-md bg-neutral-900 text-white px-3 py-2 text-sm hover:bg-neutral-800"
          type="button"
          onClick={openEdit}
        >
          Edit settings
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="rounded-lg border p-4">
          <div className="font-medium">Current policy (mock)</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Max carry-forward days</span>
              <span className="font-semibold">{policy.maxDays}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Usable until</span>
              <span className="font-semibold">
                {monthName(policy.usableUntilMonth)} {policy.usableUntilDay}
              </span>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            This is applied during yearly reset: carry forward up to maxDays, and expire after the usableUntil date.
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="font-medium">User experience impact</div>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-neutral-700">
            <li>Smart Apply will consume carry-forward first (when within the window).</li>
            <li>Current-year entitlement resets on Jan 1.</li>
            <li>Carry-forward expires after the usable-until date.</li>
          </ul>
        </div>
      </div>

      <AdminModal
        open={open}
        title="Edit carry-forward policy"
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
            <label className="text-sm font-medium">Max carry-forward days</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              type="number"
              value={draft.maxDays}
              onChange={(e) => setDraft({ ...draft, maxDays: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Usable until month</label>
            <select
              className="w-full rounded-md border p-2 text-sm bg-white"
              value={draft.usableUntilMonth}
              onChange={(e) => setDraft({ ...draft, usableUntilMonth: Number(e.target.value) })}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {monthName(i + 1)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Usable until day</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              type="number"
              value={draft.usableUntilDay}
              onChange={(e) => setDraft({ ...draft, usableUntilDay: Number(e.target.value) })}
            />
          </div>

          <div className="md:col-span-2 text-xs text-neutral-500">
            Later: enforce valid month/day combinations (e.g., Feb 30 invalid) server-side.
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
