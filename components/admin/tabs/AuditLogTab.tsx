// components/admin/tabs/AuditLogTab.tsx
"use client";

import type { AuditLogRow } from "../mockData";

export default function AuditLogTab({ data }: { data: AuditLogRow[] }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-4 border-b">
        <div className="font-semibold">Audit Log</div>
        <div className="text-sm text-neutral-500 mt-1">
          Contract configuration changes and overrides (mock).
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-250 w-full">
          <thead className="bg-neutral-50">
            <tr className="text-xs text-neutral-500">
              <th className="p-3 text-left">Time</th>
              <th className="p-3 text-left">Actor</th>
              <th className="p-3 text-left">Action</th>
              <th className="p-3 text-left">Target</th>
              <th className="p-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 text-sm font-mono">{r.time}</td>
                <td className="p-3 text-sm">{r.actor}</td>
                <td className="p-3 text-sm font-medium">{r.action}</td>
                <td className="p-3 text-sm">{r.target}</td>
                <td className="p-3 text-sm text-neutral-700">{r.details}</td>
              </tr>
            ))}

            {data.length === 0 ? (
              <tr className="border-t">
                <td className="p-6 text-sm text-neutral-500" colSpan={5}>
                  No audit entries yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t text-xs text-neutral-500">
        Later: this will be immutable, append-only, and visible to GM/Admin only (via RLS).
      </div>
    </div>
  );
}
