export type TransactionType = "credit_purchase" | "settlement" | "cash_purchase";

const typeStyles: Record<
  TransactionType,
  { className: string; label: string }
> = {
  credit_purchase: { className: "bg-amber-100 text-amber-800", label: "Credit Purchase" },
  settlement: { className: "bg-green-100 text-green-800", label: "Settlement" },
  cash_purchase: { className: "bg-blue-100 text-blue-800", label: "Cash" },
};

export default function TransactionTypeBadge({
  type,
}: Readonly<{ type: TransactionType | "lend" | "deposit" }>) {
  const normalized =
    type === "lend" ? "credit_purchase" : type === "deposit" ? "settlement" : type;
  const { className, label } = typeStyles[normalized as TransactionType] ?? {
    className: "bg-gray-100 text-gray-800",
    label: String(type),
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
