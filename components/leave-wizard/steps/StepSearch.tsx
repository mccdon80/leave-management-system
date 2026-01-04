"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WizardState } from "../SummaryPanel";

type LeaveTypeRow = { code: string; name: string };

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
  leaveTypes,
  leaveTypesLoading,
  leaveTypesError,
}: {
  state: WizardState;
  setState: (next: WizardState) => void;
  onSearch?: () => void;
  leaveTypes: LeaveTypeRow[];
  leaveTypesLoading?: boolean;
  leaveTypesError?: string | null;
}) {
  const activeLeaveTypes = useMemo(() => (leaveTypes ?? []).filter(Boolean), [leaveTypes]);

  // ✅ use DB code
  const [leaveTypeCode, setLeaveTypeCode] = useState<string>(state.leaveTypeCode ?? "");

  const [startDate, setStartDate] = useState<string>(state.startDate ?? "");
  const [endDate, setEndDate] = useState<string>(state.endDate ?? "");
  const [reason, setReason] = useState<string>(state.reason ?? "");

  // Attachment state (UI-first)
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Track if user manually edited end date (so we don't fight them)
  const [endManuallySet, setEndManuallySet] = useState<boolean>(false);

  // Sync local state from wizard when navigating back/forward
  useEffect(() => {
    setLeaveTypeCode(state.leaveTypeCode ?? "");
    setStartDate(state.startDate ?? "");
    setEndDate(state.endDate ?? "");
    setReason(state.reason ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.leaveTypeCode, state.startDate, state.endDate, state.reason]);

  // If leave types load and user hasn't picked any yet, choose first
  useEffect(() => {
    if (!leaveTypeCode && activeLeaveTypes.length > 0) {
      const first = activeLeaveTypes[0].code;
      setLeaveTypeCode(first);
      setState({ ...state, leaveTypeCode: first });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeaveTypes.length]);

  const workingDays = useMemo(() => countWorkingDays(startDate, endDate), [startDate, endDate]);

  const withinCarryWindow = true; // mock until policy wiring
  const currentYearRemaining = 18; // mock
  const carryForwardRemaining = withinCarryWindow ? 4 : 0; // mock

  const blocks: string[] = [];
  const warnings: string[] = [];

  if (!leaveTypeCode) {
    blocks.push("Please select a leave type.");
  }

  // Blocking: invalid date order
  if (startDate && endDate && fromISODate(endDate) < fromISODate(startDate)) {
    blocks.push("End date cannot be before start date.");
  }

  if (withinCarryWindow && carryForwardRemaining > 0) {
    warnings.push("Carry-forward expires on Mar 31 (policy).");
  }

  function pickFiles(next: FileList | null) {
    if (!next) return;

    const existing = new Set(files.map((f) => `${f.name}-${f.size}-${f.lastModified}`));

    const incoming = Array.from(next).filter((f) => {
      const key = `${f.name}-${f.size}-${f.lastModified}`;
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });

    const merged = [...files, ...incoming];
    setFiles(merged);

    const meta: FileMeta[] = merged.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified,
    }));

    setState({ ...state, attachments: meta });

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
      leaveTypeCode, // ✅ DB code from dropdown
      startDate,
      endDate,
      reason,
      workingDays,
      withinCarryWindow,
      currentYearRemaining,
      carryForwardRemaining,
      blocks,
      warnings,
      attachments: state.attachments ?? [],
    };

    setState(next);
    onSearch?.();
  }

  const totalAttachmentBytes = useMemo(
    () => files.reduce((acc, f) => acc + (f?.size ?? 0), 0),
    [files]
  );

  const selectedLeaveTypeName =
    activeLeaveTypes.find((x) => x.code === leaveTypeCode)?.name ?? leaveTypeCode ?? "—";

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

              {leaveTypesLoading ? (
                <div className="text-sm text-neutral-500">Loading leave types…</div>
              ) : leaveTypesError ? (
                <div className="text-sm text-red-600">{leaveTypesError}</div>
              ) : null}

              <select
                className="w-full rounded-md border p-2 text-sm bg-white"
                value={leaveTypeCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setLeaveTypeCode(code);
                  setState({ ...state, leaveTypeCode: code });
                  setEndManuallySet(false);
                }}
                disabled={leaveTypesLoading || activeLeaveTypes.length === 0}
              >
                {activeLeaveTypes.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>

              <div className="text-xs text-neutral-500 mt-2">
                Selected: <span className="font-medium">{selectedLeaveTypeName}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Reason <span className="text-neutral-400">(optional for now)</span>
              </label>
              <input
                className="w-full rounded-md border p-2 text-sm"
                placeholder="Optional (rules enforced in Step 2 / Review later)"
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
              {endManuallySet ? (
                <button
                  type="button"
                  className="mt-2 text-xs underline text-neutral-700 hover:text-neutral-900"
                  onClick={() => {
                    setEndManuallySet(false);
                    if (startDate) setEndDate(addWorkingDays(startDate, 1));
                  }}
                >
                  Reset end date
                </button>
              ) : null}
            </div>
          </div>

          {/* Attachment UI (still local for MVP) */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-sm">Attachment (optional)</div>
                <div className="text-sm text-neutral-500 mt-1">
                  For MVP this stays local; later we’ll upload to Supabase Storage.
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
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setReason("");
                setEndManuallySet(false);
                setFiles([]);
                setState({ ...state, attachments: [], startDate: "", endDate: "", reason: "" });
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
