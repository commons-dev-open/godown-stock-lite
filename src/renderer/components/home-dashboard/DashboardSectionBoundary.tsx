import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import ErrorBoundary from "../ErrorBoundary";

interface DashboardSectionErrorStateProps {
  sectionTitle: string;
  containerClassName: string;
  error: Error;
  onRetry: () => void;
}

interface DashboardSectionBoundaryProps {
  sectionTitle: string;
  containerClassName: string;
  resetKeys?: readonly unknown[];
  children: ReactNode;
}

function DashboardSectionErrorState({
  sectionTitle,
  containerClassName,
  error,
  onRetry,
}: Readonly<DashboardSectionErrorStateProps>) {
  const { t } = useTranslation("home");

  return (
    <article className={containerClassName}>
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-danger)]">
        {t("sectionError.badge")}
      </p>
      <h2 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
        {sectionTitle}
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {t("sectionError.description")}
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
        {error.message || t("sectionError.fallbackMessage")}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-[var(--color-border-default)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-raised)]"
      >
        {t("sectionError.retry")}
      </button>
    </article>
  );
}

export function DashboardSectionBoundary({
  sectionTitle,
  containerClassName,
  resetKeys,
  children,
}: Readonly<DashboardSectionBoundaryProps>) {
  return (
    <ErrorBoundary
      fallback={({ error, resetErrorBoundary }) => (
        <DashboardSectionErrorState
          sectionTitle={sectionTitle}
          containerClassName={containerClassName}
          error={error}
          onRetry={resetErrorBoundary}
        />
      )}
      resetKeys={resetKeys}
    >
      {children}
    </ErrorBoundary>
  );
}
