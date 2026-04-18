import { useTranslation } from "react-i18next";

export type TransactionType =
  | "credit_purchase"
  | "settlement"
  | "cash_purchase"
  | "lender_refund";

const typeStyles: Record<TransactionType, { className: string }> = {
  credit_purchase: {
    className: "bg-[var(--color-warning-subtle)] text-[var(--color-warning-text)]",
  },
  settlement: {
    className: "bg-[var(--color-success-subtle)] text-[var(--color-success-text)]",
  },
  cash_purchase: {
    className: "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]",
  },
  lender_refund: {
    className: "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]",
  },
};

export default function TransactionTypeBadge({
  type,
}: Readonly<{ type: TransactionType | "lend" | "deposit" }>) {
  const { t } = useTranslation("transactions");
  const normalized: TransactionType =
    type === "lend"
      ? "credit_purchase"
      : type === "deposit"
        ? "settlement"
        : type === "lender_refund"
          ? "lender_refund"
          : (type as TransactionType);
  const { className } = typeStyles[normalized] ?? {
    className: "bg-[var(--color-bg-surface-raised)] text-[var(--color-text-primary)]",
  };
  let label = String(type);
  if (normalized === "credit_purchase") {
    label = t("types.credit_purchase");
  } else if (normalized === "settlement") {
    label = t("types.settlement");
  } else if (normalized === "cash_purchase") {
    label = t("types.cash_purchase");
  } else if (normalized === "lender_refund") {
    label = t("types.lender_refund");
  }
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}
