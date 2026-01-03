// components/calendar/mockData.ts
export type LeaveStatus = "APPROVED" | "PENDING";
export type LeaveType = "Annual" | "Birthday" | "Sick";

export type CalendarLeaveEvent = {
  id: string;
  employeeName: string;
  department: string;
  leaveType: LeaveType;
  status: LeaveStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
};

export const MOCK_EVENTS: CalendarLeaveEvent[] = [
  {
    id: "e1",
    employeeName: "Sara Ali",
    department: "IT",
    leaveType: "Annual",
    status: "APPROVED",
    startDate: "2026-01-06",
    endDate: "2026-01-08",
  },
  {
    id: "e2",
    employeeName: "Omar Khan",
    department: "IT",
    leaveType: "Sick",
    status: "APPROVED",
    startDate: "2026-01-03",
    endDate: "2026-01-03",
  },
  {
    id: "e3",
    employeeName: "Lina Noor",
    department: "IT",
    leaveType: "Annual",
    status: "PENDING",
    startDate: "2026-01-12",
    endDate: "2026-01-16",
  },
  {
    id: "e4",
    employeeName: "Hassan Saeed",
    department: "Finance",
    leaveType: "Annual",
    status: "APPROVED",
    startDate: "2026-01-19",
    endDate: "2026-01-20",
  },
  {
    id: "e5",
    employeeName: "Maya Joseph",
    department: "HR",
    leaveType: "Birthday",
    status: "APPROVED",
    startDate: "2026-01-27",
    endDate: "2026-01-27",
  },
];
