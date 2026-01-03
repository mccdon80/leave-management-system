// components/calendar/CalendarFilters.tsx
"use client";

import type { LeaveStatus, LeaveType } from "./mockData";


export type CalendarFiltersState = {
    view: "MONTH" | "WEEK"; // WEEK is placeholder for now
    status: "ALL" | LeaveStatus;
    leaveType: "ALL" | LeaveType;
    department: "ALL" | string;
    query: string;
};

export default function CalendarFilters({
    filters,
    setFilters,
    departments,
}: {
    filters: CalendarFiltersState;
    setFilters: (next: CalendarFiltersState) => void;
    departments: string[];
}) {
    return (
        <div className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="font-semibold">Filters</div>
                    <div className="text-sm text-neutral-500 mt-1">
                        Refine the calendar by status, leave type, and department.
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className={[
                            "rounded-md border px-3 py-2 text-sm",
                            filters.view === "MONTH" ? "bg-neutral-900 text-white border-neutral-900" : "hover:bg-neutral-50",
                        ].join(" ")}
                        onClick={() => setFilters({ ...filters, view: "MONTH" })}
                    >
                        Month
                    </button>
                    <button
                        type="button"
                        className={[
                            "rounded-md border px-3 py-2 text-sm",
                            filters.view === "WEEK" ? "bg-neutral-900 text-white border-neutral-900" : "hover:bg-neutral-50",
                        ].join(" ")}
                        onClick={() => setFilters({ ...filters, view: "WEEK" })}
                    >
                        Week
                    </button>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                    <label className="text-xs text-neutral-500">Search</label>
                    <input
                        className="w-full rounded-md border p-2 text-sm"
                        placeholder="Employee name..."
                        value={filters.query}
                        onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs text-neutral-500">Status</label>
                    <select
                        className="w-full rounded-md border p-2 text-sm bg-white"
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                    >
                        <option value="ALL">All</option>
                        <option value="APPROVED">Approved</option>
                        <option value="PENDING">Pending</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs text-neutral-500">Leave type</label>
                    <select
                        className="w-full rounded-md border p-2 text-sm bg-white"
                        value={filters.leaveType}
                        onChange={(e) => setFilters({ ...filters, leaveType: e.target.value as any })}
                    >
                        <option value="ALL">All</option>
                        <option value="Annual">Annual</option>
                        <option value="Birthday">Birthday</option>
                        <option value="Sick">Sick</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs text-neutral-500">Department</label>
                    <select
                        className="w-full rounded-md border p-2 text-sm bg-white"
                        value={filters.department}
                        onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                    >
                        <option value="ALL">All</option>
                        {departments.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
                <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                    onClick={() =>
                        setFilters({
                            view: "MONTH",
                            status: "ALL",
                            leaveType: "ALL",
                            department: "ALL",
                            query: "",
                        })
                    }
                >
                    Reset filters
                </button>

                <div className="text-xs text-neutral-500">
                    Tip: staff sees department approved; LM sees pending; GM/admin sees contract-wide.
                </div>
            </div>
        </div>
    );
}
