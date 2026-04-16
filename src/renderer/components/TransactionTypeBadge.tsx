export type TransactionType = "credit_purchase" | "settlement" | "cash_purchase";

const typeStyles: Record<
  TransactionType,
  { className: string; label: string }
> = {
  credit_purchase: { className: "bg-[var(--color-warning-subtle)] text-[var(--color-warning-text)]", label: "Credit Purchase" },
  settlement: { className: "bg-[var(--color-success-subtle)] text-[var(--color-success-text)]", label: "Settlement" },
  cash_purchase: { className: "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]", label: "Cash" },
};

export default function TransactionTypeBadge({
  type,
}: Readonly<{ type: TransactionType | "lend" | "deposit" }>) {
  const normalized =
    type === "lend" ? "credit_purchase" : type === "deposit" ? "settlement" : type;
  const { className, label } = typeStyles[normalized as TransactionType] ?? {
    className: "bg-[var(--color-bg-surface-raised)] text-[var(--color-text-primary)]",
    label: String(type),
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}
