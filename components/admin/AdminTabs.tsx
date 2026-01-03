// components/admin/AdminTabs.tsx
"use client";

export type AdminTabKey =
  | "CONTRACTS"
  | "LEAVE_TYPES"
  | "ENTITLEMENTS"
  | "CARRY_FORWARD"
  | "ROUTING"
  | "EMPLOYEES"
  | "AUDIT";

const tabs: { key: AdminTabKey; label: string; description: string }[] = [
  {
    key: "CONTRACTS",
    label: "Contracts",
    description: "Create contracts, assign GM, define departments, and assign line managers.",
  },
  { key: "LEAVE_TYPES", label: "Leave Types", description: "Configure types, requirements, and availability." },
  { key: "ENTITLEMENTS", label: "Entitlements", description: "Grade-based annual leave rules (UAE contract)." },
  { key: "CARRY_FORWARD", label: "Carry-forward", description: "Max carry-forward days and expiry window." },
  { key: "ROUTING", label: "Approval Routing", description: "Line manager, GM, backups, and escalation SLA." },
  { key: "EMPLOYEES", label: "Employees", description: "Manage staff, roles, departments, and import CSV." },
  { key: "AUDIT", label: "Audit Log", description: "Track changes and overrides (auditability)." },
];

export default function AdminTabs({
  active,
  setActive,
}: {
  active: AdminTabKey;
  setActive: (k: AdminTabKey) => void;
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-4 border-b">
        <div className="font-semibold">Admin Console</div>
        <div className="text-sm text-neutral-500 mt-1">
          Contract configuration and governance tools.
        </div>
      </div>

      <div className="divide-y">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={[
                "w-full text-left p-4 transition",
                isActive ? "bg-neutral-900 text-white" : "hover:bg-neutral-50",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={["font-medium", isActive ? "text-white" : "text-neutral-900"].join(" ")}>
                    {t.label}
                  </div>
                  <div className={["text-sm mt-1", isActive ? "text-neutral-200" : "text-neutral-500"].join(" ")}>
                    {t.description}
                  </div>
                </div>
                <span
                  className={[
                    "text-xs rounded-full px-2 py-1",
                    isActive ? "bg-white/10 text-white" : "bg-neutral-100 text-neutral-700",
                  ].join(" ")}
                >
                  {t.key.replace("_", " ")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
