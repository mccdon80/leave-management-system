// components/calendar/WhosOffSidebar.tsx
"use client";

import type { CalendarLeaveEvent } from "./mockData";
import { fromISODate, isWithinRange, toISODate } from "./utils";

function Badge({ text, tone }: { text: string; tone: "approved" | "pending" }) {
  const cls =
    tone === "approved"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : "bg-amber-50 text-amber-900 border-amber-200";

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs border ${cls}`}>
      {text}
    </span>
  );
}

function listItem(ev: CalendarLeaveEvent) {
  return (
    <div key={ev.id} className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{ev.employeeName}</div>
        <div className="text-xs text-neutral-500 truncate">
          {ev.department} • {ev.leaveType} • {ev.startDate} → {ev.endDate}
        </div>
      </div>
      <Badge text={ev.status} tone={ev.status === "APPROVED" ? "approved" : "pending"} />
    </div>
  );
}

export default function WhosOffSidebar({
  events,
  selectedDateISO,
}: {
  events: CalendarLeaveEvent[];
  selectedDateISO: string; // YYYY-MM-DD
}) {
  const selectedDate = fromISODate(selectedDateISO);

  const offThatDay = events.filter((ev) => {
    const s = fromISODate(ev.startDate);
    const e = fromISODate(ev.endDate);
    return isWithinRange(selectedDate, s, e);
  });

  const todayISO = toISODate(new Date());
  const todayList = events.filter((ev) => {
    const t = fromISODate(todayISO);
    const s = fromISODate(ev.startDate);
    const e = fromISODate(ev.endDate);
    return isWithinRange(t, s, e);
  });

  const upcoming = events
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 6);

  return (
    <aside className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="font-semibold">Who’s off (selected day)</div>
        <div className="text-sm text-neutral-500 mt-1">{selectedDateISO}</div>

        <div className="mt-4 space-y-3">
          {offThatDay.length ? offThatDay.map(listItem) : (
            <div className="text-sm text-neutral-500">No leave entries for this day.</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="font-semibold">Who’s off today</div>
        <div className="text-sm text-neutral-500 mt-1">{todayISO}</div>

        <div className="mt-4 space-y-3">
          {todayList.length ? todayList.map(listItem) : (
            <div className="text-sm text-neutral-500">No one is off today.</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="font-semibold">Upcoming (sample)</div>
        <div className="text-sm text-neutral-500 mt-1">
          Next requests starting soon.
        </div>

        <div className="mt-4 space-y-3">
          {upcoming.length ? upcoming.map(listItem) : (
            <div className="text-sm text-neutral-500">No upcoming requests.</div>
          )}
        </div>
      </div>
    </aside>
  );
}
