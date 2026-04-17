import { BookOpen } from "lucide-react";

interface HelpEmptyStateProps {
  onRetry: () => void;
}

export function HelpEmptyState({ onRetry }: Readonly<HelpEmptyStateProps>) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
        <BookOpen size={24} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">
        No guide content
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
        The help topics could not be loaded. Check that the app files are complete, then try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-raised)]"
      >
        Retry
      </button>
    </div>
  );
}
