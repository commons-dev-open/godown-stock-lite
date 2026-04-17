import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import TableLoader from "../TableLoader";
import { UnitsEmptyState } from "./UnitsEmptyState";

interface UnitsAsyncPanelProps {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  loaderColumns?: number;
  children: ReactNode;
}

export function UnitsAsyncPanel({
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  loaderColumns = 4,
  children,
}: Readonly<UnitsAsyncPanelProps>) {
  const { t } = useTranslation("units");
  if (isLoading) {
    return <TableLoader columns={loaderColumns} rows={6} />;
  }
  if (isError) {
    return (
      <div
        className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-4 py-8 text-center"
        role="alert"
      >
        <p className="text-sm font-semibold text-[var(--color-danger)]">
          {t("async.errorTitle")}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {t("async.errorDescription")}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-[var(--color-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)]"
        >
          {t("async.retry")}
        </button>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <UnitsEmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }
  return <>{children}</>;
}
