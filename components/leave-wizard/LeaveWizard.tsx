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

  let days = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay(); // 0 Sun .. 6 Sat
    if (day !== 0 && day !== 6) days += 1;
    d.setDate(d.getDate() + 1);
  }
  return days;
}

type LeaveTypeRow = {
  code: string;
  name: string;
  requires_attachment: boolean;
  pay_category?: "FULL" | "HALF" | "UNPAID";
  requires_reason?: boolean;
  default_days?: number | null;
  active?: boolean;
};

function yearFromISODate(iso?: string) {
  if (!iso) return new Date().getFullYear();
  const y = Number(String(iso).slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

export default function LeaveWizard() {
  const [stepIndex, setStepIndex] = useState(0);

  const [state, setState] = useState<WizardState>({
    warnings: [],
    blocks: [],
    attachments: [],
    status: "DRAFT",
  });

  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [leaveTypesLoading, setLeaveTypesLoading] = useState(false);
  const [leaveTypesError, setLeaveTypesError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentStep = STEPS[stepIndex]?.key as StepKey;

  // Load leave types
  useEffect(() => {
    async function loadLeaveTypes() {
      setLeaveTypesLoading(true);
      setLeaveTypesError(null);

      try {
        const { data, error } = await supabase
          .from("leave_types")
          .select("code,name,requires_attachment,pay_category,requires_reason,default_days,active")
          .eq("active", true)
          .order("name", { ascending: true });

        if (error) throw error;

        const list: LeaveTypeRow[] = (data ?? []).map((r: any) => ({
          code: String(r.code),
          name: String(r.name),
          requires_attachment: Boolean(r.requires_attachment),
          pay_category: r.pay_category,
          requires_reason: Boolean(r.requires_reason),
          default_days: r.default_days ?? null,
          active: Boolean(r.active),
        }));

        setLeaveTypes(list);

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

  function findSelectedLeaveType(codeMaybe?: string) {
    const chosen = (codeMaybe ?? "").trim();
    if (!chosen) return undefined;
    return leaveTypes.find((t) => t.code.trim().toUpperCase() === chosen.toUpperCase());
  }

  const canGoNext = useMemo(() => {
    if (currentStep === "SEARCH") {
      return !!state.leaveTypeCode && !!state.startDate && !!state.endDate && (state.workingDays ?? 0) > 0;
    }
    if (currentStep === "OPTIONS") return !!state.selectedOption;
    if (currentStep === "REVIEW") return true;
    return false;
  }, [currentStep, state.leaveTypeCode, state.startDate, state.endDate, state.workingDays, state.selectedOption]);

  function next() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  // ✅ Loads contract + policy + balances from DB (used on mount + search)
  async function loadUserContext(policyYear: number) {
    // do NOT wipe user-entered fields; only enrich state
    const warnings: string[] = [];
    const blocks: string[] = [];

    // Must be signed in
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const userId = userData.user?.id;
    if (!userId) throw new Error("Not signed in");

    // Profile + contract
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, role, contract_id, contracts(name)")
      .eq("id", userId)
      .single();
    if (profileErr) throw profileErr;

    const contractId = (profile as any)?.contract_id as string | null;
    const contractName = (profile as any)?.contracts?.name as string | null;
    const userRole = String((profile as any)?.role ?? "");

    if (!contractId) {
      blocks.push("Your profile is missing a contract assignment. Please ask the contract admin to set contract_id.");
    }

    // Policy (contract + year)
    let policy: any = null;
    if (contractId) {
      const { data: pol, error: polErr } = await supabase
        .from("leave_policies")
        .select("policy_year, year_end_date, carry_forward_limit, carry_forward_expiry, annual_entitlement")
        .eq("contract_id", contractId)
        .eq("policy_year", policyYear)
        .single();

      if (!polErr) policy = pol;
    }

    // Balances (user + year) — prefer contract_id, fallback to old rows without it
    let balance: any = null;
    {
      let q = supabase
        .from("leave_balances")
        .select("policy_year, entitlement, used, carried_forward, carried_forward_used, contract_id")
        .eq("user_id", userId)
        .eq("policy_year", policyYear);

      if (contractId) q = q.eq("contract_id", contractId);

      const { data: bal, error: balErr } = await q.single();

      if (balErr && contractId) {
        const { data: bal2, error: balErr2 } = await supabase
          .from("leave_balances")
          .select("policy_year, entitlement, used, carried_forward, carried_forward_used, contract_id")
          .eq("user_id", userId)
          .eq("policy_year", policyYear)
          .single();
        if (!balErr2) balance = bal2;
      } else if (!balErr) {
        balance = bal;
      }
    }

    const entitlement = Number(balance?.entitlement ?? 0);
    const used = Number(balance?.used ?? 0);
    const carried = Number(balance?.carried_forward ?? 0);
    const carriedUsed = Number(balance?.carried_forward_used ?? 0);

    const currentYearRemaining = balance ? Math.max(0, Math.floor(entitlement - used)) : undefined;
    const carryForwardRemaining = balance ? Math.max(0, Math.floor(carried - carriedUsed)) : undefined;

    const carryForwardExpiry = policy?.carry_forward_expiry ? String(policy.carry_forward_expiry) : undefined;
    const carryForwardLimit = typeof policy?.carry_forward_limit === "number" ? Number(policy.carry_forward_limit) : undefined;
    const yearEndDate = policy?.year_end_date ? String(policy.year_end_date) : undefined;

    const withinCarryWindow = (() => {
      if (!carryForwardExpiry) return true;
      const today = new Date();
      const expiry = new Date(`${carryForwardExpiry}T23:59:59`);
      return today.getTime() <= expiry.getTime();
    })();

    // only warnings if we actually have numbers
    if (typeof carryForwardRemaining === "number" && carryForwardRemaining > 0 && carryForwardExpiry) {
      warnings.push(withinCarryWindow
        ? `Carry-forward expires on ${carryForwardExpiry} (policy).`
        : `Carry-forward expired on ${carryForwardExpiry} (not usable).`);
    }

    setState((prev) => ({
      ...prev,
      contractName: contractName ?? prev.contractName,
      userRole,
      policyYear,
      yearEndDate,
      carryForwardExpiry,
      carryForwardLimit,
      withinCarryWindow,
      currentYearRemaining,
      carryForwardRemaining,
      // don't overwrite existing messages unless we have new ones
      warnings: prev.warnings?.length ? prev.warnings : warnings,
      blocks: prev.blocks?.length ? prev.blocks : blocks,
    }));
  }

  // ✅ Load contract/balances immediately (so no more “Demo Contract” / fixed numbers)
  useEffect(() => {
    // do not block UI; just enrich state
    loadUserContext(new Date().getFullYear()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(nextFromStep: WizardState) {
    const workingDays = computeWorkingDays(nextFromStep.startDate, nextFromStep.endDate);

    const warnings: string[] = [...(nextFromStep.warnings ?? [])];
    const blocks: string[] = [...(nextFromStep.blocks ?? [])];

    if (workingDays <= 0) blocks.push("Please select a valid date range with at least 1 working day.");

    const selectedType = findSelectedLeaveType(nextFromStep.leaveTypeCode);
    const requiresAttachment = Boolean(selectedType?.requires_attachment);
    if (requiresAttachment && (nextFromStep.attachments?.length ?? 0) === 0) {
      blocks.push("Attachment is required for this leave type.");
    }

    const policyYear = yearFromISODate(nextFromStep.startDate);

    // ✅ Always refresh DB context for the selected year
    try {
      await loadUserContext(policyYear);
    } catch (e: any) {
      blocks.push(typeof e?.message === "string" ? e.message : "Failed to load balances/policy.");
    }

    // Read balances from the *latest* state by re-fetching quickly (safe)
    // (We also recompute sufficiency using what we already have in next state after setState)
    const tmpState: WizardState = {
      ...state,
      ...nextFromStep,
      workingDays,
      warnings,
      blocks,
      policyYear,
    };

    // Update wizard state for step
    setState((prev) => ({
      ...prev,
      ...tmpState,
      // reset selection if re-search
      selectedOption: undefined,
      breakdown: undefined,
      bookingRef: undefined,
      status: "DRAFT",
    }));

    // Use current values from state AFTER loadUserContext updated them
    // (small delay to ensure React state applied)
    setTimeout(() => {
      setState((prev) => {
        const cy = prev.currentYearRemaining ?? 0;
        const cf = prev.carryForwardRemaining ?? 0;
        const within = prev.withinCarryWindow ?? true;

        const usableCarry = within ? cf : 0;
        const localBlocks = [...(tmpState.blocks ?? [])];

        if (workingDays > 0 && (prev.currentYearRemaining == null || prev.carryForwardRemaining == null)) {
          localBlocks.push("Leave balance is not available for this year. Please contact your admin to generate balances.");
        } else if (workingDays > 0 && workingDays > cy + usableCarry) {
          localBlocks.push("Insufficient leave balance for the selected date range.");
        }

        // Auto-advance only if no blocks
        if (localBlocks.length === 0 && workingDays > 0) setStepIndex(1);

        return { ...prev, blocks: localBlocks };
      });
    }, 0);
  }

  async function submitToSupabase() {
    try {
      setIsSubmitting(true);

      const startDate = state.startDate;
      const endDate = state.endDate;
      const days = state.workingDays ?? 0;

      const selected = findSelectedLeaveType(state.leaveTypeCode);
      if (!selected) {
        setState((prev) => ({ ...prev, blocks: [`Invalid leave type: "${state.leaveTypeCode}". Please re-select.`] }));
        return;
      }

      if (!startDate || !endDate || days <= 0) {
        setState((prev) => ({ ...prev, blocks: ["Missing or invalid leave details. Please check your dates."] }));
        return;
      }

      if (selected.requires_attachment && (state.attachments?.length ?? 0) === 0) {
        setState((prev) => ({ ...prev, blocks: ["Attachment is required for this leave type. Please upload."] }));
        return;
      }

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { data: prof, error: profErr } = await supabase.from("profiles").select("role").eq("id", userId).single();
      if (profErr) throw profErr;

      const role = String((prof as any)?.role ?? "staff");

      // 1) insert draft
      const { data: inserted, error: insErr } = await supabase
        .from("leave_requests")
        .insert({
          requester_id: userId,
          leave_type: selected.code,
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

      // 2) submit routing
      let nextStatus = "pending_lm";
      let nextApproverId: string | null = (inserted.line_manager_id as string | null) ?? null;

      if (role === "line_manager") {
        nextStatus = "pending_gm";
        nextApproverId = (inserted.general_manager_id as string | null) ?? null;
      }

      if (!nextApproverId) {
        setState((prev) => ({
          ...prev,
          blocks: ["Missing next approver. Ask admin to set Line Manager / General Manager mapping in profiles."],
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

      setState((prev) => ({ ...prev, bookingRef: leaveId, status: "PENDING", blocks: [] }));
      setStepIndex(3);
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        blocks: [typeof e?.message === "string" ? e.message : "Failed to submit leave request."],
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

          {state.blocks?.length ? (
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
