"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WizardState } from "../SummaryPanel";

// Mock leave types (UI-first). Later: fetch from Supabase (contract-scoped)
type LeavePayCategory = "FULL" | "HALF" | "UNPAID";
type LeaveTypeConfig = {
  code: string;
  name: string;
  defaultDays: number | null;
  payCategory: LeavePayCategory;
  requiresReason: boolean;
  requiresAttachment: boolean;
  active: boolean;
};

const MOCK_LEAVE_TYPES: LeaveTypeConfig[] = [
  { code: "ANNUAL", name: "Annual", defaultDays: null, payCategory: "FULL", requiresReason: false, requiresAttachment: false, active: true },
  { code: "BIRTHDAY", name: "Birthday", defaultDays: 1, payCategory: "FULL", requiresReason: false, requiresAttachment: false, active: true },
  { code: "SICK_FULL", name: "Sick Leave (Full Pay)", defaultDays: null, payCategory: "FULL", requiresReason: true, requiresAttachment: true, active: true },
  { code: "SICK_HALF", name: "Sick Leave (Half Pay)", defaultDays: null, payCategory: "HALF", requiresReason: true, requiresAttachment: true, active: true },
  { code: "COMPASSIONATE", name: "Compassionate Leave", defaultDays: 3, payCategory: "FULL", requiresReason: true, requiresAttachment: false, active: true },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fromISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Mon–Fri working days for MVP
function addWorkingDays(startISO: string, workingDays: number) {
  if (!startISO) return "";
  if (workingDays <= 1) return startISO;

  const d = fromISODate(startISO);
  let remaining = workingDays - 1;

  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay(); // 0=Sun..6=Sat
    const isWeekend = dow === 0 || dow === 6;
    if (!isWeekend) remaining--;
  }

  return toISODate(d);
}

