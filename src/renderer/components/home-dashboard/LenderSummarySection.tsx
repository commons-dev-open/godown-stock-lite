import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LenderSummarySectionProps {
  content: ReactNode;
}

function LenderSummarySectionComponent({
  content,
}: Readonly<LenderSummarySectionProps>) {
  const { t } = useTranslation("home");

  return (
    <article className="dashboard-panel">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t("sections.lenderSummary")}
        </h2>
        <Link
          to="/mahajans"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
        >
          {t("lender.viewLenders")}
          <ExternalLink size={16} aria-hidden="true" />
        </Link>
      </div>
      {content}
    </article>
  );
}

export const LenderSummarySection = memo(LenderSummarySectionComponent);
