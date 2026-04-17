import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Banknote, FilePlus } from "lucide-react";

interface QuickActionsSectionProps {
  cashExpenditureContent: ReactNode;
}

function QuickActionsSectionComponent({
  cashExpenditureContent,
}: Readonly<QuickActionsSectionProps>) {
  return (
    <article className="dashboard-panel xl:col-span-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
        Quick Actions
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
        <Link
          to="/invoices"
          state={{ openCreate: true }}
          className="dashboard-action-card"
        >
          <FilePlus
            size={22}
            className="text-[var(--color-accent)] shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Create Invoice
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Start a fresh sale entry.
            </p>
          </div>
        </Link>
        <Link
          to="/transactions"
          state={{ openLend: true }}
          className="dashboard-action-card"
        >
          <Banknote
            size={22}
            className="text-[var(--color-success)] shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Credit Purchase
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Record lender transactions fast.
            </p>
          </div>
        </Link>
      </div>
      <div className="mt-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] p-3">
        <p className="text-xs text-[var(--color-text-tertiary)] mb-1">
          Cash vs Expenditure (weekly)
        </p>
        {cashExpenditureContent}
      </div>
    </article>
  );
}

export const QuickActionsSection = memo(QuickActionsSectionComponent);