function countWorkingDays(startISO: string, endISO: string) {
  if (!startISO || !endISO) return 0;
  const start = fromISODate(startISO);
  const end = fromISODate(endISO);
  if (end < start) return 0;

  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    if (!isWeekend) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size = size / 1024;
    unit++;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function Banner({
  tone,
  children,
}: {
  tone: "info" | "warn" | "error";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : "bg-blue-50 text-blue-900 border-blue-200";

  return <div className={`rounded-md border p-2 text-xs ${cls}`}>{children}</div>;
}

type FileMeta = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
};

export default function StepSearch({
  state,
  setState,
  onSearch,
}: {
  state: WizardState;
  setState: (next: WizardState) => void;
  onSearch?: () => void;
}) {
  const leaveTypes = useMemo(() => MOCK_LEAVE_TYPES.filter((x) => x.active), []);

  const [leaveTypeCode, setLeaveTypeCode] = useState<string>(state.leaveTypeCode ?? "ANNUAL");
  const [startDate, setStartDate] = useState<string>(state.startDate ?? "");
  const [endDate, setEndDate] = useState<string>(state.endDate ?? "");
  const [reason, setReason] = useState<string>(state.reason ?? "");

  // Attachment state (UI-first)
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Track if user manually edited end date (so we don't fight them)
  const [endManuallySet, setEndManuallySet] = useState<boolean>(false);

  const selectedType = useMemo(
    () => leaveTypes.find((t) => t.code === leaveTypeCode) ?? leaveTypes[0],
    [leaveTypes, leaveTypeCode]
  );

  const requiresReason = selectedType?.requiresReason ?? false;
  const requiresAttachment = selectedType?.requiresAttachment ?? false;

  // Clear attachments when switching to a type that doesn't require attachment (optional UX)
  useEffect(() => {
    if (!requiresAttachment && files.length > 0) {
      setFiles([]);
      setState({ ...state, attachments: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiresAttachment]);

  // When leave type changes, if it has defaultDays AND user hasn't manually set end date,
  // auto-calculate end date from start date.
  useEffect(() => {
    if (!selectedType) return;
    if (!startDate) return;

    if (selectedType.defaultDays && !endManuallySet) {
      const computed = addWorkingDays(startDate, selectedType.defaultDays);
      setEndDate(computed);
    }

    // Sync wizard state basics
    setState({
      ...state,
      leaveTypeCode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveTypeCode]);

  // When start date changes, recompute end date if defaultDays exists (and not manually set)
  useEffect(() => {
    if (!selectedType) return;

    if (startDate && selectedType.defaultDays && !endManuallySet) {
      setEndDate(addWorkingDays(startDate, selectedType.defaultDays));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  const workingDays = useMemo(() => countWorkingDays(startDate, endDate), [startDate, endDate]);

  const withinCarryWindow = true; // mock until policy wiring
  const currentYearRemaining = 18; // mock
  const carryForwardRemaining = withinCarryWindow ? 4 : 0; // mock

  const blocks: string[] = [];
  const warnings: string[] = [];

  // Blocking: invalid date order
  if (startDate && endDate && fromISODate(endDate) < fromISODate(startDate)) {
    blocks.push("End date cannot be before start date.");
  }

  // Birthday leave rules (UI-first example)
  if (leaveTypeCode === "BIRTHDAY" && workingDays > 1) {
    blocks.push("Birthday leave is limited to 1 working day.");
  }

  // Optional warning for fixed duration mismatch (except birthday is blocked above)
  if (
    selectedType?.defaultDays &&
    workingDays > 0 &&
    leaveTypeCode !== "BIRTHDAY" &&
    workingDays !== selectedType.defaultDays
  ) {
    warnings.push(`${selectedType.name} default duration is ${selectedType.defaultDays} day(s). You selected ${workingDays} day(s).`);
  }

  if (withinCarryWindow && carryForwardRemaining > 0) {
    warnings.push("Carry-forward expires on Mar 31 (policy).");
  }

  // Blocking: attachment required but none uploaded
  if (requiresAttachment && files.length === 0) {
    blocks.push("Attachment is required for this leave type.");
  }

  // Blocking (UI-first): reason required but empty
  if (requiresReason && !reason.trim()) {
    blocks.push("Reason is required for this leave type.");
  }

  function pickFiles(next: FileList | null) {
    if (!next) return;

    // Avoid duplicates by (name + size + lastModified)
    const existing = new Set(files.map((f) => `${f.name}-${f.size}-${f.lastModified}`));

    const incoming = Array.from(next).filter((f) => {
      const key = `${f.name}-${f.size}-${f.lastModified}`;
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });

    const merged = [...files, ...incoming];
    setFiles(merged);

    // Save metadata into wizard state
    const meta: FileMeta[] = merged.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified,
    }));

    setState({ ...state, attachments: meta });

    // reset input to allow re-selecting the same file
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(idx: number) {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);

    const meta: FileMeta[] = next.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified,
    }));

    setState({ ...state, attachments: meta });
  }

  function runSearch() {
    const next: WizardState = {
      ...state,
      leaveTypeCode,
      startDate,
      endDate,
      reason,
      workingDays,
      withinCarryWindow,
      currentYearRemaining,
      carryForwardRemaining,
      blocks,
      warnings,
      attachments: (state.attachments ?? []), // already set when picking files
    };

    setState(next);
    onSearch?.();
  }

  const totalAttachmentBytes = useMemo(
    () => files.reduce((acc, f) => acc + (f?.size ?? 0), 0),
    [files]
  );

  return (
    <div className="space-y-4">
      <div className="border rounded-lg bg-white p-4">
        <div className="font-semibold">Plan your leave</div>
        <div className="text-sm text-neutral-500 mt-1">
          Choose a leave type and dates. We’ll calculate working days and show policy checks.
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <div className="rounded-xl border bg-white p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Leave type</label>
              <select
                className="w-full rounded-md border p-2 text-sm bg-white"
                value={leaveTypeCode}
                onChange={(e) => {
                  setLeaveTypeCode(e.target.value);
                  setEndManuallySet(false);
                }}
              >
                {leaveTypes.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs rounded-full bg-neutral-100 text-neutral-700 px-2 py-1">
                  Pay: {selectedType ? selectedType.payCategory : "—"}
                </span>
                {selectedType?.defaultDays ? (
                  <span className="text-xs rounded-full bg-blue-50 text-blue-900 border border-blue-200 px-2 py-1">
                    Default: {selectedType.defaultDays} day(s)
                  </span>
                ) : (
                  <span className="text-xs rounded-full bg-neutral-100 text-neutral-600 px-2 py-1">
                    No default duration
                  </span>
                )}
              </div>

              {requiresAttachment ? (
                <div className="mt-2 text-xs text-neutral-500">
                  This leave type requires a supporting document (e.g., medical certificate).
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Reason {requiresReason ? <span className="text-red-600">*</span> : <span className="text-neutral-400">(optional)</span>}
              </label>
              <input
                className="w-full rounded-md border p-2 text-sm"
                placeholder={requiresReason ? "Required for this leave type" : "Optional"}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Start date</label>
              <input
                className="w-full rounded-md border p-2 text-sm"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {selectedType?.defaultDays ? (
                <div className="text-xs text-neutral-500">
                  End date will auto-fill based on {selectedType.defaultDays} working day(s) unless you override it.
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">End date</label>
              <input
                className="w-full rounded-md border p-2 text-sm"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setEndManuallySet(true);
                }}
              />
              {endManuallySet && selectedType?.defaultDays ? (
                <button
                  type="button"
                  className="mt-2 text-xs underline text-neutral-700 hover:text-neutral-900"
                  onClick={() => {
                    setEndManuallySet(false);
                    if (startDate && selectedType.defaultDays) {
                      setEndDate(addWorkingDays(startDate, selectedType.defaultDays));
                    }
                  }}
                >
                  Reset end date to default duration
                </button>
              ) : null}
            </div>
          </div>

          {/* ✅ Real Attachment UI */}
          {requiresAttachment ? (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-sm">
                    Attachment <span className="text-red-600">*</span>
                  </div>
                  <div className="text-sm text-neutral-500 mt-1">
                    Upload supporting document(s). For MVP this stays local; later it will upload to Supabase Storage.
                  </div>
                </div>

                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => pickFiles(e.target.files)}
              />

              {files.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-neutral-500">
                  No files uploaded yet. Click <span className="font-medium">Upload</span> to add documents.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-neutral-500">
                    {files.length} file(s) • Total: {formatBytes(totalAttachmentBytes)}
                  </div>

                  <div className="divide-y rounded-md border">
                    {files.map((f, idx) => (
                      <div
                        key={`${f.name}-${f.size}-${f.lastModified}`}
                        className="p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{f.name}</div>
                          <div className="text-xs text-neutral-500">
                            {formatBytes(f.size)}
                            {f.type ? ` • ${f.type}` : ""}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
                          onClick={() => removeFile(idx)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-neutral-500">
                    Tip: You can upload multiple documents (e.g., medical certificate + additional notes).
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
              onClick={() => {
                setLeaveTypeCode("ANNUAL");
                setStartDate("");
                setEndDate("");
                setReason("");
                setEndManuallySet(false);
                setFiles([]);
                setState({ ...state, attachments: [] });
              }}
            >
              Reset
            </button>

            <button
              type="button"
              className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
              disabled={!leaveTypeCode || !startDate || !endDate || blocks.length > 0}
              onClick={runSearch}
            >
              Search availability
            </button>
          </div>
        </div>

        {/* Live results panel */}
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <div className="font-semibold">Live results</div>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Working days</span>
              <span className="font-semibold">{workingDays || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Current-year balance</span>
              <span className="font-semibold">{currentYearRemaining}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Carry-forward</span>
              <span className="font-semibold">{carryForwardRemaining}</span>
            </div>

            <div className="pt-2 border-t text-xs text-neutral-500">
              Mon–Fri working days for MVP. Holidays will come later.
            </div>
          </div>

          {blocks.length ? (
            <div className="space-y-2">
              {blocks.map((b, i) => (
                <Banner key={i} tone="error">
                  {b}
                </Banner>
              ))}
            </div>
          ) : null}

          {warnings.length ? (
            <div className="space-y-2">
              {warnings.map((w, i) => (
                <Banner key={i} tone="warn">
                  {w}
                </Banner>
              ))}
            </div>
          ) : null}

          <div className="rounded-lg border p-4">
            <div className="font-medium text-sm">Policy hints (mock)</div>
            <ul className="mt-2 text-sm text-neutral-700 list-disc pl-5 space-y-1">
              <li>Leave year: Jan 1 – Dec 31.</li>
              <li>Carry-forward usable until Mar 31 (configurable).</li>
              <li>Escalation after 7 days of no action (approvals).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
