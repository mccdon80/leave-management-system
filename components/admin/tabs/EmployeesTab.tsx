// components/admin/tabs/EmployeesTab.tsx
"use client";

import { useMemo, useState } from "react";
import AdminModal from "../AdminModal";
import type { EmployeeRow } from "../mockData";

function Pill({ text, tone }: { text: string; tone: "on" | "off" | "role" }) {
  const cls =
    tone === "on"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "off"
      ? "bg-neutral-100 text-neutral-600 border-neutral-200"
      : "bg-blue-50 text-blue-900 border-blue-200";

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs border ${cls}`}>{text}</span>;
}

export default function EmployeesTab({
  data,
  setData,
}: {
  data: EmployeeRow[];
  setData: (next: EmployeeRow[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"ALL" | EmployeeRow["role"]>("ALL");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((x) => {
      if (role !== "ALL" && x.role !== role) return false;
      if (!q) return true;
      return (
        x.name.toLowerCase().includes(q) ||
        x.email.toLowerCase().includes(q) ||
        x.department.toLowerCase().includes(q)
      );
    });
  }, [data, query, role]);

  const [csvText, setCsvText] = useState(
    "name,email,department,grade,role\nJohn Doe,john@example.com,IT,12,STAFF\nJane Smith,jane@example.com,HR,16,LM"
  );

  function importCsvMock() {
    // UI-only: pretend import succeeded
    setModalOpen(false);
    alert("Mock import complete. Later: parse CSV + insert to Supabase.");
  }

  function toggleActive(id: string) {
    setData(
      data.map((x) => (x.id === id ? { ...x, active: !x.active } : x))
    );
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-4 border-b flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-semibold">Employees</div>
          <div className="text-sm text-neutral-500 mt-1">
            Manage users and roles (import CSV for MVP).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="rounded-md border p-2 text-sm"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="rounded-md border p-2 text-sm bg-white"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
          >
            <option value="ALL">All roles</option>
            <option value="STAFF">STAFF</option>
            <option value="LM">LM</option>
            <option value="GM">GM</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button
            className="rounded-md bg-neutral-900 text-white px-3 py-2 text-sm hover:bg-neutral-800"
            type="button"
            onClick={() => setModalOpen(true)}
          >
            Import CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1000px] w-full">
          <thead className="bg-neutral-50">
            <tr className="text-xs text-neutral-500">
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Department</th>
              <th className="p-3 text-left">Grade</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Active</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3 text-sm font-medium">{u.name}</td>
                <td className="p-3 text-sm">{u.email}</td>
                <td className="p-3 text-sm">{u.department}</td>
                <td className="p-3 text-sm font-semibold">{u.grade}</td>
                <td className="p-3">{<Pill text={u.role} tone="role" />}</td>
                <td className="p-3">{u.active ? <Pill text="Active" tone="on" /> : <Pill text="Disabled" tone="off" />}</td>
                <td className="p-3">
                  <button
                    className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                    type="button"
                    onClick={() => toggleActive(u.id)}
                  >
                    {u.active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 ? (
              <tr className="border-t">
                <td className="p-6 text-sm text-neutral-500" colSpan={7}>
                  No employees match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={modalOpen}
        title="Import employees (CSV)"
        subtitle="Paste CSV content. In MVP this creates/updates employees for the contract."
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800" onClick={importCsvMock}>
              Import
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">CSV content</label>
          <textarea
            className="w-full rounded-md border p-2 text-sm min-h-[220px] font-mono"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="text-xs text-neutral-500">
            Expected columns: <span className="font-mono">name,email,department,grade,role</span>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
