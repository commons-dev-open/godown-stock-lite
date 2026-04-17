import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LowStockAlertsSectionProps {
  count: number;
  content: ReactNode;
}

function LowStockAlertsSectionComponent({
  count,
  content,
}: Readonly<LowStockAlertsSectionProps>) {
  const { t } = useTranslation("home");

  return (
    <article className="dashboard-panel xl:col-span-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t("sections.lowStockAlerts")}
          {count > 0 ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning-text)]">
              <AlertTriangle size={14} aria-hidden="true" />
              {count}
            </span>
          ) : null}
        </h2>
        <Link
          to="/stock"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
        >
          {t("lowStock.viewStock")}
          <ExternalLink size={16} aria-hidden="true" />
        </Link>
      </div>
      {content}
    </article>
  );
}

export const LowStockAlertsSection = memo(LowStockAlertsSectionComponent);
