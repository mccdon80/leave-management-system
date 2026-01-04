"use client";

export type OffPerson = {
  name: string;
  department: string;
  leaveType: string;
  status: "APPROVED" | "PENDING";
};

export default function WhosOffToday({
  items,
  loading,
  hint,
}: {
  items: OffPerson[];
  loading?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">Who’s off today</div>
          <div className="text-sm text-neutral-500 mt-1">Based on database access rules (RLS).</div>
        </div>
        <span className="text-xs rounded-full bg-neutral-100 text-neutral-700 px-2 py-1">Today</span>
      </div>

      {hint ? <div className="mt-3 text-xs text-neutral-500">{hint}</div> : null}

      <div className="mt-4 space-y-3">
        {loading && (!items || items.length === 0) ? <div className="text-sm text-neutral-500">Loading…</div> : null}

        {!loading && (!items || items.length === 0) ? <div className="text-sm text-neutral-500">No one is off today.</div> : null}

        {(items ?? []).map((p, i) => (
          <div key={`${p.name}-${i}`} className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-neutral-500">
                {p.department} • {p.leaveType}
              </div>
            </div>
            <span
              className={[
                "text-xs rounded-full px-2 py-1 border",
                p.status === "APPROVED"
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-amber-50 text-amber-900 border-amber-200",
              ].join(" ")}
            >
              {p.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
