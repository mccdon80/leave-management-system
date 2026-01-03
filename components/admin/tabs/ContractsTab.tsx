"use client";

import { useMemo, useState } from "react";
import type { ContractRow, Department, EmployeeRow } from "../mockData";

function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "info";
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : tone === "info"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : "bg-neutral-100 text-neutral-700 border-neutral-200";

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs border ${cls}`}>
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function slugCode(s: string) {
  return s
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function resolveEmployee(employees: EmployeeRow[], id: string | null | undefined) {
  if (!id) return null;
  return employees.find((e) => e.id === id) ?? null;
}

export default function ContractsTab({
  contracts,
  setContracts,
  employees,
}: {
  contracts: ContractRow[];
  setContracts: (next: ContractRow[]) => void;
  employees: EmployeeRow[];
}) {
  // Defensive (prevents runtime crash even if caller messes up)
  const safeEmployees = employees ?? [];
  const safeContracts = contracts ?? [];

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(safeContracts[0]?.id ?? "");

  const selected = useMemo(
    () => safeContracts.find((c) => c.id === selectedId) ?? null,
    [safeContracts, selectedId]
  );

  const gmCandidates = useMemo(
    () => safeEmployees.filter((p) => p.role === "GM" || p.role === "ADMIN"),
    [safeEmployees]
  );

  const lmCandidates = useMemo(
    () => safeEmployees.filter((p) => p.role === "LM" || p.role === "ADMIN"),
    [safeEmployees]
  );

  const filteredContracts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return safeContracts;
    return safeContracts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.location ?? "").toLowerCase().includes(q)
    );
  }, [safeContracts, query]);

  // Contract form (inline panel)
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [contractName, setContractName] = useState("");
  const [contractCode, setContractCode] = useState("");
  const [contractLocation, setContractLocation] = useState("UAE");
  const [contractActive, setContractActive] = useState(true);
  const [contractGM, setContractGM] = useState<string | "">("");

  function startCreateContract() {
    setEditingContractId(null);
    setContractName("");
    setContractCode("");
    setContractLocation("UAE");
    setContractActive(true);
    setContractGM("");
  }

  function startEditContract(c: ContractRow) {
    setEditingContractId(c.id);
    setContractName(c.name);
    setContractCode(c.code);
    setContractLocation(c.location ?? "UAE");
    setContractActive(c.active);
    setContractGM(c.generalManagerEmployeeId ?? "");
  }

  function saveContract() {
    const name = contractName.trim();
    if (!name) return;

    const code = slugCode(contractCode.trim() ? contractCode : name);

    if (editingContractId) {
      const next = safeContracts.map((c) =>
        c.id === editingContractId
          ? {
              ...c,
              name,
              code,
              location: contractLocation.trim() || undefined,
              active: contractActive,
              generalManagerEmployeeId: contractGM || null,
            }
          : c
      );
      setContracts(next);
      setSelectedId(editingContractId);
    } else {
      const created: ContractRow = {
        id: `ct-${Date.now()}`,
        name,
        code,
        location: contractLocation.trim() || undefined,
        active: contractActive,
        generalManagerEmployeeId: contractGM || null,
        departments: [],
      };
      setContracts([created, ...safeContracts]);
      setSelectedId(created.id);
    }
  }

  function deleteContract(id: string) {
    const next = safeContracts.filter((c) => c.id !== id);
    setContracts(next);
    setSelectedId(next[0]?.id ?? "");
  }

  // Department form
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deptLM, setDeptLM] = useState<string | "">("");
  const [deptBackup, setDeptBackup] = useState<string | "">("");

  function startCreateDept() {
    setEditingDeptId(null);
    setDeptName("");
    setDeptLM("");
    setDeptBackup("");
  }

  function startEditDept(d: Department) {
    setEditingDeptId(d.id);
    setDeptName(d.name);
    setDeptLM(d.lineManagerEmployeeId ?? "");
    setDeptBackup(d.backupApproverEmployeeId ?? "");
  }

  function saveDept() {
    if (!selected) return;

    const name = deptName.trim();
    if (!name) return;

    const nextDept: Department = {
      id: editingDeptId ?? `dep-${Date.now()}`,
      name,
      lineManagerEmployeeId: deptLM || null,
      backupApproverEmployeeId: deptBackup || null,
    };

    const nextContract: ContractRow = {
      ...selected,
      departments: editingDeptId
        ? selected.departments.map((d) => (d.id === editingDeptId ? nextDept : d))
        : [nextDept, ...selected.departments],
    };

    setContracts(safeContracts.map((c) => (c.id === selected.id ? nextContract : c)));
  }

  function deleteDept(deptId: string) {
    if (!selected) return;
    const nextContract: ContractRow = {
      ...selected,
      departments: selected.departments.filter((d) => d.id !== deptId),
    };
    setContracts(safeContracts.map((c) => (c.id === selected.id ? nextContract : c)));
  }

  // When selection changes, reset forms to avoid confusion
  function selectContract(id: string) {
    setSelectedId(id);
    startCreateDept();
    setEditingContractId(null);
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-xl border bg-white p-4">
        <div className="font-semibold">Contracts</div>
        <div className="text-sm text-neutral-500 mt-1">
          Create contracts and define GM + departments + line managers per contract.
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Left: contract list */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div className="font-medium">Contract list</div>
              <button
                type="button"
                className="rounded-md bg-neutral-900 text-white px-3 py-2 text-sm hover:bg-neutral-800"
                onClick={startCreateContract}
              >
                New
              </button>
            </div>

            <input
              className="w-full rounded-md border p-2 text-sm"
              placeholder="Search contracts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="divide-y">
            {filteredContracts.map((c) => {
              const gm = resolveEmployee(safeEmployees, c.generalManagerEmployeeId);
              const isActive = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectContract(c.id)}
                  className={[
                    "w-full text-left p-4 transition",
                    isActive ? "bg-neutral-50" : "hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-neutral-500 mt-1 truncate">
                        {c.code} {c.location ? `• ${c.location}` : ""}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1 truncate">
                        GM: {gm ? gm.name : "Not set"} • Depts: {c.departments.length}
                      </div>
                    </div>
                    <Tag tone={c.active ? "good" : "neutral"}>{c.active ? "Active" : "Disabled"}</Tag>
                  </div>
                </button>
              );
            })}

            {filteredContracts.length === 0 ? (
              <div className="p-6 text-sm text-neutral-500">No contracts found.</div>
            ) : null}
          </div>
        </div>

        {/* Right: details */}
        <div className="space-y-4">
          {/* Contract editor */}
          <div className="rounded-xl border bg-white p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">Contract details</div>
                <div className="text-sm text-neutral-500 mt-1">
                  {editingContractId ? "Editing selected contract." : "Create a new contract or edit selected."}
                </div>
              </div>

              {selected ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                    onClick={() => startEditContract(selected)}
                  >
                    Edit selected
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                    onClick={() => deleteContract(selected.id)}
                  >
                    Delete selected
                  </button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Contract name">
                <input
                  className="w-full rounded-md border p-2 text-sm"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  placeholder="e.g., Serco-ZU Facilities 2026"
                />
              </Field>

              <Field label="Contract code">
                <input
                  className="w-full rounded-md border p-2 text-sm font-mono"
                  value={contractCode}
                  onChange={(e) => setContractCode(e.target.value)}
                  placeholder="e.g., SERCO_ZU_2026"
                />
                <div className="text-xs text-neutral-500 mt-1">
                  If blank, we auto-generate from the name.
                </div>
              </Field>

              <Field label="Location (optional)">
                <input
                  className="w-full rounded-md border p-2 text-sm"
                  value={contractLocation}
                  onChange={(e) => setContractLocation(e.target.value)}
                  placeholder="UAE / Abu Dhabi / Dubai"
                />
              </Field>

              <Field label="General Manager (GM)">
                <select
                  className="w-full rounded-md border p-2 text-sm bg-white"
                  value={contractGM}
                  onChange={(e) => setContractGM(e.target.value)}
                >
                  <option value="">Select GM…</option>
                  {gmCandidates.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.role})
                    </option>
                  ))}
                </select>
              </Field>

              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={contractActive}
                  onChange={(e) => setContractActive(e.target.checked)}
                />
                Active contract
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={() => {
                  setEditingContractId(null);
                  setContractName("");
                  setContractCode("");
                  setContractLocation("UAE");
                  setContractActive(true);
                  setContractGM("");
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800"
                onClick={saveContract}
              >
                Save contract
              </button>
            </div>
          </div>

          {/* Departments */}
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="p-4 border-b">
              <div className="font-semibold">Departments & Line Managers</div>
              <div className="text-sm text-neutral-500 mt-1">
                Each contract has its own departments and LM assignments.
              </div>
            </div>

            {!selected ? (
              <div className="p-6 text-sm text-neutral-500">Select a contract to manage departments.</div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Department name">
                    <input
                      className="w-full rounded-md border p-2 text-sm"
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      placeholder="e.g., IT"
                    />
                  </Field>

                  <Field label="Line Manager">
                    <select
                      className="w-full rounded-md border p-2 text-sm bg-white"
                      value={deptLM}
                      onChange={(e) => setDeptLM(e.target.value)}
                    >
                      <option value="">Not assigned</option>
                      {lmCandidates.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.role})
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Backup approver (optional)">
                    <select
                      className="w-full rounded-md border p-2 text-sm bg-white"
                      value={deptBackup}
                      onChange={(e) => setDeptBackup(e.target.value)}
                    >
                      <option value="">None</option>
                      {lmCandidates.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.role})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                    onClick={startCreateDept}
                  >
                    New
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800"
                    onClick={saveDept}
                  >
                    Save department
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-225 w-full">
                    <thead className="bg-neutral-50">
                      <tr className="text-xs text-neutral-500">
                        <th className="p-3 text-left">Department</th>
                        <th className="p-3 text-left">Line Manager</th>
                        <th className="p-3 text-left">Backup Approver</th>
                        <th className="p-3 text-left">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selected.departments.map((d) => {
                        const lm = resolveEmployee(safeEmployees, d.lineManagerEmployeeId);
                        const ba = resolveEmployee(safeEmployees, d.backupApproverEmployeeId);
                        return (
                          <tr key={d.id} className="border-t">
                            <td className="p-3 text-sm font-medium">{d.name}</td>
                            <td className="p-3 text-sm">{lm ? lm.name : <span className="text-neutral-500">Not assigned</span>}</td>
                            <td className="p-3 text-sm">{ba ? ba.name : <span className="text-neutral-500">None</span>}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                                  onClick={() => {
                                    startEditDept(d);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                                  onClick={() => deleteDept(d.id)}
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {selected.departments.length === 0 ? (
                        <tr className="border-t">
                          <td className="p-6 text-sm text-neutral-500" colSpan={4}>
                            No departments yet. Add one above.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-neutral-500">
                  Routing rule reminder: Staff → Department LM; LM request → GM; escalation after SLA; backup approver used when configured.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
