"use client";

import { useMemo } from "react";
import type { WizardState } from "../SummaryPanel";

type FareKey = "SMART" | "CURRENT_ONLY" | "CARRY_ONLY";

type LeavePayCategory = "FULL" | "HALF" | "UNPAID";

type LeaveTypeRow = { code: string; name: string };

type LeaveTypeConfig = {
  code: string; // MUST match DB leave_types.code
  name: string;
  defaultDays: number | null;
  payCategory: LeavePayCategory;
  requiresReason: boolean;
  requiresAttachment: boolean;
  active: boolean;
};

type FareCard = {
  key: FareKey;
  name: string;
  tagline: string;
  recommended?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  bullets: { label: string; tone?: "ok" | "warn" | "info" | "neutral" | "good" }[];
  breakdown: { carryForward: number; currentYear: number };
  rationale: string[];
};

function pill(text: string, tone: "ok" | "warn" | "info" | "neutral" | "good" = "neutral") {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "info"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-neutral-50 text-neutral-700 border-neutral-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {text}
    </span>
  );
}

function moneyRow(label: string, value: string) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function buildLeaveTypeConfigs(leaveTypes: LeaveTypeRow[]): LeaveTypeConfig[] {
  // Map DB leave types into richer UI config.
  // You can later move this into a contract/admin table.
  return leaveTypes.map((lt) => {
    const code = lt.code.toLowerCase();

    if (code === "sick") {
      return {
        code,
        name: lt.name,
        defaultDays: null,
        payCategory: "FULL",
        requiresReason: true,
        requiresAttachment: true,
        active: true,
      };
    }

    if (code === "unpaid") {
      return {
        code,
        name: lt.name,
        defaultDays: null,
        payCategory: "UNPAID",
        requiresReason: true,
        requiresAttachment: false,
        active: true,
      };
    }

    if (code === "other") {
      return {
        code,
        name: lt.name,
        defaultDays: null,
        payCategory: "FULL",
        requiresReason: true,
        requiresAttachment: false,
        active: true,
      };
    }

    // annual (default)
    return {
      code,
      name: lt.name,
      defaultDays: null,
      payCategory: "FULL",
      requiresReason: false,
      requiresAttachment: false,
      active: true,
    };
  });
}

