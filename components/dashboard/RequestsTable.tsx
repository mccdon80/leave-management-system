"use client";

import Link from "next/link";
import StatusBadge from "@/components/shared/StatusBadge";

export type RequestRow = {
  id: string;
  bookingRef: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  approver: string;
};

function th(cls: string, label: string) {
  return <th className={["text-left text-xs font-medium text-neutral-500", cls].join(" ")}>{label}</th>;
}

export default function RequestsTable({ rows, loading }: { rows: RequestRow[]; loading?: boolean }) {
  return (
    <div className="rounded-xl border bg-white">
      <div className="p-4 flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Recent requests</div>
          <div className="text-sm text-neutral-500 mt-1">Your latest leave requests from the database.</div>
        </div>

        <Link
          href="/leave/new"
          className="inline-flex items-center rounded-md bg-neutral-900 text-white px-3 py-2 text-sm hover:bg-neutral-800"
        >
          Book leave
        </Link>
      </div>

      <div className="border-t overflow-x-auto">
        <table className="min-w-225 w-full">
          <thead className="bg-neutral-50">
            <tr className="text-xs">
              {th("p-3", "Booking")}
              {th("p-3", "Type")}
              {th("p-3", "Dates")}
              {th("p-3", "Days")}
              {th("p-3", "Status")}
              {th("p-3", "Approver")}
              {th("p-3", "Action")}
            </tr>
          </thead>

          <tbody>
            {loading && (!rows || rows.length === 0) ? (
              <tr className="border-t">
                <td className="p-6 text-sm text-neutral-500" colSpan={7}>
                  Loading requests…
                </td>
              </tr>
            ) : null}

            {!loading && (!rows || rows.length === 0) ? (
              <tr className="border-t">
                <td className="p-6 text-sm text-neutral-500" colSpan={7}>
                  No requests yet.
                </td>
              </tr>
            ) : null}

            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">
                  <div className="font-mono text-sm font-semibold">{r.bookingRef}</div>
                  <div className="text-xs text-neutral-500">Request ID: {r.id}</div>
                </td>

                <td className="p-3 text-sm">{r.leaveType}</td>

                <td className="p-3 text-sm">
                  <div className="font-medium">
                    {r.startDate} → {r.endDate}
                  </div>
                  <div className="text-xs text-neutral-500">Working days (Mon–Fri)</div>
                </td>

                <td className="p-3 text-sm font-medium">{r.workingDays}</td>

                <td className="p-3">
                  <StatusBadge status={r.status} />
                </td>

                <td className="p-3 text-sm">{r.approver}</td>

                <td className="p-3">
                  <Link href={`/leave/${r.id}`} className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-neutral-50">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
