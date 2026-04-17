import { type ReactNode } from "react";
import { AsyncDataPanel } from "../async-data-panel";
import { MahajansEmptyState } from "./MahajansEmptyState";

interface MahajansAsyncPanelProps {
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

export function MahajansAsyncPanel({
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  loaderColumns = 5,
  children,
}: Readonly<MahajansAsyncPanelProps>) {
  return (
    <AsyncDataPanel
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={isEmpty}
      loaderColumns={loaderColumns}
      errorDescription="The lender list could not be loaded. Check your connection and try again."
      empty={
        <MahajansEmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      }
    >
      {children}
    </AsyncDataPanel>
  );
}
