import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Banknote, FilePlus, History } from "lucide-react";
import { useTranslation } from "react-i18next";

interface QuickActionsSectionProps {
  cashExpenditureContent: ReactNode;
}

function QuickActionsSectionComponent({
  cashExpenditureContent,
}: Readonly<QuickActionsSectionProps>) {
  const { t } = useTranslation("home");

  return (
    <article className="dashboard-panel xl:col-span-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
        {t("sections.quickActions")}
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
              {t("quickActions.createInvoice.title")}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {t("quickActions.createInvoice.subtitle")}
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
              {t("quickActions.creditPurchase.title")}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {t("quickActions.creditPurchase.subtitle")}
            </p>
          </div>
        </Link>
        <Link to="/stock-history" className="dashboard-action-card">
          <History
            size={22}
            className="text-[var(--color-text-secondary)] shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("quickActions.stockHistory.title")}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {t("quickActions.stockHistory.subtitle")}
            </p>
          </div>
        </Link>
      </div>
      <div className="mt-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] p-3">
        <p className="text-xs text-[var(--color-text-tertiary)] mb-1">
          {t("quickActions.cashVsExpenditure")}
        </p>
        {cashExpenditureContent}
      </div>
    </article>
  );
}

export const QuickActionsSection = memo(QuickActionsSectionComponent);
