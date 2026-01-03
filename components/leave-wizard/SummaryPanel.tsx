"use client";

export type WizardState = {
  contractName?: string;

  leaveTypeCode?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;

  workingDays?: number;

  // balances (mock for UI)
  currentYearRemaining?: number;
  carryForwardRemaining?: number;
  withinCarryWindow?: boolean;

  selectedOption?: "SMART" | "CURRENT_ONLY" | "CARRY_ONLY";
  breakdown?: { carryForward: number; currentYear: number };

  warnings?: string[];
  blocks?: string[];

  bookingRef?: string;
  status?: "DRAFT" | "PENDING";

  attachments?: {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}[];

};

function pill(text: string, tone: "ok" | "warn" | "danger" = "ok") {
  const cls =
    tone === "ok"
      ? "bg-neutral-100 text-neutral-700"
      : tone === "warn"
      ? "bg-amber-50 text-amber-800 border border-amber-200"
      : "bg-red-50 text-red-700 border border-red-200";

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs ${cls}`}>{text}</span>;
}

export default function SummaryPanel({ state }: { state: WizardState }) {
  const hasDates = !!state.startDate && !!state.endDate;

  return (
    <aside className="border rounded-lg bg-white p-4 sticky top-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-neutral-500">Trip summary</div>
          <div className="font-semibold">Your leave itinerary</div>
        </div>
        {state.selectedOption ? pill(state.selectedOption.replace("_", " "), "ok") : pill("Not selected")}
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Contract</span>
          <span className="font-medium">{state.contractName || "Demo Contract"}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Leave type</span>
          <span className="font-medium">{state.leaveTypeCode || "—"}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Dates</span>
          <span className="font-medium">
            {hasDates ? `${state.startDate} → ${state.endDate}` : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Working days</span>
          <span className="font-medium">{state.workingDays ?? "—"}</span>
        </div>

        <div className="border-t pt-3">
          <div className="font-medium">Balances (mock)</div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Current-year</span>
              <span className="font-medium">{state.currentYearRemaining ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Carry-forward</span>
              <span className="font-medium">{state.carryForwardRemaining ?? "—"}</span>
            </div>
            {state.withinCarryWindow === false ? (
              <div className="text-xs text-neutral-500">
                Carry-forward usable window is closed (after Mar 31).
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="font-medium">Consumption breakdown</div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">From carry-forward</span>
              <span className="font-medium">{state.breakdown?.carryForward ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">From current-year</span>
              <span className="font-medium">{state.breakdown?.currentYear ?? "—"}</span>
            </div>
          </div>
        </div>

        {(state.blocks?.length || state.warnings?.length) ? (
          <div className="border-t pt-3 space-y-2">
            <div className="font-medium">Policy messages</div>

            {state.blocks?.map((b, i) => (
              <div key={`b-${i}`} className="text-xs rounded-md p-2 bg-red-50 text-red-700 border border-red-200">
                {b}
              </div>
            ))}

            {state.warnings?.map((w, i) => (
              <div key={`w-${i}`} className="text-xs rounded-md p-2 bg-amber-50 text-amber-800 border border-amber-200">
                {w}
              </div>
            ))}
          </div>
        ) : null}

        {state.bookingRef ? (
          <div className="border-t pt-3">
            <div className="font-medium">Booking reference</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-neutral-500">Ref</span>
              <span className="font-mono font-semibold">{state.bookingRef}</span>
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              Status: <span className="font-medium text-neutral-900">{state.status || "—"}</span>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
