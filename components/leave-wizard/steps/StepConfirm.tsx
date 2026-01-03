"use client";

import type { WizardState } from "../SummaryPanel";

export default function StepConfirm({ state }: { state: WizardState }) {
  return (
    <div className="border rounded-lg bg-white p-4 space-y-3">
      <div>
        <div className="font-semibold">Request submitted</div>
        <div className="text-sm text-neutral-500 mt-1">
          Your booking has been created and is pending approval.
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <div className="text-sm text-neutral-500">Booking reference</div>
        <div className="mt-1 font-mono text-lg font-semibold">
          {state.bookingRef || "LV-YYYY-XXXXXX"}
        </div>
        <div className="mt-2 text-sm">
          Status: <span className="font-medium">{state.status || "PENDING"}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="border rounded-md px-3 py-2 text-sm hover:bg-neutral-50"
          onClick={() => alert("Later: navigate to /leave/[id]")}
        >
          View request
        </button>
        <button
          type="button"
          className="border rounded-md px-3 py-2 text-sm hover:bg-neutral-50"
          onClick={() => alert("Later: cancel request")}
        >
          Cancel request
        </button>
      </div>
    </div>
  );
}
