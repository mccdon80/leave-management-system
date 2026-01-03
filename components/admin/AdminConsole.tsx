// components/admin/AdminConsole.tsx
"use client";

import { useState } from "react";
import AdminTabs, { type AdminTabKey } from "./AdminTabs";
import {
  MOCK_AUDIT,
  MOCK_CARRY_FORWARD,
  MOCK_EMPLOYEES,
  MOCK_ENTITLEMENTS,
  MOCK_LEAVE_TYPES,
  MOCK_ROUTING,
  // ✅ NEW (from mockData.ts)
  MOCK_CONTRACTS,
  type ContractRow,

  type ApprovalRouting,
  type CarryForwardPolicy,
  type EmployeeRow,
  type GradeEntitlement,
  type LeaveType,
  type AuditLogRow,
} from "./mockData";

import ContractsTab from "./tabs/ContractsTab"; // ✅ NEW
import LeaveTypesTab from "./tabs/LeaveTypesTab";
import EntitlementsTab from "./tabs/EntitlementsTab";
import CarryForwardTab from "./tabs/CarryForwardTab";
import RoutingTab from "./tabs/RoutingTab";
import EmployeesTab from "./tabs/EmployeesTab";
import AuditLogTab from "./tabs/AuditLogTab";

export default function AdminConsole() {
  // ✅ Recommended: default to CONTRACTS for multi-tenant setup
  const [active, setActive] = useState<AdminTabKey>("CONTRACTS");

  // Existing states
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(MOCK_LEAVE_TYPES);
  const [entitlements, setEntitlements] = useState<GradeEntitlement[]>(MOCK_ENTITLEMENTS);
  const [carryForward, setCarryForward] = useState<CarryForwardPolicy>(MOCK_CARRY_FORWARD);
  const [routing, setRouting] = useState<ApprovalRouting>(MOCK_ROUTING);
  const [employees, setEmployees] = useState<EmployeeRow[]>(MOCK_EMPLOYEES);
  const [audit] = useState<AuditLogRow[]>(MOCK_AUDIT);

  // ✅ NEW: contracts state lives HERE
  const [contracts, setContracts] = useState<ContractRow[]>(MOCK_CONTRACTS);

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <AdminTabs active={active} setActive={setActive} />

      <div className="space-y-4">
        {/* ✅ NEW tab */}
        {active === "CONTRACTS" && (
          <ContractsTab
            contracts={contracts}
            setContracts={setContracts}
            employees={employees} // uses EmployeeRow for GM/LM pickers
          />
        )}

        {active === "LEAVE_TYPES" && (
          <LeaveTypesTab data={leaveTypes} setData={setLeaveTypes} />
        )}

        {active === "ENTITLEMENTS" && (
          <EntitlementsTab data={entitlements} setData={setEntitlements} />
        )}

        {active === "CARRY_FORWARD" && (
          <CarryForwardTab policy={carryForward} setPolicy={setCarryForward} />
        )}

        {active === "ROUTING" && (
          <RoutingTab routing={routing} setRouting={setRouting} />
        )}

        {active === "EMPLOYEES" && (
          <EmployeesTab data={employees} setData={setEmployees} />
        )}

        {active === "AUDIT" && <AuditLogTab data={audit} />}

        <div className="rounded-xl border bg-white p-4">
          <div className="font-semibold">Admin notes</div>
          <div className="text-sm text-neutral-500 mt-1">
            This console is UI-first. Next we will connect each tab to Supabase with RLS and audit logging.
          </div>
          <ul className="mt-3 text-sm text-neutral-700 list-disc pl-5 space-y-1">
            <li>All settings apply per contract (multi-contract model).</li>
            <li>Only contract admins/GM see these tabs (enforced later).</li>
            <li>Changes will be written as audit log entries.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
