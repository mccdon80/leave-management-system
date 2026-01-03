"use client";

import { useMemo, useState } from "react";
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

function computeWorkingDays(start: string, end: string) {
  // UI-only approximation (Mon–Fri)
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  if (e < s) return 0;

  let days = 0;
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getDay(); // 0 Sun .. 6 Sat
    if (dow !== 0 && dow !== 6) days += 1;
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export default function LeaveWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = STEPS[stepIndex]?.key as StepKey;

  const [state, setState] = useState<WizardState>({
    contractName: "Demo Contract",
    warnings: [],
    blocks: [],
  });

  const canGoNext = useMemo(() => {
    if (currentStep === "SEARCH") {
      return !!state.leaveTypeCode && !!state.startDate && !!state.endDate && (state.blocks?.length ?? 0) === 0 && (state.workingDays ?? 0) > 0;
    }
    if (currentStep === "OPTIONS") {
      return !!state.selectedOption && !!state.breakdown && (state.blocks?.length ?? 0) === 0;
    }
    if (currentStep === "REVIEW") {
      return true;
    }
    return false;
  }, [currentStep, state]);

  function next() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function runSearch() {
    const warnings: string[] = [];
    const blocks: string[] = [];

    if (!state.leaveTypeCode) blocks.push("Select a leave type.");
    if (!state.startDate || !state.endDate) blocks.push("Select start and end dates.");

    if (state.startDate && state.endDate) {
      const s = new Date(state.startDate);
      const e = new Date(state.endDate);
      if (e < s) blocks.push("End date cannot be before start date.");

      // Simple “Dec 31 cutoff” blocking for UI
      if (s.getFullYear() !== e.getFullYear()) {
        blocks.push("Dates cross Dec 31 cutoff (leave year boundary).");
      }

      // mock carry-forward window (Jan–Mar)
      const withinCarryWindow = s.getMonth() <= 2; // Jan=0..Mar=2 (simple)
      const workingDays = computeWorkingDays(state.startDate, state.endDate);

      // mock balances for UI
      const currentYearRemaining = 18;
      const carryForwardRemaining = withinCarryWindow ? 4 : 0;

      if (!withinCarryWindow) warnings.push("Carry-forward expires on Mar 31 (not usable outside Jan–Mar).");
      if (state.leaveTypeCode === "Birthday") {
        // mock: pretend already used? (set to warning/block as you like)
        // blocks.push("Birthday leave already used this year.");
        warnings.push("Birthday leave is limited to 1 day per year (non-carry-forward).");
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
      }));

      // Auto-advance if no blocks
      if (blocks.length === 0 && workingDays > 0) {
        setStepIndex(1);
      }
      return;
    }

    setState((prev) => ({ ...prev, warnings, blocks }));
  }

  function submitMock() {
    // UI-only: generate a mock booking reference
    const year = new Date().getFullYear();
    const rand = String(Math.floor(100000 + Math.random() * 900000));
    setState((prev) => ({
      ...prev,
      bookingRef: `LV-${year}-${rand}`,
      status: "PENDING",
    }));
    setStepIndex(3);
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
            />
          )}

          {currentStep === "OPTIONS" && (
            <StepOptions state={state} setState={setState} />
          )}

          {currentStep === "REVIEW" && <StepReview state={state} />}

          {currentStep === "CONFIRM" && <StepConfirm state={state} />}

          {/* Footer controls */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              disabled={stepIndex === 0 || currentStep === "CONFIRM"}
              className="border rounded-md px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              Back
            </button>

            <div className="flex items-center gap-2">
              {currentStep === "REVIEW" ? (
                <button
                  type="button"
                  onClick={submitMock}
                  className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800"
                >
                  Confirm & Submit
                </button>
              ) : currentStep !== "CONFIRM" ? (
                <button
                  type="button"
                  onClick={next}
                  disabled={!canGoNext}
                  className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
                >
                  Continue
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <SummaryPanel state={state} />
      </div>
    </div>
  );
}
