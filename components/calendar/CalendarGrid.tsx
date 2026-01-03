// components/calendar/CalendarGrid.tsx
"use client";

import type { CalendarLeaveEvent } from "./mockData";
import {
  buildDailyIndex,
  daysInMonth,
  formatMonthTitle,
  formatShortDayLabel,
  startOfMonth,
  toISODate,
} from "./utils";

function Chip({
  ev,
}: {
  ev: CalendarLeaveEvent;
}) {
  const tone =
    ev.status === "APPROVED"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : "bg-amber-50 text-amber-900 border-amber-200";

  return (
    <div className="relative group">
      <div
        className={[
          "truncate rounded-md border px-2 py-1 text-[11px] leading-4 cursor-default",
          tone,
        ].join(" ")}
        title={`${ev.employeeName} • ${ev.leaveType} • ${ev.status}\n${ev.startDate} → ${ev.endDate}`}
      >
        <span className="font-medium">{ev.employeeName}</span>{" "}
        <span className="opacity-80">• {ev.leaveType}</span>
      </div>

      {/* Hover card (pure CSS) */}
      <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition absolute z-20 left-0 top-full mt-2 w-64">
        <div className="rounded-lg border bg-white shadow-lg p-3">
          <div className="text-sm font-semibold">{ev.employeeName}</div>
          <div className="text-xs text-neutral-500 mt-1">
            {ev.department} • {ev.leaveType}
          </div>
          <div className="mt-2 text-xs">
            <span className="text-neutral-500">Status:</span>{" "}
            <span className="font-medium">{ev.status}</span>
          </div>
          <div className="mt-1 text-xs">
            <span className="text-neutral-500">Dates:</span>{" "}
            <span className="font-medium">
              {ev.startDate} → {ev.endDate}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-500">
            (Later: click opens Manage Booking)
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarGrid({
  year,
  monthIndex0,
  events,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  monthIndex0: number; // 0..11
  events: CalendarLeaveEvent[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const monthStart = startOfMonth(year, monthIndex0);
  const title = formatMonthTitle(year, monthIndex0);
  const totalDays = daysInMonth(year, monthIndex0);

  // In JS Date: Sunday=0..Saturday=6
  const firstDow = monthStart.getDay();
  const leadingEmpty = firstDow; // Sunday-first calendar

  const dailyIndex = buildDailyIndex(events);

  const cells: Array<{ kind: "empty" } | { kind: "day"; date: Date; iso: string }> = [];
  for (let i = 0; i < leadingEmpty; i++) cells.push({ kind: "empty" });

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, monthIndex0, day);
    cells.push({ kind: "day", date, iso: toISODate(date) });
  }

  const today = new Date();

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-4 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-neutral-500 mt-1">
            Month view (MVP). Hover an item for details.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
            onClick={onPrev}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
            onClick={onToday}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
            onClick={onNext}
          >
            Next
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 bg-neutral-50 border-b">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="p-2 text-xs font-medium text-neutral-500">
            {formatShortDayLabel(i)}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (cell.kind === "empty") {
            return <div key={idx} className="h-32 border-b border-r bg-white" />;
          }

          const dayNum = cell.date.getDate();
          const isToday =
            cell.date.getFullYear() === today.getFullYear() &&
            cell.date.getMonth() === today.getMonth() &&
            cell.date.getDate() === today.getDate();

          const dayEvents = dailyIndex.get(cell.iso) || [];
          const visible = dayEvents.slice(0, 3);
          const more = dayEvents.length - visible.length;

          return (
            <div key={idx} className="h-32 border-b border-r p-2 bg-white">
              <div className="flex items-center justify-between">
                <div
                  className={[
                    "text-xs font-medium",
                    isToday ? "text-white bg-neutral-900 rounded-full px-2 py-0.5" : "text-neutral-700",
                  ].join(" ")}
                >
                  {dayNum}
                </div>

                {dayEvents.length > 0 ? (
                  <div className="text-[11px] text-neutral-500">
                    {dayEvents.length} off
                  </div>
                ) : (
                  <div className="text-[11px] text-neutral-400">—</div>
                )}
              </div>

              <div className="mt-2 space-y-1">
                {visible.map((ev) => (
                  <Chip key={`${cell.iso}-${ev.id}`} ev={ev} />
                ))}
                {more > 0 ? (
                  <div className="text-[11px] text-neutral-500">+{more} more</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
