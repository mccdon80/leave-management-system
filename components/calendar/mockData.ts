// components/calendar/mockData.ts
// NOTE: Kept file name for minimal refactor, but this now contains TYPES ONLY.
// No mock events are exported.

export type LeaveStatus = "APPROVED" | "PENDING" | "REJECTED" | "CANCELLED";

export type CalendarLeaveEvent = {
  id: string;
  employeeName: string;
  department: string;
  leaveType: string; // ✅ from DB leave_types.name
  status: LeaveStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};
