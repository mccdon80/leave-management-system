// app/(app)/admin/page.tsx
import AdminConsole from "@/components/admin/AdminConsole";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Contract configuration for leave types, entitlements, carry-forward, approvals, employees, and audit logs.
        </p>
      </div>

      <AdminConsole />
    </div>
  );
}
