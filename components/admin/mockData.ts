// components/admin/mockData.ts
export type LeavePayCategory = "FULL" | "HALF" | "UNPAID";

export type LeaveType = {
  id: string;
  code: string;
  name: string;

  // NEW
  defaultDays: number | null; // e.g., Birthday=1, Compassionate=3, Sick Half-pay could be null (policy-based)
  payCategory: LeavePayCategory; // FULL/HALF/UNPAID label (UI-first)

  requiresReason: boolean;
  requiresAttachment: boolean;
  active: boolean;
};

export type GradeEntitlement = {
  id: string;
  gradeMin: number;
  gradeMax: number;
  annualDays: number;
};

export type CarryForwardPolicy = {
  maxDays: number;
  usableUntilMonth: number; // 1..12 (e.g., 3 for March)
  usableUntilDay: number; // 1..31 (e.g., 31)
};

export type ApprovalRouting = {
  primaryLineManager: string; // user display name (mock)
  generalManager: string;
  backupApprover: string;
  escalationDays: number; // SLA
};

export type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  department: string;
  grade: number;
  role: "STAFF" | "LM" | "GM" | "ADMIN";
  active: boolean;
};

export type AuditLogRow = {
  id: string;
  time: string; // display string for UI
  actor: string;
  action: string;
  target: string;
  details: string;
};

// UPDATED mock leave types
export const MOCK_LEAVE_TYPES: LeaveType[] = [
  {
    id: "lt1",
    code: "ANNUAL",
    name: "Annual",
    defaultDays: null,
    payCategory: "FULL",
    requiresReason: false,
    requiresAttachment: false,
    active: true,
  },
  {
    id: "lt2",
    code: "BIRTHDAY",
    name: "Birthday",
    defaultDays: 1,
    payCategory: "FULL",
    requiresReason: false,
    requiresAttachment: false,
    active: true,
  },
  {
    id: "lt3",
    code: "SICK_FULL",
    name: "Sick Leave (Full Pay)",
    defaultDays: null,
    payCategory: "FULL",
    requiresReason: true,
    requiresAttachment: true,
    active: true,
  },
  {
    id: "lt4",
    code: "SICK_HALF",
    name: "Sick Leave (Half Pay)",
    defaultDays: null,
    payCategory: "HALF",
    requiresReason: true,
    requiresAttachment: true,
    active: true,
  },
  {
    id: "lt5",
    code: "COMPASSIONATE",
    name: "Compassionate Leave",
    defaultDays: 3,
    payCategory: "FULL",
    requiresReason: true,
    requiresAttachment: false,
    active: true,
  },
];

export const MOCK_ENTITLEMENTS: GradeEntitlement[] = [
  { id: "ge1", gradeMin: 1, gradeMax: 15, annualDays: 22 },
  { id: "ge2", gradeMin: 16, gradeMax: 99, annualDays: 33 },
];

export const MOCK_CARRY_FORWARD: CarryForwardPolicy = {
  maxDays: 5,
  usableUntilMonth: 3,
  usableUntilDay: 31,
};

export const MOCK_ROUTING: ApprovalRouting = {
  primaryLineManager: "Ahmed (Line Manager)",
  generalManager: "Fatima (General Manager)",
  backupApprover: "Backup Approver (LM2)",
  escalationDays: 7,
};

export const MOCK_EMPLOYEES: EmployeeRow[] = [
  { id: "u1", name: "Don Benaid", email: "don@example.com", department: "IT", grade: 16, role: "STAFF", active: true },
  { id: "u2", name: "Sara Ali", email: "sara@example.com", department: "IT", grade: 12, role: "STAFF", active: true },
  { id: "u3", name: "Ahmed", email: "ahmed@example.com", department: "IT", grade: 18, role: "LM", active: true },
  { id: "u4", name: "Fatima", email: "fatima@example.com", department: "Management", grade: 20, role: "GM", active: true },
  { id: "u5", name: "Admin User", email: "admin@example.com", department: "HR", grade: 20, role: "ADMIN", active: true },
];

export const MOCK_AUDIT: AuditLogRow[] = [
  {
    id: "a1",
    time: "2026-01-03 09:15",
    actor: "Admin User",
    action: "UPDATE",
    target: "Carry-forward policy",
    details: "maxDays: 5 → 5, usableUntil: Mar 31",
  },
  {
    id: "a2",
    time: "2026-01-02 11:40",
    actor: "Admin User",
    action: "CREATE",
    target: "Leave type",
    details: "Created SICK_HALF (requires reason + attachment) payCategory=HALF",
  },
  {
    id: "a3",
    time: "2026-01-01 10:05",
    actor: "Admin User",
    action: "UPDATE",
    target: "Entitlements",
    details: "Grades 16+ annualDays: 33",
  },
];

// components/admin/mockData.ts (ADD BELOW existing mocks)

export type Department = {
  id: string;
  name: string;
  lineManagerEmployeeId: string | null; // references EmployeeRow.id
  backupApproverEmployeeId: string | null; // references EmployeeRow.id
};

export type ContractRow = {
  id: string;
  name: string;
  code: string; // tenant key e.g. SERCO_ZU_2026
  location?: string;
  active: boolean;

  generalManagerEmployeeId: string | null; // references EmployeeRow.id
  departments: Department[];
};

export const MOCK_CONTRACTS: ContractRow[] = [
  {
    id: "ct1",
    name: "Serco-ZU Facilities 2026",
    code: "SERCO_ZU_2026",
    location: "UAE",
    active: true,
    generalManagerEmployeeId: "u4", // Fatima
    departments: [
      { id: "dep1", name: "IT", lineManagerEmployeeId: "u3", backupApproverEmployeeId: "u5" }, // Ahmed + Admin backup (mock)
      { id: "dep2", name: "HR", lineManagerEmployeeId: "u5", backupApproverEmployeeId: null },
      { id: "dep3", name: "Finance", lineManagerEmployeeId: null, backupApproverEmployeeId: null },
    ],
  },
  {
    id: "ct2",
    name: "Alpha Data Support 2026",
    code: "ALPHA_DATA_2026",
    location: "UAE",
    active: false,
    generalManagerEmployeeId: "u4",
    departments: [{ id: "dep4", name: "Support", lineManagerEmployeeId: "u3", backupApproverEmployeeId: null }],
  },
];
