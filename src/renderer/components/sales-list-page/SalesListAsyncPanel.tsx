import { type ReactNode } from "react";
import { AsyncDataPanel } from "../async-data-panel";
import { SalesListEmptyState } from "./SalesListEmptyState";

interface SalesListAsyncPanelProps {
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
  loaderColumns?: number;
  children: ReactNode;
}

export function SalesListAsyncPanel({
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
  loaderColumns = 4,
  children,
}: Readonly<SalesListAsyncPanelProps>) {
  return (
    <AsyncDataPanel
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={isEmpty}
      loaderColumns={loaderColumns}
      errorDescription="This list could not be loaded. Check your connection and try again."
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
