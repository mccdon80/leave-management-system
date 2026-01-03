"use client";

import type { WizardState } from "../SummaryPanel";

type FareKey = "SMART" | "CURRENT_ONLY" | "CARRY_ONLY";

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

// UI-first mock. Later: fetch from Supabase (contract-scoped)
const MOCK_LEAVE_TYPES: LeaveTypeConfig[] = [
  { code: "ANNUAL", name: "Annual", defaultDays: null, payCategory: "FULL", requiresReason: false, requiresAttachment: false, active: true },
  { code: "BIRTHDAY", name: "Birthday", defaultDays: 1, payCategory: "FULL", requiresReason: false, requiresAttachment: false, active: true },
  { code: "SICK_FULL", name: "Sick Leave (Full Pay)", defaultDays: null, payCategory: "FULL", requiresReason: true, requiresAttachment: true, active: true },
  { code: "SICK_HALF", name: "Sick Leave (Half Pay)", defaultDays: null, payCategory: "HALF", requiresReason: true, requiresAttachment: true, active: true },
  { code: "COMPASSIONATE", name: "Compassionate Leave", defaultDays: 3, payCategory: "FULL", requiresReason: true, requiresAttachment: false, active: true },
];

type FareCard = {
  key: FareKey;
  name: string;
  tagline: string;

  badge?: string;
  recommended?: boolean;

  disabled?: boolean;
  disabledReason?: string;

  breakdown: { carryForward: number; currentYear: number };

  totals: { carryForwardTotal: number; currentYearTotal: number };
  after: { carryForwardRemaining: number; currentYearRemaining: number };

  // NEW: leave-type context badges
  leaveBadges: { label: string; tone: "neutral" | "good" | "warn" | "info" }[];

  policyNotes: string[];
  expiryImpact?: string;
  approvalPreview: string[];
};

function payLabel(p: LeavePayCategory) {
  if (p === "FULL") return "Full pay";
  if (p === "HALF") return "Half pay";
  return "Unpaid";
}

function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "info";
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border border-amber-200"
      : tone === "info"
      ? "bg-blue-50 text-blue-900 border border-blue-200"
      : "bg-neutral-100 text-neutral-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${cls}`}>
      {children}
    </span>
  );
}

