// components/calendar/WeekView.tsx
"use client";

import { useMemo } from "react";
import type { CalendarLeaveEvent } from "@/components/calendar/mockData";
import { toISODate } from "@/components/calendar/utils";

function fromISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// Monday-start week
function startOfWeekMonday(d: Date) {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day;
  return addDays(d, diff);
}

function fmtDayLabel(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
}

function isBetweenInclusive(targetISO: string, startISO: string, endISO: string) {
  const t = fromISODate(targetISO).getTime();
  const a = fromISODate(startISO).getTime();
  const b = fromISODate(endISO).getTime();
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return t >= min && t <= max;
}

function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "good" | "warn" | "bad" | "info";
  children: React.ReactNode;
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "info"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : "bg-neutral-100 text-neutral-700 border-neutral-200";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${cls}`}>
      {children}
    </span>
  );
}

function statusTone(s: CalendarLeaveEvent["status"]) {
  if (s === "APPROVED") return "good";
  if (s === "PENDING") return "warn";
  if (s === "REJECTED") return "bad";
  if (s === "CANCELLED") return "neutral";
  return "neutral";
}

export default function WeekView({
  events,
  anchorDateISO,
  onPrevWeek,
  onNextWeek,
  onToday,
}: {
  events: CalendarLeaveEvent[];
  anchorDateISO: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}) {
  const anchor = useMemo(() => fromISODate(anchorDateISO), [anchorDateISO]);
  const weekStart = useMemo(() => startOfWeekMonday(anchor), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);
  const dayISOs = useMemo(() => days.map((d) => toISODate(d)), [days]);

  // Rows grouped by employee+dept (team board style)
  const rows = useMemo(() => {
    const map = new Map<string, CalendarLeaveEvent[]>();
    for (const e of events) {
      const key = `${e.employeeName}__${e.department}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries())
      .map(([key, evs]) => ({ key, events: evs }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [events]);

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Week view</div>
          <div className="text-sm text-neutral-500 mt-1">
            {toISODate(weekStart)} → {toISODate(addDays(weekStart, 6))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
            onClick={onPrevWeek}
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
            onClick={onNextWeek}
          >
            Next
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-neutral-50 border-b">
        <div className="p-3 text-xs font-medium text-neutral-600">Employee</div>
        {days.map((d, idx) => {
          const iso = dayISOs[idx];
          const isAnchor = iso === anchorDateISO;
          return (
            <div key={iso} className="p-3 text-xs text-neutral-600">
              <div className="flex items-center justify-between">
                <span className={isAnchor ? "font-semibold text-neutral-900" : ""}>{fmtDayLabel(d)}</span>
                {isAnchor ? <Badge tone="info">Today</Badge> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rows */}
      <div className="divide-y">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">
            No leave events match the current filters for this week.
          </div>
        ) : (
          rows.map((r) => {
            const [employeeName, department] = r.key.split("__");
            return (
              <div key={r.key} className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))]">
                <div className="p-3">
                  <div className="text-sm font-medium">{employeeName}</div>
                  <div className="text-xs text-neutral-500 mt-1">{department}</div>
                </div>

                {dayISOs.map((iso) => {
                  const hits = r.events.filter((e) => isBetweenInclusive(iso, e.startDate, e.endDate));
                  return (
                    <div key={iso} className="p-2 border-l">
                      <div className="space-y-1">
                        {hits.slice(0, 2).map((e) => (
                          <div
                            key={e.id}
                            className="rounded-md border p-2 text-xs hover:bg-neutral-50 transition"
                            title={`${e.leaveType} • ${e.status}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{e.leaveType}</span>
                              <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                            </div>
                          </div>
                        ))}
                        {hits.length > 2 ? (
                          <div className="text-xs text-neutral-500">+{hits.length - 2} more</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
