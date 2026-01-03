// components/approvals/mockData.ts
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED";
export type LeaveType = "Annual" | "Birthday" | "Sick";

export type ApprovalItem = {
  taskId: string;
  requestId: string;
  bookingRef: string;

  requesterName: string;
  requesterDepartment: string;

  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  workingDays: number;

  status: ApprovalStatus;

  submittedAt: string; // ISO-ish string for UI
  dueBy: string;       // ISO-ish string for UI
  escalationTarget: string;

  fareOption: "SMART" | "CURRENT_ONLY" | "CARRY_ONLY";
  breakdown: { carryForward: number; currentYear: number };

  policyNotes: string[];
};

export const MOCK_APPROVALS: ApprovalItem[] = [
  {
    taskId: "t-1001",
    requestId: "r-9001",
    bookingRef: "LV-2026-000123",
    requesterName: "Don Benaid",
    requesterDepartment: "IT",
    leaveType: "Annual",
    startDate: "2026-01-12",
    endDate: "2026-01-16",
    workingDays: 5,
    status: "PENDING",
    submittedAt: "2026-01-03 09:30",
    dueBy: "2026-01-10 09:30",
    escalationTarget: "General Manager",
    fareOption: "SMART",
    breakdown: { carryForward: 3, currentYear: 2 },
    policyNotes: [
      "Carry-forward usable until Mar 31.",
      "Dates must be within Jan 1 – Dec 31 leave year.",
    ],
  },
  {
    taskId: "t-1002",
    requestId: "r-9002",
    bookingRef: "LV-2026-000131",
    requesterName: "Sara Ali",
    requesterDepartment: "IT",
    leaveType: "Sick",
    startDate: "2026-01-03",
    endDate: "2026-01-03",
    workingDays: 1,
    status: "PENDING",
    submittedAt: "2026-01-03 08:10",
    dueBy: "2026-01-10 08:10",
    escalationTarget: "General Manager",
    fareOption: "CURRENT_ONLY",
    breakdown: { carryForward: 0, currentYear: 1 },
    policyNotes: ["Attachment may be required depending on leave type policy."],
  },
  {
    taskId: "t-1003",
    requestId: "r-9003",
    bookingRef: "LV-2026-000110",
    requesterName: "Maya Joseph",
    requesterDepartment: "HR",
    leaveType: "Birthday",
    startDate: "2026-01-05",
    endDate: "2026-01-05",
    workingDays: 1,
    status: "APPROVED",
    submittedAt: "2026-01-01 10:05",
    dueBy: "2026-01-08 10:05",
    escalationTarget: "General Manager",
    fareOption: "CURRENT_ONLY",
    breakdown: { carryForward: 0, currentYear: 1 },
    policyNotes: ["Birthday leave is limited to 1 day per year (non-carry-forward)."],
  },
  {
    taskId: "t-1004",
    requestId: "r-9004",
    bookingRef: "LV-2025-000987",
    requesterName: "Hassan Saeed",
    requesterDepartment: "Finance",
    leaveType: "Annual",
    startDate: "2025-12-20",
    endDate: "2025-12-24",
    workingDays: 4,
    status: "REJECTED",
    submittedAt: "2025-12-10 14:40",
    dueBy: "2025-12-17 14:40",
    escalationTarget: "General Manager",
    fareOption: "CURRENT_ONLY",
    breakdown: { carryForward: 0, currentYear: 4 },
    policyNotes: ["Rejected due to department coverage (mock)."],
  },
];
