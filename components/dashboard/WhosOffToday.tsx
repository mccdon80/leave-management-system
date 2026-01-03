// components/dashboard/WhosOffToday.tsx
"use client";

type OffPerson = {
  name: string;
  department: string;
  leaveType: string;
  status: "APPROVED" | "PENDING";
};

const mockOffToday: OffPerson[] = [
  { name: "Sara Ali", department: "IT", leaveType: "Annual", status: "APPROVED" },
  { name: "Omar Khan", department: "IT", leaveType: "Sick", status: "APPROVED" },
  { name: "Lina Noor", department: "IT", leaveType: "Annual", status: "PENDING" },
];

export default function WhosOffToday() {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">Who’s off today</div>
          <div className="text-sm text-neutral-500 mt-1">
            Department visibility (mock).
          </div>
        </div>
        <span className="text-xs rounded-full bg-neutral-100 text-neutral-700 px-2 py-1">
          Today
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {mockOffToday.map((p, i) => (
          <div key={i} className="flex items-start justify-between gap-3">
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

        {mockOffToday.length === 0 ? (
          <div className="text-sm text-neutral-500">No one is off today.</div>
        ) : null}
      </div>
    </div>
  );
}
