// components/dashboard/BalanceCards.tsx
"use client";

type BalanceCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  hint?: string;
};

function BalanceCard({ title, value, subtitle, hint }: BalanceCardProps) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {subtitle ? <div className="mt-1 text-sm text-neutral-700">{subtitle}</div> : null}
      {hint ? <div className="mt-2 text-xs text-neutral-500">{hint}</div> : null}
    </div>
  );
}

export default function BalanceCards() {
  // Mock values (later from Supabase balances)
  const annualRemaining = 18;
  const carryForwardRemaining = 4;
  const birthdayRemaining = 1;

  const withinCarryWindow = true; // mock

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <BalanceCard
        title="Annual leave remaining"
        value={`${annualRemaining}`}
        subtitle="Working days"
        hint="Based on your grade entitlement and approved leaves."
      />
      <BalanceCard
        title="Carry-forward remaining"
        value={`${carryForwardRemaining}`}
        subtitle={withinCarryWindow ? "Usable until Mar 31" : "Window closed"}
        hint="Carry-forward is consumed first in Smart Apply (when allowed)."
      />
      <BalanceCard
        title="Birthday leave"
        value={`${birthdayRemaining}`}
        subtitle="Day per year"
        hint="Non-carry-forward. Limited to 1 per leave year."
      />
    </div>
  );
}
