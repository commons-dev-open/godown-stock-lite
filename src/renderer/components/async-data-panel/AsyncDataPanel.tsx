import { type ReactNode } from "react";
import TableLoader from "../TableLoader";

interface AsyncDataPanelProps {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isEmpty: boolean;
  empty: ReactNode;
  children: ReactNode;
  loaderColumns?: number;
  loaderRows?: number;
  errorTitle?: string;
  errorDescription?: string;
}

export function AsyncDataPanel({
  isLoading,
  isError,
  onRetry,
  isEmpty,
  empty,
  children,
  loaderColumns = 4,
  loaderRows = 6,
  errorTitle = "Something went wrong",
  errorDescription = "This content could not be loaded. Check your connection and try again.",
}: Readonly<AsyncDataPanelProps>) {
  if (isLoading) {
    return <TableLoader columns={loaderColumns} rows={loaderRows} />;
  }
  if (isError) {
    return (
      <div
        className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-4 py-8 text-center"
        role="alert"
      >
        <p className="text-sm font-semibold text-[var(--color-danger)]">
          {errorTitle}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {errorDescription}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-[var(--color-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)]"
        >
          Retry
        </button>
      </div>
    );
  }
  if (isEmpty) {
    return <>{empty}</>;
  }
  return <>{children}</>;
}