function moneyRow(label: string, value: string) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function CompareRow({
  label,
  values,
}: {
  label: string;
  values: React.ReactNode[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 border-t pt-3">
      <div className="text-sm text-neutral-500 lg:pt-2">{label}</div>
      {values.map((v, i) => (
        <div key={i} className="text-sm">
          {v}
        </div>
      ))}
    </div>
  );
}

function BalanceBar({
  label,
  remaining,
  total,
}: {
  label: string;
  remaining: number;
  total: number;
}) {
  const safeTotal = Math.max(0, total);
  const safeRemaining = Math.max(0, Math.min(remaining, safeTotal));
  const used = Math.max(0, safeTotal - safeRemaining);

  const remainingPct = safeTotal === 0 ? 0 : (safeRemaining / safeTotal) * 100;
  const usedPct = safeTotal === 0 ? 0 : (used / safeTotal) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className="font-medium text-neutral-900">
          {safeRemaining}/{safeTotal}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 border border-neutral-200">
        <div className="h-full flex">
          <div className="h-full bg-neutral-300" style={{ width: `${usedPct}%` }} />
          <div className="h-full bg-neutral-900" style={{ width: `${remainingPct}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-neutral-500">
        <span>Used: {used}</span>
        <span>Remaining: {safeRemaining}</span>
      </div>
    </div>
  );
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
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold text-lg">{card.name}</div>

            {card.badge ? (
              <Tag tone={card.recommended ? "good" : "neutral"}>{card.badge}</Tag>
            ) : null}

            {/* NEW: leave-type badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {card.leaveBadges.map((b, i) => (
                <Tag key={i} tone={b.tone}>
                  {b.label}
                </Tag>
              ))}
            </div>
          </div>

          <div className="text-sm text-neutral-500 mt-1">{card.tagline}</div>
        </div>

        <button
          type="button"
          onClick={onSelect}
          disabled={card.disabled}
          className={[
            "rounded-md px-3 py-2 text-sm border shrink-0",
            selected
              ? "bg-neutral-900 text-white border-neutral-900"
              : "hover:bg-neutral-50",
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

      <div className="mt-4 border-t pt-3 space-y-3">
        <div className="text-sm font-medium">Balances after booking</div>

        <BalanceBar
          label="Carry-forward"
          remaining={card.after.carryForwardRemaining}
          total={card.totals.carryForwardTotal}
        />

        <BalanceBar
          label="Current-year"
          remaining={card.after.currentYearRemaining}
          total={card.totals.currentYearTotal}
        />
      </div>

      <div className="mt-4 border-t pt-3 space-y-2">
        <div className="text-sm font-medium">Policy notes</div>
        <ul className="text-sm text-neutral-700 list-disc pl-5 space-y-1">
          {card.policyNotes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>

        {card.expiryImpact ? (
          <div className="mt-2 text-xs text-neutral-600">
            <span className="font-medium text-neutral-900">Expiry impact:</span>{" "}
            {card.expiryImpact}
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3">
        <div className="text-sm font-medium">Approval route</div>
        <ul className="mt-2 text-sm text-neutral-700 space-y-1">
          {card.approvalPreview.map((a, i) => (
            <li key={i}>• {a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function StepOptions({
  state,
  setState,
}: {
  state: WizardState;
  setState: (next: WizardState) => void;
}) {
  const days = state.workingDays ?? 0;
  const cy = state.currentYearRemaining ?? 0;
  const cf = state.carryForwardRemaining ?? 0;
  const withinCarry = state.withinCarryWindow ?? true;

  const leaveTypeCode = state.leaveTypeCode ?? "ANNUAL";
  const leaveType =
    MOCK_LEAVE_TYPES.find((t) => t.code === leaveTypeCode) ??
    MOCK_LEAVE_TYPES[0];

  const pay = leaveType.payCategory;
  const fixedDays = leaveType.defaultDays; // null if not fixed
  const isFixed = typeof fixedDays === "number" && fixedDays > 0;

  // mock SLA due date (UI only). Later: from policy + submitted_at.
  const slaDue = "Due in 7 days (mock)";

  const canUseCarry = withinCarry && cf > 0;

  const smartCarry = Math.min(days, canUseCarry ? cf : 0);
  const smartCurrent = Math.max(0, days - smartCarry);

  const smartOk = days > 0 && (cy + (canUseCarry ? cf : 0)) >= days;
  const currentOnlyOk = days > 0 && cy >= days;
  const carryOnlyOk = days > 0 && withinCarry && cf >= days;

  // “Balance after booking” helpers
  const after = {
    SMART: { cf: cf - smartCarry, cy: cy - smartCurrent },
    CURRENT_ONLY: { cf, cy: cy - days },
    CARRY_ONLY: { cf: cf - days, cy },
  };

  const totals = {
    carryForwardTotal: cf,
    currentYearTotal: cy,
  };

  const leaveBadgesBase: FareCard["leaveBadges"] = [
    { label: payLabel(pay), tone: pay === "FULL" ? "good" : pay === "HALF" ? "warn" : "neutral" },
    ...(isFixed ? [{ label: `Fixed: ${fixedDays} day(s)`, tone: "info" as const }] : []),
  ];

  // Fixed duration rule (UI-first):
  // - If leave type has defaultDays and user selected a different number of working days,
  //   show warning in cards. We DO NOT block here (except BIRTHDAY should be blocked by Step 1).
  const fixedMismatch = isFixed && days > 0 && days !== fixedDays;

  const fares: FareCard[] = [
    {
      key: "SMART",
      name: "Smart Apply",
      tagline: "Best value — automatically uses the correct buckets.",
      badge: "Recommended",
      recommended: true,
      disabled: !smartOk,
      disabledReason:
        days <= 0
          ? "Enter valid dates first."
          : !smartOk
          ? "Insufficient total balance to cover these dates."
          : undefined,
      breakdown: { carryForward: smartCarry, currentYear: smartCurrent },
      totals,
      after: {
        carryForwardRemaining: after.SMART.cf,
        currentYearRemaining: after.SMART.cy,
      },
      leaveBadges: leaveBadgesBase,
      policyNotes: [
        fixedMismatch
          ? `This leave type is typically ${fixedDays} day(s). You selected ${days} day(s).`
          : "Duration matches the configured default (or no fixed duration).",
        canUseCarry
          ? "Uses carry-forward first (when allowed), then current-year."
          : "Carry-forward not available right now — uses current-year only.",
        "Prevents unused carry-forward from expiring when applicable.",
      ],
      expiryImpact: canUseCarry
        ? "Using carry-forward reduces the risk of expiry on Mar 31."
        : "No carry-forward impact.",
      approvalPreview: [
        "Approver 1: Line Manager (mock)",
        `Escalates to GM after 7 days — ${slaDue}`,
      ],
    },
    {
      key: "CURRENT_ONLY",
      name: "Current-year Only",
      tagline: "Simple — uses only this year’s entitlement.",
      badge: "Standard",
      disabled: !currentOnlyOk,
      disabledReason:
        days <= 0
          ? "Enter valid dates first."
          : !currentOnlyOk
          ? "Not enough current-year balance for these dates."
          : undefined,
      breakdown: { carryForward: 0, currentYear: days },
      totals,
      after: {
        carryForwardRemaining: after.CURRENT_ONLY.cf,
        currentYearRemaining: after.CURRENT_ONLY.cy,
      },
      leaveBadges: leaveBadgesBase,
      policyNotes: [
        fixedMismatch
          ? `This leave type is typically ${fixedDays} day(s). You selected ${days} day(s).`
          : "Duration matches the configured default (or no fixed duration).",
        "Does not use carry-forward even if available.",
        canUseCarry
          ? "Carry-forward may expire unused on Mar 31."
          : "No carry-forward available.",
      ],
      expiryImpact: canUseCarry
        ? "Carry-forward remains unused and may expire on Mar 31."
        : "No carry-forward impact.",
      approvalPreview: [
        "Approver 1: Line Manager (mock)",
        `Escalates to GM after 7 days — ${slaDue}`,
      ],
    },
    {
      key: "CARRY_ONLY",
      name: "Carry-forward Only",
      tagline: "Only for Jan–Mar requests — uses carry-forward exclusively.",
      badge: "Limited",
      disabled: !carryOnlyOk,
      disabledReason:
        days <= 0
          ? "Enter valid dates first."
          : !withinCarry
          ? "Carry-forward can only be used until Mar 31."
          : cf < days
          ? "Not enough carry-forward balance for these dates."
          : undefined,
      breakdown: { carryForward: days, currentYear: 0 },
      totals,
      after: {
        carryForwardRemaining: after.CARRY_ONLY.cf,
        currentYearRemaining: after.CARRY_ONLY.cy,
      },
      leaveBadges: leaveBadgesBase,
      policyNotes: [
        fixedMismatch
          ? `This leave type is typically ${fixedDays} day(s). You selected ${days} day(s).`
          : "Duration matches the configured default (or no fixed duration).",
        "Only available in the carry-forward window (Jan–Mar).",
        "Helps you consume carry-forward before expiry.",
      ],
      expiryImpact: "Uses carry-forward before it expires on Mar 31.",
      approvalPreview: [
        "Approver 1: Line Manager (mock)",
        `Escalates to GM after 7 days — ${slaDue}`,
      ],
    },
  ];

  const selected = state.selectedOption;

  function selectFare(card: FareCard) {
    if (card.disabled) return;

    setState({
      ...state,
      selectedOption: card.key,
      breakdown: card.breakdown,
      warnings: [
        ...(state.warnings || []),
        ...(fixedMismatch
          ? [`${leaveType.name}: default duration is ${fixedDays} day(s), selected ${days} day(s).`]
          : []),
        ...(card.key === "CURRENT_ONLY" && canUseCarry
          ? ["Warning: carry-forward may expire unused on Mar 31."]
          : []),
      ].filter(Boolean),
      blocks: (state.blocks || []).filter(Boolean),
    });
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold">Available options</div>
            <div className="text-sm text-neutral-500 mt-1">
              Choose a “fare” (how your leave balance will be applied).
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Tag tone={withinCarry ? "good" : "warn"}>
              {withinCarry ? "Carry-forward window: OPEN" : "Carry-forward window: CLOSED"}
            </Tag>
            <Tag tone="info">{leaveType.name}</Tag>
            <Tag tone={pay === "FULL" ? "good" : pay === "HALF" ? "warn" : "neutral"}>
              {payLabel(pay)}
            </Tag>
            {isFixed ? <Tag tone="info">Fixed: {fixedDays} day(s)</Tag> : <Tag>No fixed duration</Tag>}
            <Tag>Total days: {days || "—"}</Tag>
          </div>
        </div>
      </div>

      {/* Fare cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {fares.map((card) => (
          <FareCardView
            key={card.key}
            card={card}
            selected={selected === card.key}
            onSelect={() => selectFare(card)}
          />
        ))}
      </div>

      {/* Fare comparison (flight-like grid) */}
      <div className="border rounded-lg bg-white p-4">
        <div className="font-semibold">Compare fares</div>
        <div className="text-sm text-neutral-500 mt-1">
          See how each option affects balances and policy outcomes.
        </div>

        <div className="mt-4 grid gap-3">
          <CompareRow
            label="Balance after booking"
            values={[
              <div key="s" className="space-y-1">
                {moneyRow("Carry-forward", `${after.SMART.cf}`)}
                {moneyRow("Current-year", `${after.SMART.cy}`)}
              </div>,
              <div key="c" className="space-y-1">
                {moneyRow("Carry-forward", `${after.CURRENT_ONLY.cf}`)}
                {moneyRow("Current-year", `${after.CURRENT_ONLY.cy}`)}
              </div>,
              <div key="co" className="space-y-1">
                {moneyRow("Carry-forward", `${after.CARRY_ONLY.cf}`)}
                {moneyRow("Current-year", `${after.CARRY_ONLY.cy}`)}
              </div>,
            ]}
          />

          <CompareRow
            label="Leave type impact"
            values={[
              <div key="s" className="space-y-2">
                <Tag tone={pay === "FULL" ? "good" : pay === "HALF" ? "warn" : "neutral"}>{payLabel(pay)}</Tag>
                {isFixed ? <Tag tone="info">Fixed: {fixedDays} day(s)</Tag> : <Tag>No fixed duration</Tag>}
              </div>,
              <div key="c" className="space-y-2">
                <Tag tone={pay === "FULL" ? "good" : pay === "HALF" ? "warn" : "neutral"}>{payLabel(pay)}</Tag>
                {isFixed ? <Tag tone="info">Fixed: {fixedDays} day(s)</Tag> : <Tag>No fixed duration</Tag>}
              </div>,
              <div key="co" className="space-y-2">
                <Tag tone={pay === "FULL" ? "good" : pay === "HALF" ? "warn" : "neutral"}>{payLabel(pay)}</Tag>
                {isFixed ? <Tag tone="info">Fixed: {fixedDays} day(s)</Tag> : <Tag>No fixed duration</Tag>}
              </div>,
            ]}
          />

          <CompareRow
            label="Carry-forward expiry impact"
            values={[
              <div key="s">
                {canUseCarry ? <Tag tone="good">Reduces expiry risk</Tag> : <Tag>No impact</Tag>}
              </div>,
              <div key="c">
                {canUseCarry ? <Tag tone="warn">May expire unused</Tag> : <Tag>No impact</Tag>}
              </div>,
              <div key="co">
                <Tag tone={withinCarry ? "good" : "warn"}>Consumes before expiry</Tag>
              </div>,
            ]}
          />

          <CompareRow
            label="Approval route (preview)"
            values={[
              <div key="s" className="text-neutral-700">
                LM → Escalate to GM<br />
                <span className="text-xs text-neutral-500">{slaDue}</span>
              </div>,
              <div key="c" className="text-neutral-700">
                LM → Escalate to GM<br />
                <span className="text-xs text-neutral-500">{slaDue}</span>
              </div>,
              <div key="co" className="text-neutral-700">
                LM → Escalate to GM<br />
                <span className="text-xs text-neutral-500">{slaDue}</span>
              </div>,
            ]}
          />
        </div>

        <div className="mt-4 text-xs text-neutral-500">
          Note: Leave type configuration (pay category, default duration) will come from contract admin settings once we connect Supabase.
        </div>
      </div>
    </div>
  );
}
