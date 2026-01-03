// app/(app)/calendar/page.tsx
"use client";

import { useMemo, useState } from "react";
import CalendarFilters, { type CalendarFiltersState } from "@/components/calendar/CalendarFilters";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import WhosOffSidebar from "@/components/calendar/WhosOffSidebar";
import WeekView from "@/components/calendar/WeekView";
import { MOCK_EVENTS, type CalendarLeaveEvent } from "@/components/calendar/mockData";
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

export default function CalendarPage() {
  // Month state (existing)
  const [year, setYear] = useState(2026);
  const [monthIndex0, setMonthIndex0] = useState(0); // Jan

  // Week anchor (new)
  const [anchorDateISO, setAnchorDateISO] = useState(() => toISODate(new Date()));

  const [filters, setFilters] = useState<CalendarFiltersState>({
    view: "MONTH",
    status: "ALL",
    leaveType: "ALL",
    department: "ALL",
    query: "",
  });

  const departments = useMemo(() => {
    const set = new Set<string>();
    MOCK_EVENTS.forEach((e) => set.add(e.department));
    return Array.from(set).sort();
  }, []);

  // Compute current week range
  const weekRange = useMemo(() => {
    const anchor = fromISODate(anchorDateISO);
    const start = startOfWeekMonday(anchor);
    const end = addDays(start, 6);
    return { start, end };
  }, [anchorDateISO]);

  const filteredEvents = useMemo(() => {
    const q = filters.query.trim().toLowerCase();

    return MOCK_EVENTS.filter((ev) => {
      if (filters.status !== "ALL" && ev.status !== filters.status) return false;
      if (filters.leaveType !== "ALL" && ev.leaveType !== filters.leaveType) return false;
      if (filters.department !== "ALL" && ev.department !== filters.department) return false;
      if (q && !ev.employeeName.toLowerCase().includes(q)) return false;

      const evStart = new Date(ev.startDate);
      const evEnd = new Date(ev.endDate);

      if (filters.view === "MONTH") {
        // Month filter: show events overlapping the current month
        const start = new Date(year, monthIndex0, 1);
        const end = new Date(year, monthIndex0 + 1, 0);
        return evEnd >= start && evStart <= end;
      }

      // Week filter: show events overlapping the current week range
      return evEnd >= weekRange.start && evStart <= weekRange.end;
    });
  }, [filters, year, monthIndex0, weekRange]);

  // Sidebar day:
  // - Month view: "today if in month else first day of month"
  // - Week view: anchorDateISO (navigated day)
  const selectedDateISO = useMemo(() => {
    if (filters.view === "WEEK") return anchorDateISO;

    const today = new Date();
    const inMonth = today.getFullYear() === year && today.getMonth() === monthIndex0;
    return inMonth ? toISODate(today) : toISODate(new Date(year, monthIndex0, 1));
  }, [filters.view, anchorDateISO, year, monthIndex0]);

  function prevMonth() {
    const d = new Date(year, monthIndex0, 1);
    d.setMonth(d.getMonth() - 1);
    setYear(d.getFullYear());
    setMonthIndex0(d.getMonth());
  }

  function nextMonth() {
    const d = new Date(year, monthIndex0, 1);
    d.setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setMonthIndex0(d.getMonth());
  }

  function goTodayMonth() {
    const t = new Date();
    setYear(t.getFullYear());
    setMonthIndex0(t.getMonth());
  }

  function prevWeek() {
    const d = fromISODate(anchorDateISO);
    setAnchorDateISO(toISODate(addDays(d, -7)));
  }

  function nextWeek() {
    const d = fromISODate(anchorDateISO);
    setAnchorDateISO(toISODate(addDays(d, 7)));
  }

  function goTodayWeek() {
    setAnchorDateISO(toISODate(new Date()));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Plan leave visually and avoid conflicts (UI-first mock).
        </p>
      </div>

      <CalendarFilters filters={filters} setFilters={setFilters} departments={departments} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {filters.view === "MONTH" ? (
            <CalendarGrid
              year={year}
              monthIndex0={monthIndex0}
              events={filteredEvents as CalendarLeaveEvent[]}
              onPrev={prevMonth}
              onNext={nextMonth}
              onToday={goTodayMonth}
            />
          ) : (
            <WeekView
              events={filteredEvents as CalendarLeaveEvent[]}
              anchorDateISO={anchorDateISO}
              onPrevWeek={prevWeek}
              onNextWeek={nextWeek}
              onToday={goTodayWeek}
            />
          )}
        </div>

        <WhosOffSidebar
          events={filteredEvents as CalendarLeaveEvent[]}
          selectedDateISO={selectedDateISO}
        />
      </div>
    </div>
  );
}
