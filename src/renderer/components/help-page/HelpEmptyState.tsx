import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HelpEmptyStateProps {
  onRetry: () => void;
}

export function HelpEmptyState({ onRetry }: Readonly<HelpEmptyStateProps>) {
  const { t } = useTranslation("help");
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
        <BookOpen size={24} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">
        {t("emptyGuide.title")}
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
        {t("emptyGuide.message")}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-raised)]"
      >
        {t("emptyGuide.retry")}
      </button>
    </div>
  );
}
