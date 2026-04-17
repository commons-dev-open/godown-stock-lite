import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("mahajans");
  return (
    <AsyncDataPanel
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={isEmpty}
      loaderColumns={loaderColumns}
      errorDescription={t("errors.lenderListLoad")}
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
