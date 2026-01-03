// components/admin/tabs/EntitlementsTab.tsx
"use client";

import { useState } from "react";
import AdminModal from "../AdminModal";
import type { GradeEntitlement } from "../mockData";

export default function EntitlementsTab({
  data,
  setData,
}: {
  data: GradeEntitlement[];
  setData: (next: GradeEntitlement[]) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GradeEntitlement | null>(null);
  const [form, setForm] = useState<GradeEntitlement>({ id: "", gradeMin: 1, gradeMax: 15, annualDays: 22 });

  function openCreate() {
    setEditing(null);
    setForm({ id: "", gradeMin: 1, gradeMax: 15, annualDays: 22 });
    setModalOpen(true);
  }

  function openEdit(r: GradeEntitlement) {
    setEditing(r);
    setForm(r);
    setModalOpen(true);
  }

  function save() {
    if (editing) {
      setData(data.map((x) => (x.id === editing.id ? form : x)));
    } else {
      setData([{ ...form, id: `ge-${Date.now()}` }, ...data]);
    }
    setModalOpen(false);
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-4 border-b flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Entitlements</div>
          <div className="text-sm text-neutral-500 mt-1">
            Configure annual leave days by grade ranges (UAE contract rules).
          </div>
        </div>

        <button
          className="rounded-md bg-neutral-900 text-white px-3 py-2 text-sm hover:bg-neutral-800"
          onClick={openCreate}
          type="button"
        >
          Add rule
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-175 w-full">
          <thead className="bg-neutral-50">
            <tr className="text-xs text-neutral-500">
              <th className="p-3 text-left">Grade min</th>
              <th className="p-3 text-left">Grade max</th>
              <th className="p-3 text-left">Annual days</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 text-sm font-medium">{r.gradeMin}</td>
                <td className="p-3 text-sm font-medium">{r.gradeMax}</td>
                <td className="p-3 text-sm font-semibold">{r.annualDays}</td>
                <td className="p-3">
                  <button
                    className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                    onClick={() => openEdit(r)}
                    type="button"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}

            {data.length === 0 ? (
              <tr className="border-t">
                <td className="p-6 text-sm text-neutral-500" colSpan={4}>
                  No entitlement rules configured.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={modalOpen}
        title={editing ? "Edit entitlement rule" : "Add entitlement rule"}
        subtitle="These rules determine annual leave entitlement by grade range."
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800" onClick={save}>
              Save
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Grade min</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              type="number"
              value={form.gradeMin}
              onChange={(e) => setForm({ ...form, gradeMin: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Grade max</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              type="number"
              value={form.gradeMax}
              onChange={(e) => setForm({ ...form, gradeMax: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Annual days</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              type="number"
              value={form.annualDays}
              onChange={(e) => setForm({ ...form, annualDays: Number(e.target.value) })}
            />
          </div>

          <div className="md:col-span-3 text-xs text-neutral-500">
            Validate ranges later (no overlap, min ≤ max) in server actions + DB constraints.
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