function FareCardView({
  card,
  selected,
  onSelect,
}: {
  card: FareCard;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={[
        "rounded-xl border bg-white p-4 transition",
        card.recommended ? "border-neutral-900" : "border-neutral-200",
        selected ? "ring-2 ring-neutral-900" : "",
        card.disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold">{card.name}</div>
            {card.recommended ? pill("Recommended", "good") : null}
          </div>
          <div className="text-sm text-neutral-500">{card.tagline}</div>
        </div>

        <button
          type="button"
          disabled={card.disabled}
          onClick={onSelect}
          className={[
            "rounded-md border px-3 py-1.5 text-sm",
            selected ? "bg-neutral-900 text-white border-neutral-900" : "bg-white hover:bg-neutral-50",
          ].join(" ")}
        >
          {selected ? "Selected" : "Select"}
        </button>
      </div>

      {card.disabled && card.disabledReason ? (
        <div className="mt-3 text-xs rounded-md p-2 bg-amber-50 text-amber-900 border border-amber-200">
          {card.disabledReason}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {moneyRow("Use from carry-forward", `${card.breakdown.carryForward} day(s)`)}
        {moneyRow("Use from current-year", `${card.breakdown.currentYear} day(s)`)}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {card.bullets.map((b, idx) => (
          <span key={idx}>{pill(b.label, b.tone ?? "neutral")}</span>
        ))}
      </div>

      <div className="mt-4 text-sm text-neutral-600">
        <div className="font-medium text-neutral-900">Why this option</div>
        <ul className="mt-1 list-disc pl-5 space-y-1">
          {card.rationale.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function StepOptions({
  state,
  setState,
  leaveTypes,
  leaveTypesLoading,
  leaveTypesError,
}: {
  state: WizardState;
  setState: (next: WizardState) => void;
  leaveTypes: LeaveTypeRow[];
  leaveTypesLoading?: boolean;
  leaveTypesError?: string | null;
}) {
  const days = state.workingDays ?? 0;
  const cy = state.currentYearRemaining ?? 0;
  const cf = state.carryForwardRemaining ?? 0;
  const withinCarry = state.withinCarryWindow ?? true;

  const leaveTypeConfigs = useMemo(() => buildLeaveTypeConfigs(leaveTypes ?? []), [leaveTypes]);

  // Ensure we always have a DB-valid leaveTypeCode
  const allowedCodes = useMemo(() => new Set(leaveTypeConfigs.map((x) => x.code)), [leaveTypeConfigs]);

  const leaveTypeCode = (state.leaveTypeCode ?? leaveTypeConfigs[0]?.code ?? "annual").toLowerCase();

  const leaveType =
    leaveTypeConfigs.find((t) => t.code === leaveTypeCode) ?? leaveTypeConfigs[0] ?? {
      code: "annual",
      name: "Annual Leave",
      defaultDays: null,
      payCategory: "FULL" as const,
      requiresReason: false,
      requiresAttachment: false,
      active: true,
    };

  // If state has an invalid value (old hardcoded label), reset it silently
  if (state.leaveTypeCode && !allowedCodes.has(leaveTypeCode) && leaveTypeConfigs.length > 0) {
    // NOTE: This runs during render; keep it safe by only correcting when necessary.
    // If you prefer, move it into a useEffect.
    setTimeout(() => {
      setState({ ...state, leaveTypeCode: leaveTypeConfigs[0].code });
    }, 0);
  }

  const pay = leaveType.payCategory;
  const fixedDays = leaveType.defaultDays; // null if not fixed
  const isFixed = typeof fixedDays === "number" && fixedDays > 0;

  // Fixed duration rule (UI-first)
  const fixedMismatch = isFixed && days > 0 && days !== fixedDays;

  // Balance logic for cards
  const canUseCarry = withinCarry && cf > 0;
  const canUseCurrent = cy > 0;

  const smartCarry = canUseCarry ? Math.min(cf, days) : 0;
  const smartCurrent = Math.max(days - smartCarry, 0);

  const carryOnlyCarry = canUseCarry ? Math.min(cf, days) : 0;
  const carryOnlyCurrent = 0;

  const currentOnlyCarry = 0;
  const currentOnlyCurrent = Math.min(cy, days);

  const slaDue = "Escalates after X days (configured by Admin)";

  const fares: FareCard[] = [
    {
      key: "SMART",
      name: "Smart Apply",
      tagline: "Best value — automatically uses the correct buckets.",
      recommended: true,
      disabled: !(days > 0) || (days > 0 && smartCarry + smartCurrent !== days),
      disabledReason:
        days > 0 && smartCarry + smartCurrent !== days
          ? "Insufficient balance across buckets for these dates."
          : undefined,
      breakdown: { carryForward: smartCarry, currentYear: smartCurrent },
      bullets: [
        { label: pay === "FULL" ? "Full pay" : pay === "HALF" ? "Half pay" : "Unpaid", tone: pay === "FULL" ? "good" : pay === "HALF" ? "warn" : "neutral" },
        ...(isFixed ? [{ label: `Fixed: ${fixedDays} day(s)`, tone: "info" as const }] : []),
      ],
      rationale: [
        "Uses carry-forward first (within allowed window), then current-year balance.",
        "Reduces the risk of losing carry-forward days after expiry.",
        ...(fixedMismatch ? [`Warning: ${leaveType.name} usually defaults to ${fixedDays} day(s).`] : []),
      ],
    },
    {
      key: "CURRENT_ONLY",
      name: "Current-year Only",
      tagline: "Use only current-year balance.",
      disabled: !(days > 0) || !canUseCurrent || currentOnlyCurrent !== days,
      disabledReason:
        !canUseCurrent
          ? "No current-year balance available."
          : currentOnlyCurrent !== days
          ? "Not enough current-year balance."
          : undefined,
      breakdown: { carryForward: currentOnlyCarry, currentYear: currentOnlyCurrent },
      bullets: [
        { label: "Uses current-year only", tone: "info" },
        ...(canUseCarry ? [{ label: "Carry-forward stays unused", tone: "warn" as const }] : []),
      ],
      rationale: [
        "Keeps carry-forward untouched.",
        ...(canUseCarry ? ["Note: carry-forward may expire after March 31 (policy-based)."] : []),
        ...(fixedMismatch ? [`Warning: ${leaveType.name} usually defaults to ${fixedDays} day(s).`] : []),
      ],
    },
    {
      key: "CARRY_ONLY",
      name: "Carry-forward Only",
      tagline: "Use only carry-forward balance (if allowed).",
      disabled: !(days > 0) || !canUseCarry || carryOnlyCarry !== days,
      disabledReason:
        !withinCarry
          ? "Carry-forward window expired."
          : !canUseCarry
          ? "No carry-forward balance available."
          : carryOnlyCarry !== days
          ? "Not enough carry-forward balance."
          : undefined,
      breakdown: { carryForward: carryOnlyCarry, currentYear: carryOnlyCurrent },
      bullets: [
        { label: "Uses carry-forward only", tone: "info" },
        { label: withinCarry ? "Within window" : "Expired window", tone: withinCarry ? "good" : "warn" },
      ],
      rationale: [
        "Helps consume carry-forward before expiry.",
        `LM → Escalate to GM (${slaDue})`,
        ...(fixedMismatch ? [`Warning: ${leaveType.name} usually defaults to ${fixedDays} day(s).`] : []),
      ],
    },
  ];

  function onSelectFare(card: FareCard) {
    if (card.disabled) return;

    setState({
      ...state,
      selectedOption: card.key,
      breakdown: card.breakdown,
      warnings: [
        ...(state.warnings || []),
        ...(fixedMismatch ? [`${leaveType.name}: default duration is ${fixedDays} day(s).`] : []),
        ...(card.key === "CURRENT_ONLY" && canUseCarry
          ? ["Carry-forward remains unused (may expire after policy date)."]
          : []),
      ],
      blocks: [],
    });
  }

  function onSelectLeaveType(code: string) {
    const normalized = code.toLowerCase();
    setState({
      ...state,
      leaveTypeCode: normalized,
      // reset selection because rules/balances may change by type
      selectedOption: undefined,
      breakdown: undefined,
      warnings: [],
      blocks: [],
    });
  }

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-neutral-500">Step 2</div>
          <div className="text-xl font-semibold">Choose your option</div>
          <div className="text-sm text-neutral-500">
            Select the leave type (from Supabase) and pick how to use your balance.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pill(`${days} working day(s)`, "info")}
          {pill(leaveType.name, "neutral")}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Left panel */}
        <div className="rounded-xl border bg-neutral-50 p-4">
          <div className="text-sm font-medium text-neutral-900">Leave Type</div>

          {leaveTypesLoading ? (
            <div className="mt-2 text-sm text-neutral-500">Loading leave types…</div>
          ) : leaveTypesError ? (
            <div className="mt-2 text-sm text-red-600">{leaveTypesError}</div>
          ) : null}

          <select
            className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm"
            value={leaveType.code}
            onChange={(e) => onSelectLeaveType(e.target.value)}
            disabled={leaveTypesLoading || leaveTypeConfigs.length === 0}
          >
            {leaveTypeConfigs.map((lt) => (
              <option key={lt.code} value={lt.code}>
                {lt.name}
              </option>
            ))}
          </select>

          <div className="mt-4 space-y-2 text-sm">
            {moneyRow("Current-year remaining", `${cy} day(s)`)}
            {moneyRow("Carry-forward remaining", `${cf} day(s)`)}
            <div className="text-xs text-neutral-500">
              Carry-forward window: {withinCarry ? "Active" : "Expired"}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {pill(
              pay === "FULL" ? "Full pay" : pay === "HALF" ? "Half pay" : "Unpaid",
              pay === "FULL" ? "good" : pay === "HALF" ? "warn" : "neutral"
            )}
            {leaveType.requiresReason ? pill("Reason required", "info") : pill("Reason optional", "neutral")}
            {leaveType.requiresAttachment ? pill("Attachment required", "warn") : pill("Attachment optional", "neutral")}
          </div>

          {fixedMismatch ? (
            <div className="mt-4 text-xs rounded-md p-2 bg-amber-50 text-amber-900 border border-amber-200">
              {leaveType.name} normally defaults to {fixedDays} day(s), but your selection is {days} day(s).
            </div>
          ) : null}

          <div className="mt-4 text-xs text-neutral-500">
            Note: Pay category / rules are currently UI defaults. Later we can move these into admin contract settings.
          </div>
        </div>

        {/* Right panel: fare cards */}
        <div className="space-y-4">
          {fares.map((card) => (
            <FareCardView
              key={card.key}
              card={card}
              selected={state.selectedOption === card.key}
              onSelect={() => onSelectFare(card)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
