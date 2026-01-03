"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "ESCALATED";

type TimelineEvent = {
  id: string;
  at: string; // display timestamp
  title: string;
  description?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
};

type AttachmentMeta = {
  name: string;
  size: number;
  type: string;
};

type ApprovalStep = {
  role: "LM" | "GM";
  approver: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  actedAt?: string;
  note?: string;
};

type LeaveRequestDetails = {
  id: string;
  bookingRef: string;

  contractName: string;
  department: string;

  employeeName: string;
  employeeEmail: string;

  leaveTypeName: string;
  leaveTypeCode: string;
  payCategory: "FULL" | "HALF" | "UNPAID";

  startDate: string;
  endDate: string;
  workingDays: number;

  selectedFare: "SMART" | "CURRENT_ONLY" | "CARRY_ONLY";
  breakdown: { carryForward: number; currentYear: number };

  status: LeaveStatus;

  submittedAt: string;
  slaDueAt: string; // for current approver SLA

  approvers: ApprovalStep[];
  attachments: AttachmentMeta[];

  policyNotes: string[];
  audit: TimelineEvent[];
};

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "good" | "warn" | "bad" | "info";
  children: React.ReactNode;
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "info"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : "bg-neutral-100 text-neutral-700 border-neutral-200";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${cls}`}>
      {children}
    </span>
  );
}

function statusTone(s: LeaveStatus): "neutral" | "good" | "warn" | "bad" | "info" {
  if (s === "APPROVED") return "good";
  if (s === "PENDING") return "warn";
  if (s === "REJECTED") return "bad";
  if (s === "CANCELLED") return "neutral";
  if (s === "ESCALATED") return "info";
  return "neutral";
}

function payLabel(p: "FULL" | "HALF" | "UNPAID") {
  if (p === "FULL") return "Full pay";
  if (p === "HALF") return "Half pay";
  return "Unpaid";
}

function fareLabel(f: LeaveRequestDetails["selectedFare"]) {
  if (f === "SMART") return "Smart Apply";
  if (f === "CURRENT_ONLY") return "Current-year Only";
  return "Carry-forward Only";
}

function toneDot(tone: TimelineEvent["tone"]) {
  const cls =
    tone === "good"
      ? "bg-emerald-600"
      : tone === "warn"
      ? "bg-amber-600"
      : tone === "bad"
      ? "bg-red-600"
      : tone === "info"
      ? "bg-blue-600"
      : "bg-neutral-400";

  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />;
}

function MiniRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-900 text-right">{value}</span>
    </div>
  );
}

function mockFetchLeave(id: string): LeaveRequestDetails {
  // UI-first: return mock by id
  const isPending = true;

  return {
    id,
    bookingRef: `LV-2026-${String(123).padStart(6, "0")}`,
    contractName: "Demo Contract (UAE)",
    department: "IT",
    employeeName: "Don Benaid",
    employeeEmail: "don@example.com",

    leaveTypeName: "Sick Leave (Half Pay)",
    leaveTypeCode: "SICK_HALF",
    payCategory: "HALF",

    startDate: "2026-01-05",
    endDate: "2026-01-07",
    workingDays: 3,

    selectedFare: "SMART",
    breakdown: { carryForward: 1, currentYear: 2 },

    status: isPending ? "PENDING" : "APPROVED",

    submittedAt: "2026-01-03 10:15",
    slaDueAt: "2026-01-10 10:15",

    approvers: [
      { role: "LM", approver: "Ahmed (Line Manager)", status: "PENDING" },
      { role: "GM", approver: "Fatima (General Manager)", status: "PENDING" },
    ],

    attachments: [
      { name: "medical_certificate.pdf", size: 265_000, type: "application/pdf" },
      { name: "doctor_note.jpg", size: 820_000, type: "image/jpeg" },
    ],

    policyNotes: [
      "Leave year: Jan 1 – Dec 31.",
      "Carry-forward usable until Mar 31 (configurable).",
      "Approvals escalate after 7 days of no action.",
    ],

    audit: [
      {
        id: "e1",
        at: "2026-01-03 10:15",
        title: "Request submitted",
        description: "Email notification sent to Approver 1 (Line Manager).",
        tone: "info",
      },
      {
        id: "e2",
        at: "2026-01-03 10:16",
        title: "SLA timer started",
        description: "Due by 2026-01-10 10:15 (7 days).",
        tone: "warn",
      },
    ],
  };
}

export default function LeaveDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const request = useMemo(() => mockFetchLeave(params.id), [params.id]);

  // UI-only local state for modals/actions
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showAmend, setShowAmend] = useState(false);
  const [amendNote, setAmendNote] = useState("");

  const canCancel = request.status === "PENDING";
  const canAmend = request.status === "PENDING";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">Manage Booking</h1>
            <Badge tone={statusTone(request.status)}>{request.status}</Badge>
            <Badge tone="info">{request.bookingRef}</Badge>
          </div>
          <p className="text-sm text-neutral-500">
            View request details, approvals, attachments, and timeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/leave/new"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Book another leave
          </Link>

          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
            onClick={() => router.push("/calendar")}
            type="button"
          >
            View calendar
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Left */}
        <div className="space-y-4">
          {/* Itinerary card */}
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">Itinerary</div>
                <div className="text-sm text-neutral-500 mt-1">
                  {request.leaveTypeName} • {request.startDate} → {request.endDate}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Badge tone="info">{payLabel(request.payCategory)}</Badge>
                <Badge tone="neutral">{fareLabel(request.selectedFare)}</Badge>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-medium">Details</div>
                <MiniRow label="Contract" value={request.contractName} />
                <MiniRow label="Department" value={request.department} />
                <MiniRow label="Working days" value={request.workingDays} />
                <MiniRow label="Submitted" value={request.submittedAt} />
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-medium">Consumption</div>
                <MiniRow label="Carry-forward" value={`${request.breakdown.carryForward} day(s)`} />
                <MiniRow label="Current-year" value={`${request.breakdown.currentYear} day(s)`} />
                <div className="pt-2 border-t text-xs text-neutral-500">
                  These values come from the “fare” selection (Step 2).
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border p-4">
              <div className="text-sm font-medium">Policy notes</div>
              <ul className="mt-2 text-sm text-neutral-700 list-disc pl-5 space-y-1">
                {request.policyNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Timeline card */}
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">Timeline</div>
                <div className="text-sm text-neutral-500 mt-1">
                  Booking history (audit-style).
                </div>
              </div>
              <Badge tone="warn">SLA due: {request.slaDueAt}</Badge>
            </div>

            <div className="mt-4 space-y-3">
              {request.audit.map((e) => (
                <div key={e.id} className="flex gap-3">
                  <div className="pt-1">{toneDot(e.tone)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-neutral-500">{e.at}</div>
                    </div>
                    {e.description ? (
                      <div className="text-sm text-neutral-600 mt-1">
                        {e.description}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t pt-3 text-xs text-neutral-500">
              Later: add “Viewed” event, reminder events, escalation event, and who performed each action.
            </div>
          </div>

          {/* Attachments card */}
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">Attachments</div>
                <div className="text-sm text-neutral-500 mt-1">
                  Supporting documents (stored in Supabase Storage later).
                </div>
              </div>

              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={() => alert("UI-first: Upload will be enabled when Supabase Storage is wired.")}
              >
                Upload more
              </button>
            </div>

            {request.attachments.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed p-4 text-sm text-neutral-500">
                No attachments.
              </div>
            ) : (
              <div className="mt-3 divide-y rounded-md border">
                {request.attachments.map((a, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-xs text-neutral-500">
                        {formatBytes(a.size)}{a.type ? ` • ${a.type}` : ""}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                        type="button"
                        onClick={() => alert("UI-first: Preview/download later via signed URL.")}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="rounded-xl border bg-white p-4">
            <div className="font-semibold">Actions</div>
            <div className="text-sm text-neutral-500 mt-1">
              Manage your booking before it is approved.
            </div>

            <div className="mt-4 flex flex-col gap-2 md:flex-row">
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
                disabled={!canAmend}
                onClick={() => setShowAmend(true)}
              >
                Request amendment
              </button>

              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
                disabled={!canCancel}
                onClick={() => setShowCancel(true)}
              >
                Cancel request
              </button>
            </div>

            {!canCancel ? (
              <div className="mt-3 text-xs text-neutral-500">
                Cancel is only available while the request is pending.
              </div>
            ) : null}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Approvals */}
          <div className="rounded-xl border bg-white p-4">
            <div className="font-semibold">Approvals</div>
            <div className="text-sm text-neutral-500 mt-1">
              Current approval chain (mock).
            </div>

            <div className="mt-4 space-y-3">
              {request.approvers.map((a, idx) => {
                const tone =
                  a.status === "APPROVED" ? "good" : a.status === "REJECTED" ? "bad" : "warn";
                return (
                  <div key={idx} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {a.role === "LM" ? "Line Manager" : "General Manager"}
                        </div>
                        <div className="text-sm text-neutral-600 mt-1">{a.approver}</div>
                      </div>
                      <Badge tone={tone}>{a.status}</Badge>
                    </div>

                    {a.actedAt ? (
                      <div className="mt-2 text-xs text-neutral-500">Acted at: {a.actedAt}</div>
                    ) : null}

                    {a.note ? (
                      <div className="mt-2 text-xs text-neutral-600">Note: {a.note}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border p-3 bg-amber-50 border-amber-200">
              <div className="text-sm font-medium text-amber-900">SLA countdown</div>
              <div className="text-sm text-amber-900 mt-1">
                Due by <span className="font-semibold">{request.slaDueAt}</span>
              </div>
              <div className="text-xs text-amber-900/80 mt-2">
                If no action is taken, the system escalates according to routing rules.
              </div>
            </div>
          </div>

          {/* People */}
          <div className="rounded-xl border bg-white p-4">
            <div className="font-semibold">People</div>
            <div className="text-sm text-neutral-500 mt-1">Request owner details.</div>

            <div className="mt-4 space-y-2">
              <MiniRow label="Employee" value={request.employeeName} />
              <MiniRow label="Email" value={request.employeeEmail} />
              <MiniRow label="Department" value={request.department} />
            </div>

            <div className="mt-4 border-t pt-3 text-xs text-neutral-500">
              Later: show department context (“Who’s off”) and conflicts.
            </div>
          </div>
        </div>
      </div>

      {/* Cancel modal */}
      {showCancel ? (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowCancel(false)}
            aria-label="Close"
          />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white shadow-xl overflow-hidden">
            <div className="p-4 border-b">
              <div className="font-semibold">Cancel request</div>
              <div className="text-sm text-neutral-500 mt-1">
                This will cancel the pending booking request (UI-first).
              </div>
            </div>

            <div className="p-4 space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <textarea
                className="w-full rounded-md border p-2 text-sm min-h-27.5"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Add a short reason for audit trail…"
              />
              <div className="text-xs text-neutral-500">
                Later: this will create an audit event and notify approvers.
              </div>
            </div>

            <div className="p-4 border-t flex items-center justify-end gap-2">
              <button
                className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={() => setShowCancel(false)}
                type="button"
              >
                Close
              </button>
              <button
                className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800"
                onClick={() => {
                  alert("UI-first: Cancel action will be wired to Supabase later.");
                  setShowCancel(false);
                }}
                type="button"
              >
                Confirm cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Amendment modal */}
      {showAmend ? (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowAmend(false)}
            aria-label="Close"
          />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white shadow-xl overflow-hidden">
            <div className="p-4 border-b">
              <div className="font-semibold">Request amendment</div>
              <div className="text-sm text-neutral-500 mt-1">
                Ask the approver to amend details (dates/type/notes).
              </div>
            </div>

            <div className="p-4 space-y-2">
              <label className="text-sm font-medium">Amendment request</label>
              <textarea
                className="w-full rounded-md border p-2 text-sm min-h-35"
                value={amendNote}
                onChange={(e) => setAmendNote(e.target.value)}
                placeholder="Example: Please adjust end date to Jan 8 due to medical follow-up…"
              />
              <div className="text-xs text-neutral-500">
                Later: this will notify the current approver and create an audit entry.
              </div>
            </div>

            <div className="p-4 border-t flex items-center justify-end gap-2">
              <button
                className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={() => setShowAmend(false)}
                type="button"
              >
                Close
              </button>
              <button
                className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800"
                onClick={() => {
                  alert("UI-first: Amendment request will be wired to Supabase + email later.");
                  setShowAmend(false);
                }}
                type="button"
              >
                Send request
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
