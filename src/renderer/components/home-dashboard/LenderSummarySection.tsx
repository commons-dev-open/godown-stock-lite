import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

interface LenderSummarySectionProps {
  content: ReactNode;
}

function LenderSummarySectionComponent({
  content,
}: Readonly<LenderSummarySectionProps>) {
  return (
    <article className="dashboard-panel">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Lender Summary
        </h2>
        <Link
          to="/mahajans"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
        >
          View Lenders
          <ExternalLink size={16} aria-hidden="true" />
        </Link>
      </div>
      {content}
    </article>
  );
}

export const LenderSummarySection = memo(LenderSummarySectionComponent);
