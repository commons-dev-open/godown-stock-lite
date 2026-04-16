import { type ReactNode } from "react";
import { Plus } from "lucide-react";

interface EmptyStateProps {
  message?: string;
  /** When true, uses border and bg (for inside a card). Default true. */
  bordered?: boolean;
  /** Optional button label (e.g. "Create Invoice"). When set, onAction is required. */
  actionLabel?: string;
  /** Called when the action button is clicked. */
  onAction?: () => void;
  /** Optional icon element displayed above the message. */
  icon?: ReactNode;
  /** Optional secondary description text displayed below the message. */
  description?: string;
}

const defaultMessage = "No records match the filters.";

export default function EmptyState({
  message = defaultMessage,
  bordered = true,
  actionLabel,
  onAction,
  icon,
  description,
}: EmptyStateProps) {
  const className = bordered
    ? "text-center py-16 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)]"
    : "text-center py-16";

  return (
    <div className={className}>
      {icon && (
        <div className="flex justify-center mb-3 text-[var(--color-text-tertiary)]">{icon}</div>
      )}
      <p className="font-medium text-[var(--color-text-secondary)]">{message}</p>
      {description && (
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{description}</p>
      )}
      {actionLabel && onAction && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-raised)]"
          >
            <Plus size={20} aria-hidden="true" />
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
