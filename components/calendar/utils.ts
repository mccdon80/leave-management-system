// components/calendar/utils.ts
import type { CalendarLeaveEvent } from "./mockData";

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromISODate(s: string) {
  // Safe parse: YYYY-MM-DD -> Date (local)
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0, 1);
}

export function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

// Expand multi-day events into date->events mapping for month cells
export function buildDailyIndex(events: CalendarLeaveEvent[]) {
  const map = new Map<string, CalendarLeaveEvent[]>();

  for (const ev of events) {
    const start = fromISODate(ev.startDate);
    const end = fromISODate(ev.endDate);

    const d = new Date(start);
    while (d <= end) {
      const key = toISODate(d);
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
      d.setDate(d.getDate() + 1);
    }
  }

  // Sort events per day: APPROVED first, then by name
  for (const [k, list] of map.entries()) {
    list.sort((a, b) => {
      if (a.status !== b.status) return a.status === "APPROVED" ? -1 : 1;
      return a.employeeName.localeCompare(b.employeeName);
    });
    map.set(k, list);
  }

  return map;
}

export function formatMonthTitle(year: number, monthIndex0: number) {
  const d = new Date(year, monthIndex0, 1);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function formatShortDayLabel(dowIndex: number) {
  const base = new Date(2026, 0, 4 + dowIndex); // arbitrary week
  return base.toLocaleString(undefined, { weekday: "short" });
}

export function isWithinRange(today: Date, start: Date, end: Date) {
  return today >= start && today <= end;
}
