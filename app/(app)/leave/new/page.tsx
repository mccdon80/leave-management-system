import LeaveWizard from "@/components/leave-wizard/LeaveWizard";

export default function NewLeaveWizardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Book Leave</h1>
        <p className="text-sm text-neutral-500">
          Plan → choose option → review → confirm (flight-style booking flow).
        </p>
      </div>

      <LeaveWizard />
    </div>
  );
}
