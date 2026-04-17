import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

interface DashboardEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}

export function DashboardEmptyState({
  title,
  description,
  actionLabel,
  actionTo,
}: Readonly<DashboardEmptyStateProps>) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-surface-raised)] px-4 py-6 text-center">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-1 max-w-md text-xs text-[var(--color-text-secondary)]">
        {description}
      </p>
      {actionLabel && actionTo ? (
        <Link
          to={actionTo}
          className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
        >
          {actionLabel}
          <ExternalLink size={14} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
