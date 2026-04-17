interface UnitsEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function UnitsEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: Readonly<UnitsEmptyStateProps>) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-surface-raised)] px-4 py-8 text-center">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-1 max-w-md text-xs text-[var(--color-text-secondary)]">
        {description}
      </p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-raised)]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
