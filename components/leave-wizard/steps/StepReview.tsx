"use client";

import { useMemo } from "react";
import type { WizardState } from "../SummaryPanel";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fromISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function isSameISO(a: string, b: string) {
  return a === b;
}

function isBetweenInclusive(iso: string, startISO: string, endISO: string) {
  const d = fromISODate(iso).getTime();
  const s = fromISODate(startISO).getTime();
  const e = fromISODate(endISO).getTime();
  return d >= Math.min(s, e) && d <= Math.max(s, e);
}

function dayNameShort(dow: number) {
  // 0=Sun..6=Sat
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow] ?? "";
}

function monthName(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "info" | "good";
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
      : tone === "info"
      ? "bg-blue-50 text-blue-900 border border-blue-200"
      : "bg-neutral-100 text-neutral-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${cls}`}>
      {children}
    </span>
  );
}

type CalendarCell = {
  iso: string;
  day: number;
  inMonth: boolean;
};

function buildMonthGrid(anchor: Date) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);

  // We want a Sunday-start grid (Sun..Sat).
  const startDow = monthStart.getDay(); // 0=Sun..6=Sat
  const gridStart = addDays(monthStart, -startDow);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const iso = toISODate(d);
    const inMonth = d >= monthStart && d <= monthEnd;
    cells.push({ iso, day: d.getDate(), inMonth });
  }

  return {
    title: monthName(anchor),
    monthStartISO: toISODate(monthStart),
    monthEndISO: toISODate(monthEnd),
    cells,
  };
}

function MiniCalendarPreview({
  startDate,
  endDate,
}: {
  startDate?: string;
  endDate?: string;
}) {
  const anchor = useMemo(() => {
    if (startDate) return fromISODate(startDate);
    return new Date();
  }, [startDate]);

  const grid = useMemo(() => buildMonthGrid(anchor), [anchor]);

  const hasRange = Boolean(startDate && endDate);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Mini calendar preview</div>
          <div className="text-sm text-neutral-500 mt-1">
            Visual check of your leave dates (month view).
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {hasRange ? (
            <>
              <Tag tone="info">{startDate} → {endDate}</Tag>
              <Tag tone="good">Selected range</Tag>
            </>
          ) : (
            <Tag>Pick dates to preview</Tag>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm font-semibold">{grid.title}</div>
        <div className="text-xs text-neutral-500">
          Sun–Sat
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="text-[11px] text-neutral-500 text-center py-1">
            {dayNameShort(i)}
          </div>
        ))}

        {grid.cells.map((c) => {
          const selected =
            hasRange && startDate && endDate
              ? isBetweenInclusive(c.iso, startDate, endDate)
              : false;

          const isStart = hasRange && startDate ? isSameISO(c.iso, startDate) : false;
          const isEnd = hasRange && endDate ? isSameISO(c.iso, endDate) : false;

          const base =
            "h-9 rounded-md flex items-center justify-center text-sm border transition";

          const muted = !c.inMonth
            ? "text-neutral-300 border-transparent"
            : "text-neutral-800 border-neutral-200";

          const selectedCls = selected
            ? "bg-neutral-900 text-white border-neutral-900"
            : "bg-white";

          const edgeCls =
            (isStart || isEnd) && selected
              ? "ring-2 ring-neutral-900 ring-offset-2"
              : "";

          return (
            <div
              key={c.iso}
              className={[base, muted, selectedCls, edgeCls].join(" ")}
              title={c.iso}
            >
              {c.day}
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        MVP preview uses a simple month grid. Later we will overlay department leave conflicts + holidays.
      </div>
    </div>
  );
}

export default function StepReview({ state }: { state: WizardState }) {
  const breakdown = state.breakdown;

  return (
    <div className="border rounded-lg bg-white p-4 space-y-4">
      <div>
        <div className="font-semibold">Review your booking</div>
        <div className="text-sm text-neutral-500 mt-1">
          Confirm itinerary, consumption, and approval route.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="border rounded-lg p-4">
          <div className="font-medium">Itinerary</div>
          <div className="mt-2 text-sm space-y-1">
            <div>
              <span className="text-neutral-500">Type:</span>{" "}
              <span className="font-medium">{state.leaveTypeCode || "—"}</span>
            </div>
            <div>
              <span className="text-neutral-500">Dates:</span>{" "}
              <span className="font-medium">
                {state.startDate || "—"} → {state.endDate || "—"}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Working days:</span>{" "}
              <span className="font-medium">{state.workingDays ?? "—"}</span>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="font-medium">Consumption</div>
          <div className="mt-2 text-sm space-y-1">
            <div>
              <span className="text-neutral-500">Option:</span>{" "}
              <span className="font-medium">{state.selectedOption || "—"}</span>
            </div>
            <div>
              <span className="text-neutral-500">Carry-forward:</span>{" "}
              <span className="font-medium">{breakdown?.carryForward ?? "—"}</span>
            </div>
            <div>
              <span className="text-neutral-500">Current-year:</span>{" "}
              <span className="font-medium">{breakdown?.currentYear ?? "—"}</span>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4 md:col-span-2">
          <div className="font-medium">Approval chain (mock)</div>
          <div className="mt-2 text-sm text-neutral-700 space-y-1">
            <div>Approver 1: Line Manager</div>
            <div>Escalation: General Manager after 7 days</div>
            <div className="text-neutral-500 text-xs">
              (We will calculate this based on role + routing rules from DB later.)
            </div>
          </div>
        </div>

        {/* ✅ Replaced placeholder with working mini calendar */}
        <div className="md:col-span-2">
          <MiniCalendarPreview startDate={state.startDate} endDate={state.endDate} />
        </div>
      </div>
    </div>
  );
}
