// app/(app)/calendar/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import CalendarFilters, { type CalendarFiltersState } from "@/components/calendar/CalendarFilters";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import WhosOffSidebar from "@/components/calendar/WhosOffSidebar";
import WeekView from "@/components/calendar/WeekView";
import type { CalendarLeaveEvent } from "@/components/calendar/mockData";
import { toISODate } from "@/components/calendar/utils";
import { supabase } from "@/lib/supabase/client";

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

function startOfMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0, 1);
}

function endOfMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0);
}

function mapDbStatusToUi(status: string): CalendarLeaveEvent["status"] | null {
  const s = (status ?? "").toLowerCase();

  if (s === "approved") return "APPROVED";
  if (s.startsWith("pending")) return "PENDING";
  if (s === "rejected") return "REJECTED";
  if (s === "cancelled") return "CANCELLED";

  // Ignore draft, submitted, etc
  return null;
}

type LeaveTypeOption = { code: string; name: string };

type DbRow = {
  id: string;
  requester_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  leave_type: string; // leave_types.code
  status: string;
  requester?: { full_name: string | null; email: string | null } | null;
  dept?: { name: string | null } | null;
  lt?: { code: string | null; name: string | null } | null;
};

export default function CalendarPage() {
  // Month state
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [monthIndex0, setMonthIndex0] = useState(() => new Date().getMonth());

  // Week anchor
  const [anchorDateISO, setAnchorDateISO] = useState(() => toISODate(new Date()));

  // Selected day (for sidebar)
  const [selectedDateISO, setSelectedDateISO] = useState(() => toISODate(new Date()));

  const [filters, setFilters] = useState<CalendarFiltersState>({
    view: "MONTH",
    status: "ALL",
    leaveType: "ALL",
    department: "ALL",
    query: "",
  });

  // Leave types for filter dropdown (DB)
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [leaveTypesLoading, setLeaveTypesLoading] = useState(false);

  // Supabase-backed events
  const [events, setEvents] = useState<CalendarLeaveEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Departments list for filter dropdown (derived from events for now)
  const departments = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.department));
    return Array.from(set).sort();
  }, [events]);

  // Compute current week range
  const weekRange = useMemo(() => {
    const anchor = fromISODate(anchorDateISO);
    const start = startOfWeekMonday(anchor);
    const end = addDays(start, 6);
    return { start, end };
  }, [anchorDateISO]);

  // Load leave types (for filter dropdown)
  useEffect(() => {
    async function loadTypes() {
      setLeaveTypesLoading(true);
      try {
        const { data, error } = await supabase
          .from("leave_types")
          .select("code,name")
          .eq("active", true)
          .order("name", { ascending: true });

        if (error) throw error;

        setLeaveTypes(
          (data ?? []).map((r: any) => ({
            code: String(r.code),
            name: String(r.name),
          }))
        );
      } catch {
        setLeaveTypes([]);
      } finally {
        setLeaveTypesLoading(false);
      }
    }

    loadTypes();
  }, []);

  // Fetch events whenever visible range changes (month/week) or view toggles
  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        let from: string;
        let to: string;

        if (filters.view === "WEEK") {
          from = toISODate(weekRange.start);
          to = toISODate(weekRange.end);
        } else {
          from = toISODate(startOfMonth(year, monthIndex0));
          to = toISODate(endOfMonth(year, monthIndex0));
        }

        // Overlap condition: start_date <= to AND end_date >= from
        // Join profiles + departments + leave_types for display labels
        const { data, error } = await supabase
          .from("leave_requests")
          .select(
            `
            id,
            requester_id,
            start_date,
            end_date,
            leave_type,
            status,
            requester:profiles!leave_requests_requester_id_fkey(full_name,email),
            dept:departments!leave_requests_department_id_fkey(name),
            lt:leave_types!leave_requests_leave_type_fkey(code,name)
          `
          )
          .lte("start_date", to)
          .gte("end_date", from)
          .order("start_date", { ascending: true });

        if (error) throw error;

        const mapped: CalendarLeaveEvent[] = (data ?? [])
          .map((r: any) => r as DbRow)
          .map((r) => {
            const uiStatus = mapDbStatusToUi(r.status);
            if (!uiStatus) return null;

            const employeeName =
              r.requester?.full_name?.trim() ||
              r.requester?.email?.trim() ||
              r.requester_id.slice(0, 8);

            const department = r.dept?.name?.trim() || "Department";

            const leaveTypeName =
              r.lt?.name?.trim() ||
              r.leave_type; // fallback to code if join missing

            return {
              id: r.id,
              employeeName,
              department,
              leaveType: leaveTypeName,
              status: uiStatus,
              startDate: r.start_date,
              endDate: r.end_date,
            } satisfies CalendarLeaveEvent;
          })
          .filter(Boolean) as CalendarLeaveEvent[];

        setEvents(mapped);
      } catch (e: any) {
        setLoadError(e?.message ?? "Failed to load calendar data");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [filters.view, year, monthIndex0, weekRange.start, weekRange.end]);

  const filteredEvents = useMemo(() => {
    const q = filters.query.trim().toLowerCase();

    return events.filter((ev) => {
      if (filters.status !== "ALL" && ev.status !== filters.status) return false;
      if (filters.leaveType !== "ALL" && ev.leaveType !== filters.leaveType) return false;
      if (filters.department !== "ALL" && ev.department !== filters.department) return false;
      if (q && !ev.employeeName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, filters]);

  // Month nav handlers
  function prevMonth() {
    setMonthIndex0((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function nextMonth() {
    setMonthIndex0((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  function goTodayMonth() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonthIndex0(now.getMonth());
    setSelectedDateISO(toISODate(now));
  }

  // Week nav handlers
  function prevWeek() {
    const d = fromISODate(anchorDateISO);
    setAnchorDateISO(toISODate(addDays(d, -7)));
  }

  function nextWeek() {
    const d = fromISODate(anchorDateISO);
    setAnchorDateISO(toISODate(addDays(d, 7)));
  }

  function goTodayWeek() {
    const now = new Date();
    setAnchorDateISO(toISODate(now));
    setSelectedDateISO(toISODate(now));
  }

  return (
    <div className="space-y-4">
      <CalendarFilters
        filters={filters}
        setFilters={setFilters}
        departments={departments}
        leaveTypes={leaveTypesLoading ? [] : leaveTypes}
      />

      {(loading || loadError) && (
        <div className="rounded-xl border bg-white p-3 text-sm">
          {loading ? (
            <div className="text-neutral-600">Loading calendar…</div>
          ) : (
            <div className="text-red-600">{loadError}</div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {filters.view === "MONTH" ? (
            <CalendarGrid
              year={year}
              monthIndex0={monthIndex0}
              events={filteredEvents}
              onPrev={prevMonth}
              onNext={nextMonth}
              onToday={goTodayMonth}
            />
          ) : (
            <WeekView
              events={filteredEvents}
              anchorDateISO={anchorDateISO}
              onPrevWeek={prevWeek}
              onNextWeek={nextWeek}
              onToday={goTodayWeek}
            />
          )}
        </div>

        <WhosOffSidebar events={filteredEvents} selectedDateISO={selectedDateISO} />
      </div>
    </div>
  );
}
