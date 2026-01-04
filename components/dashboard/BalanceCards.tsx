"use client";

// components/dashboard/BalanceCards.tsx
export type BalanceCardItem = {
  code: string;
  title: string;
  value: string;
  subtitle?: string;
  hint?: string;
};

function BalanceCard({ title, value, subtitle, hint }: Omit<BalanceCardItem, "code">) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {subtitle ? <div className="mt-1 text-sm text-neutral-700">{subtitle}</div> : null}
      {hint ? <div className="mt-2 text-xs text-neutral-500">{hint}</div> : null}
    </div>
  );
}

export default function BalanceCards({
  items,
  loading,
}: {
  items: BalanceCardItem[];
  loading?: boolean;
}) {
  if (loading && items.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 text-sm text-neutral-500">Loading balances…</div>
        <div className="rounded-xl border bg-white p-4 text-sm text-neutral-500">Loading balances…</div>
        <div className="rounded-xl border bg-white p-4 text-sm text-neutral-500">Loading balances…</div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-4 text-sm text-neutral-500">
        No balance data available yet.
      </div>
    );
  }

  // Show first 3 cards, but keep DB-driven ordering (already sorted by name)
  const top = items.slice(0, 3);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {top.map((it) => (
        <BalanceCard
          key={it.code}
          title={it.title}
          value={it.value}
          subtitle={it.subtitle}
          hint={it.hint}
        />
      ))}
    </div>
  );
}
