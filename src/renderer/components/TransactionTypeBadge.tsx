export type TransactionType = "lend" | "deposit" | "cash_purchase";

const typeStyles: Record<
  TransactionType,
  { className: string; label: string }
> = {
  lend: { className: "bg-amber-100 text-amber-800", label: "Lend" },
  deposit: { className: "bg-green-100 text-green-800", label: "Deposit" },
  cash_purchase: { className: "bg-blue-100 text-blue-800", label: "Cash" },
};

export default function TransactionTypeBadge({
  type,
}: Readonly<{ type: TransactionType }>) {
  const { className, label } = typeStyles[type];
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
