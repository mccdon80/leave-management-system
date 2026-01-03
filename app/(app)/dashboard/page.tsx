// app/(app)/dashboard/page.tsx
import BalanceCards from "@/components/dashboard/BalanceCards";
import RequestsTable from "@/components/dashboard/RequestsTable";
import WhosOffToday from "@/components/dashboard/WhosOffToday";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            View balances, recent requests, and team availability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/calendar"
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            View calendar
          </Link>
          <Link
            href="/leave/new"
            className="inline-flex items-center rounded-md bg-neutral-900 text-white px-3 py-2 text-sm hover:bg-neutral-800"
          >
            Book leave
          </Link>
        </div>
      </div>

      {/* Balance cards */}
      <BalanceCards />

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <RequestsTable />
        <div className="space-y-4">
          <WhosOffToday />

          <div className="rounded-xl border bg-white p-4">
            <div className="font-semibold">Quick tips</div>
            <ul className="mt-2 text-sm text-neutral-700 list-disc pl-5 space-y-1">
              <li>Use <span className="font-medium">Smart Apply</span> to consume carry-forward before expiry.</li>
              <li>Check the calendar before booking to avoid team conflicts.</li>
              <li>Pending approvals escalate after 7 days (policy).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
