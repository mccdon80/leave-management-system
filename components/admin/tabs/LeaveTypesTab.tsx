"use client";

import { useMemo, useState } from "react";
import AdminModal from "../AdminModal";
import type { LeavePayCategory, LeaveType } from "../mockData";

function Badge({ text, tone }: { text: string; tone: "on" | "off" | "info" }) {
  const cls =
    tone === "on"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "off"
      ? "bg-neutral-100 text-neutral-600 border-neutral-200"
      : "bg-blue-50 text-blue-900 border-blue-200";

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs border ${cls}`}>{text}</span>;
}

function payLabel(p: LeavePayCategory) {
  if (p === "FULL") return "Full pay";
  if (p === "HALF") return "Half pay";
  return "Unpaid";
}

export default function LeaveTypesTab({
  data,
  setData,
}: {
  data: LeaveType[];
  setData: (next: LeaveType[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);

  const [form, setForm] = useState<LeaveType>({
    id: "",
    code: "",
    name: "",
    defaultDays: null,
    payCategory: "FULL",
    requiresReason: false,
    requiresAttachment: false,
    active: true,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.code.toLowerCase().includes(q) ||
        payLabel(x.payCategory).toLowerCase().includes(q)
    );
  }, [data, query]);

  function openCreate() {
    setEditing(null);
    setForm({
      id: "",
      code: "",
      name: "",
      defaultDays: null,
      payCategory: "FULL",
      requiresReason: false,
      requiresAttachment: false,
      active: true,
    });
    setModalOpen(true);
  }

  function openEdit(row: LeaveType) {
    setEditing(row);
    setForm(row);
    setModalOpen(true);
  }

  function save() {
    const cleaned: LeaveType = {
      ...form,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      defaultDays: form.defaultDays === null ? null : Math.max(0, Number(form.defaultDays)),
    };

    if (editing) {
      setData(data.map((x) => (x.id === editing.id ? cleaned : x)));
    } else {
      setData([{ ...cleaned, id: `lt-${Date.now()}` }, ...data]);
    }

    setModalOpen(false);
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-4 border-b flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-semibold">Leave Types</div>
          <div className="text-sm text-neutral-500 mt-1">
            Add leave types like Sick (half-pay), Compassionate, etc., including optional default day limits.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="rounded-md border p-2 text-sm"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="rounded-md bg-neutral-900 text-white px-3 py-2 text-sm hover:bg-neutral-800"
            onClick={openCreate}
          >
            Add type
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-275 w-full">
          <thead className="bg-neutral-50">
            <tr className="text-xs text-neutral-500">
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Default days</th>
              <th className="p-3 text-left">Pay</th>
              <th className="p-3 text-left">Reason</th>
              <th className="p-3 text-left">Attachment</th>
              <th className="p-3 text-left">Active</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-mono text-sm font-semibold">{r.code}</td>
                <td className="p-3 text-sm">{r.name}</td>

                <td className="p-3">
                  {r.defaultDays === null ? (
                    <Badge text="No limit" tone="info" />
                  ) : (
                    <Badge text={`${r.defaultDays} day(s)`} tone="info" />
                  )}
                </td>

                <td className="p-3">
                  <Badge text={payLabel(r.payCategory)} tone="info" />
                </td>

                <td className="p-3">{r.requiresReason ? <Badge text="Required" tone="on" /> : <Badge text="Optional" tone="off" />}</td>
                <td className="p-3">{r.requiresAttachment ? <Badge text="Required" tone="on" /> : <Badge text="Optional" tone="off" />}</td>
                <td className="p-3">{r.active ? <Badge text="Active" tone="on" /> : <Badge text="Disabled" tone="off" />}</td>

                <td className="p-3">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                    onClick={() => openEdit(r)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 ? (
              <tr className="border-t">
                <td className="p-6 text-sm text-neutral-500" colSpan={8}>
                  No leave types found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={modalOpen}
        title={editing ? "Edit leave type" : "Add leave type"}
        subtitle="Default days is optional. Use it for fixed allowances (e.g., Birthday=1, Compassionate=3)."
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
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Code</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              placeholder="SICK_HALF"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              placeholder="Sick Leave (Half Pay)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Default days (optional)</label>
            <input
              className="w-full rounded-md border p-2 text-sm"
              type="number"
              placeholder="Leave blank for no limit"
              value={form.defaultDays ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  defaultDays: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <div className="text-xs text-neutral-500">
              If set, the wizard can pre-fill End Date = Start Date + (defaultDays-1) working days.
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Pay category</label>
            <select
              className="w-full rounded-md border p-2 text-sm bg-white"
              value={form.payCategory}
              onChange={(e) => setForm({ ...form, payCategory: e.target.value as any })}
            >
              <option value="FULL">Full pay</option>
              <option value="HALF">Half pay</option>
              <option value="UNPAID">Unpaid</option>
            </select>
            <div className="text-xs text-neutral-500">
              UI label only for now; payroll integration is out of scope for MVP.
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requiresReason}
              onChange={(e) => setForm({ ...form, requiresReason: e.target.checked })}
            />
            Requires reason
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requiresAttachment}
              onChange={(e) => setForm({ ...form, requiresAttachment: e.target.checked })}
            />
            Requires attachment
          </label>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active (available to staff)
          </label>

          <div className="md:col-span-2 text-xs text-neutral-500">
            Next: integrate leave type selection in Step 1 so “defaultDays” can prefill the date range.
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
