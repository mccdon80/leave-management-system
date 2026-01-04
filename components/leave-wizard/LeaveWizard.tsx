"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

import Stepper from "./Stepper";
import SummaryPanel, { type WizardState } from "./SummaryPanel";
import StepSearch from "./steps/StepSearch";
import StepOptions from "./steps/StepOptions";
import StepReview from "./steps/StepReview";
import StepConfirm from "./steps/StepConfirm";

type StepKey = "SEARCH" | "OPTIONS" | "REVIEW" | "CONFIRM";

const STEPS = [
  { key: "SEARCH", title: "Plan your leave", subtitle: "Enter leave type and dates" },
  { key: "OPTIONS", title: "Available options", subtitle: "Choose your fare (balance bucket)" },
  { key: "REVIEW", title: "Review booking", subtitle: "Confirm itinerary and rules" },
  { key: "CONFIRM", title: "Confirmation", subtitle: "Booking reference and status" },
] as const;

function computeWorkingDays(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return 0;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  // Inclusive date range
  let days = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay(); // 0 Sun .. 6 Sat
    // working days: Mon-Fri
    if (day !== 0 && day !== 6) days += 1;
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/**
 * Ensures the Leave Wizard always sends DB-valid codes to Supabase.
 * DB leave_types.code valid values: annual | sick | unpaid | other
 */
function normalizeLeaveTypeCode(input?: string) {
  if (!input) return undefined;
  const v = input.trim().toLowerCase();

  // If UI accidentally stores labels, map them
  if (v === "annual leave") return "annual";
  if (v === "sick leave") return "sick";
  if (v === "unpaid leave") return "unpaid";
  if (v === "other") return "other";

  // If UI stores codes already, keep them
  if (v === "annual" || v === "sick" || v === "unpaid" || v === "other") return v;

  // Unknown -> return original lowercased (will fail fast and show error)
  return v;
}

type LeaveTypeRow = { code: string; name: string };

export default function LeaveWizard() {
  const [stepIndex, setStepIndex] = useState(0);

  const [state, setState] = useState<WizardState>({
    contractName: "Demo Contract",
    warnings: [],
    blocks: [],
    attachments: [],
    status: "DRAFT",
  });

  // ✅ Supabase leave types
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [leaveTypesLoading, setLeaveTypesLoading] = useState(false);
  const [leaveTypesError, setLeaveTypesError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = STEPS[stepIndex]?.key as StepKey;

  // Load leave types once
  useEffect(() => {
    async function loadLeaveTypes() {
      setLeaveTypesLoading(true);
      setLeaveTypesError(null);

      try {
        const { data, error } = await supabase
          .from("leave_types")
          .select("code,name")
          .order("name", { ascending: true });

        if (error) throw error;

        const list = (data ?? []) as LeaveTypeRow[];
        setLeaveTypes(list);

        // If user hasn't selected any leave type yet, default to first available
        setState((prev) => {
          if (prev.leaveTypeCode) return prev;
          return { ...prev, leaveTypeCode: list[0]?.code };
        });
      } catch (e: any) {
        setLeaveTypes([]);
        setLeaveTypesError(e?.message ?? "Failed to load leave types");
      } finally {
        setLeaveTypesLoading(false);
      }
    }

    loadLeaveTypes();
  }, []);

  const canGoNext = useMemo(() => {
    if (currentStep === "SEARCH") {
      return !!state.leaveTypeCode && !!state.startDate && !!state.endDate && (state.workingDays ?? 0) > 0;
    }
    if (currentStep === "OPTIONS") {
      return !!state.selectedOption;
    }
    if (currentStep === "REVIEW") {
      // REVIEW uses "Confirm & Submit" button
      return true;
    }
    return false;
  }, [currentStep, state.leaveTypeCode, state.startDate, state.endDate, state.workingDays, state.selectedOption]);

  function next() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function runSearch() {
    const warnings: string[] = [];
    const blocks: string[] = [];

    const workingDays = computeWorkingDays(state.startDate, state.endDate);

    if (workingDays <= 0) {
      blocks.push("Please select a valid date range with at least 1 working day.");
    }

    // Mock policy logic for UI (keep for now; later replace with Supabase leave_balances + leave_policies)
    const now = new Date();
    const year = now.getFullYear();
    const withinCarryWindow = now <= new Date(year + 1, 2, 31); // Mar 31 next year

    // Mock balances
    const currentYearRemaining = 12;
    const carryForwardRemaining = 5;

    if (!withinCarryWindow && (carryForwardRemaining ?? 0) > 0) {
      warnings.push("Carry-forward balance expires after March 31.");
    }

    setState((prev) => ({
      ...prev,
      workingDays,
      withinCarryWindow,
      currentYearRemaining,
      carryForwardRemaining,
      warnings,
      blocks,
      // reset selection if re-search
      selectedOption: undefined,
      breakdown: undefined,
      // reset booking fields if re-search
      bookingRef: undefined,
      status: "DRAFT",
    }));

    // Auto-advance if no blocks
    if (blocks.length === 0 && workingDays > 0) {
      setStepIndex(1);
    }
  }

  /**
   * Real submit to Supabase:
   * - Insert leave_requests as DRAFT (DB trigger autofills dept/lm/gm)
   * - Then submit:
   *    staff -> pending_lm (current_approver = line_manager_id)
   *    line_manager -> pending_gm (current_approver = general_manager_id)
   */
  async function submitToSupabase() {
    try {
      setIsSubmitting(true);

      // Normalize type to match leave_types.code FK
      const leaveType = normalizeLeaveTypeCode(state.leaveTypeCode);
      const startDate = state.startDate;
      const endDate = state.endDate;
      const days = state.workingDays ?? 0;

      // Hard guard: ensure selected leave type exists in DB list (prevents FK error)
      const allowed = new Set(leaveTypes.map((x) => x.code.toLowerCase()));
      if (!leaveType || !allowed.has(leaveType)) {
        setState((prev) => ({
          ...prev,
          blocks: [
            `Invalid leave type: "${state.leaveTypeCode}". Please re-select leave type.`,
          ],
        }));
        return;
      }

      if (!startDate || !endDate || days <= 0) {
        setState((prev) => ({
          ...prev,
          blocks: ["Missing or invalid leave details. Please go back and check your dates."],
        }));
        return;
      }

      // Must be signed in
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      // Get my role (used for routing on submit)
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profErr) throw profErr;
      const role = (prof as { role: string }).role;

      // 1) Insert draft request (DB trigger will autofill department_id / line_manager_id / general_manager_id)
      const { data: inserted, error: insErr } = await supabase
        .from("leave_requests")
        .insert({
          requester_id: userId,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          days,
          reason: state.reason ?? null,
          status: "draft",
        })
        .select("id,line_manager_id,general_manager_id")
        .single();

      if (insErr) throw insErr;

      const leaveId = inserted.id as string;

      // 2) Submit routing
      let nextStatus = "pending_lm";
      let nextApproverId: string | null = (inserted.line_manager_id as string | null) ?? null;

      if (role === "line_manager") {
        nextStatus = "pending_gm";
        nextApproverId = (inserted.general_manager_id as string | null) ?? null;
      }

      if (!nextApproverId) {
        setState((prev) => ({
          ...prev,
          blocks: [
            "Missing next approver. Please ask admin to set your Line Manager / General Manager mapping in the profiles table.",
          ],
        }));
        return;
      }

      const nowIso = new Date().toISOString();

      const { error: updErr } = await supabase
        .from("leave_requests")
        .update({
          status: nextStatus,
          current_approver_id: nextApproverId,
          submitted_at: nowIso,
          assigned_at: nowIso,
          decided_at: null,
          decided_by: null,
        })
        .eq("id", leaveId);

      if (updErr) throw updErr;

      // Update wizard confirmation fields
      setState((prev) => ({
        ...prev,
        bookingRef: leaveId, // show real request id as reference
        status: "PENDING",
        blocks: [],
      }));

      // Go to CONFIRM step
      setStepIndex(3);
    } catch (e: any) {
      const msg =
        typeof e?.message === "string"
          ? e.message
          : "Failed to submit leave request. Please try again.";
      setState((prev) => ({
        ...prev,
        blocks: [msg],
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Stepper steps={STEPS as any} currentIndex={stepIndex} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {currentStep === "SEARCH" && (
            <StepSearch
              state={state}
              setState={setState}
              onSearch={runSearch}
              leaveTypes={leaveTypes}
              leaveTypesLoading={leaveTypesLoading}
              leaveTypesError={leaveTypesError}
            />

          )}

          {currentStep === "OPTIONS" && (
            <StepOptions
              state={state}
              setState={setState}
              leaveTypes={leaveTypes}
              leaveTypesLoading={leaveTypesLoading}
              leaveTypesError={leaveTypesError}
            />
          )}

          {currentStep === "REVIEW" && <StepReview state={state} />}

          {currentStep === "CONFIRM" && <StepConfirm state={state} />}

          {/* Footer controls */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              disabled={stepIndex === 0 || currentStep === "CONFIRM" || isSubmitting}
              className="border rounded-md px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              Back
            </button>

            <div className="flex items-center gap-2">
              {currentStep === "REVIEW" ? (
                <button
                  type="button"
                  onClick={submitToSupabase}
                  disabled={isSubmitting}
                  className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Confirm & Submit"}
                </button>
              ) : currentStep !== "CONFIRM" ? (
                <button
                  type="button"
                  onClick={next}
                  disabled={!canGoNext || isSubmitting}
                  className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
                >
                  Continue
                </button>
              ) : null}
            </div>
          </div>

          {/* Errors */}
          {state.blocks && state.blocks.length > 0 ? (
            <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg p-3 text-sm">
              <div className="font-semibold mb-1">Cannot submit</div>
              <ul className="list-disc pl-5 space-y-1">
                {state.blocks.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <SummaryPanel state={state} />
      </div>
    </div>
  );
}
