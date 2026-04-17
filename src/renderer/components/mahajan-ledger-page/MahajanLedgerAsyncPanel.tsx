import { type ReactNode } from "react";
import { AsyncDataPanel } from "../async-data-panel";
import { SalesListEmptyState } from "../sales-list-page/SalesListEmptyState";

interface MahajanLedgerAsyncPanelProps {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  emptySecondaryLabel?: string;
  onEmptySecondary?: () => void;
  children: ReactNode;
}

export function MahajanLedgerAsyncPanel({
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  emptySecondaryLabel,
  onEmptySecondary,
  children,
}: Readonly<MahajanLedgerAsyncPanelProps>) {
  return (
    <AsyncDataPanel
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={isEmpty}
      loaderColumns={5}
      errorTitle="Something went wrong"
      errorDescription="This ledger could not be loaded. Check your connection and try again."
      empty={
        <SalesListEmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
          secondaryActionLabel={emptySecondaryLabel}
          onSecondaryAction={onEmptySecondary}
        />
      }
    >
      {children}
    </AsyncDataPanel>
  );
}
