import { useMemo, useState, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { getElectron } from "../api/client";
import { PAGE_SIZE } from "../../shared/constants";
import DateInput from "../components/DateInput";
import DataTable from "../components/DataTable";
import {
  SalesListHero,
  SalesListSectionPanel,
  SalesListAsyncPanel,
} from "../components/sales-list-page";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import { formatDateForView, formatDateForForm } from "../lib/date";
import { formatDecimal } from "../../shared/numbers";
import Tooltip from "../components/Tooltip";
import { PAGE } from "shared/test-ids";

interface ItemOption {
  id: number;
  name: string;
}

interface StockMovementRow {
  id: number;
  item_id: number;
  item_name: string;
  delta_qty: number;
  reason: string;
  ref_kind: string | null;
  ref_id: number | null;
  occurred_at: string;
  note: string | null;
  balance_after: number;
}

function reasonLabel(reason: string, t: TFunction<"items">): string {
  if (reason === "purchase") return t("stockHistory.filters.purchase");
  if (reason === "invoice_sale")
    return t("stockHistory.filters.invoice_sale");
  if (reason === "adjustment")
    return t("stockHistory.filters.adjustment");
  return reason;
}

function sourceLinkForRow(
  row: StockMovementRow,
  t: TFunction<"items">
): { to: string; label: string } | null {
  if (row.reason === "invoice_sale") {
    return { to: "/invoices", label: t("stockHistory.links.invoices") };
  }
  if (
    row.reason === "purchase" ||
    row.ref_kind === "supplier_purchase_line"
  ) {
    return {
      to: "/purchases",
      label: t("stockHistory.links.purchases"),
    };
  }
  return null;
}

export default function StockHistory() {
  const { t } = useTranslation("items");
  const { t: tTx } = useTranslation("transactions");
  const api = getElectron();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterReason, setFilterReason] = useState("");

  const itemIdFromUrl = searchParams.get("itemId");
  const selectedItemId =
    itemIdFromUrl && !Number.isNaN(Number(itemIdFromUrl))
      ? Number(itemIdFromUrl)
      : "";

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.getItems(),
  });

  const itemOptions = useMemo(
    () =>
      (items as ItemOption[]).map((i) => ({
        id: i.id,
        name: i.name,
      })),
    [items]
  );

  useEffect(() => {
    setPage(1);
  }, [selectedItemId, filterDateFrom, filterDateTo, filterReason]);

  const { data: pageData, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "stockHistory",
      selectedItemId || null,
      filterDateFrom,
      filterDateTo,
      filterReason,
      page,
    ],
    queryFn: () =>
      api.getStockHistoryPage({
        itemId:
          typeof selectedItemId === "number" ? selectedItemId : undefined,
        fromDate: filterDateFrom || undefined,
        toDate: filterDateTo || undefined,
        reason: filterReason || undefined,
        page,
        limit: PAGE_SIZE,
      }) as Promise<{ data: StockMovementRow[]; total: number }>,
  });

  const rows = pageData?.data ?? [];
  const total = pageData?.total ?? 0;

  const setItemFilter = useCallback(
    (id: number | "") => {
      const next = new URLSearchParams(searchParams);
      if (id === "") {
        next.delete("itemId");
      } else {
        next.set("itemId", String(id));
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const columns = useMemo(
    () => [
      {
        key: "occurred_at",
        label: t("stockHistory.columns.date"),
        render: (row: StockMovementRow) => (
          <Tooltip content={formatDateForForm(row.occurred_at)}>
            <span>{formatDateForView(row.occurred_at)}</span>
          </Tooltip>
        ),
      },
      {
        key: "item_name",
        label: t("stockHistory.columns.product"),
        render: (row: StockMovementRow) => (
          <span className="font-medium text-[var(--color-text-primary)]">
            {row.item_name}
          </span>
        ),
      },
      {
        key: "delta_qty",
        label: t("stockHistory.columns.delta"),
        align: "right" as const,
        render: (row: StockMovementRow) => (
          <span
            className={
              row.delta_qty >= 0
                ? "text-[var(--color-success)] font-medium tabular-nums"
                : "text-[var(--color-danger)] font-medium tabular-nums"
            }
          >
            {row.delta_qty >= 0 ? "+" : ""}
            {formatDecimal(row.delta_qty)}
          </span>
        ),
      },
      {
        key: "balance_after",
        label: t("stockHistory.columns.balance"),
        align: "right" as const,
        render: (row: StockMovementRow) => (
          <span className="tabular-nums text-[var(--color-text-secondary)]">
            {formatDecimal(row.balance_after)}
          </span>
        ),
      },
      {
        key: "reason",
        label: t("stockHistory.columns.reason"),
        render: (row: StockMovementRow) => (
          <span className="text-sm text-[var(--color-text-secondary)]">
            {reasonLabel(row.reason, t)}
          </span>
        ),
      },
      {
        key: "source",
        label: t("stockHistory.columns.source"),
        render: (row: StockMovementRow) => {
          const link = sourceLinkForRow(row, t);
          if (link) {
            return (
              <Link
                to={link.to}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                {link.label}
              </Link>
            );
          }
          if (row.ref_kind && row.ref_id != null) {
            return (
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {row.ref_kind} #{row.ref_id}
              </span>
            );
          }
          return (
            <span className="text-[var(--color-text-tertiary)]">—</span>
          );
        },
      },
      {
        key: "note",
        label: t("stockHistory.columns.note"),
        render: (row: StockMovementRow) => (
          <span
            className="max-w-[10rem] truncate text-sm text-[var(--color-text-tertiary)]"
            title={row.note ?? ""}
          >
            {row.note ?? "—"}
          </span>
        ),
      },
    ],
    [t]
  );

  const hasFilters =
    selectedItemId !== "" ||
    Boolean(filterDateFrom) ||
    Boolean(filterDateTo) ||
    Boolean(filterReason);

  return (
    <div className="space-y-4 home-dashboard pb-3" data-testid={PAGE.stockHistory}>
      <SalesListHero
        title={t("stockHistory.hero.title")}
        metrics={[]}
        actions={null}
      />

      <DashboardSectionBoundary
        sectionTitle={t("stockHistory.hero.title")}
        containerClassName="dashboard-panel"
        resetKeys={[
          selectedItemId,
          filterDateFrom,
          filterDateTo,
          filterReason,
          page,
          isLoading,
          isError,
          rows.length,
        ]}
      >
        <SalesListSectionPanel
          title={t("stockHistory.hero.title")}
          description={t("stockHistory.hero.subtitle")}
        >
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] p-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              {t("stockHistory.filters.item")}
              <select
                className="rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm"
                value={selectedItemId === "" ? "" : String(selectedItemId)}
                onChange={(e) =>
                  setItemFilter(
                    e.target.value ? Number(e.target.value) : ""
                  )
                }
              >
                <option value="">{t("stockHistory.filters.allItems")}</option>
                {itemOptions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[10rem] flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              {t("stockHistory.filters.reason")}
              <select
                className="rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-sm"
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
              >
                <option value="">{t("stockHistory.filters.allReasons")}</option>
                <option value="purchase">
                  {t("stockHistory.filters.purchase")}
                </option>
                <option value="invoice_sale">
                  {t("stockHistory.filters.invoice_sale")}
                </option>
                <option value="adjustment">
                  {t("stockHistory.filters.adjustment")}
                </option>
              </select>
            </label>
            <label className="flex min-w-[9rem] flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              {tTx("filters.from_date")}
              <DateInput
                value={filterDateFrom}
                onChange={setFilterDateFrom}
                className="rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex min-w-[9rem] flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
              {tTx("filters.to_date")}
              <DateInput
                value={filterDateTo}
                onChange={setFilterDateTo}
                className="rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-sm"
              />
            </label>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilterDateFrom("");
                  setFilterDateTo("");
                  setFilterReason("");
                  setItemFilter("");
                  setPage(1);
                }}
                className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline"
              >
                {tTx("filters.clear")}
              </button>
            )}
          </div>

          <div className="mt-4">
            <SalesListAsyncPanel
              isLoading={isLoading}
              isError={isError}
              onRetry={() => {
                void refetch();
              }}
              isEmpty={!isLoading && !isError && rows.length === 0}
              emptyTitle={
                hasFilters
                  ? tTx("empty.no_matching_title")
                  : t("stockHistory.empty.title")
              }
              emptyDescription={
                hasFilters
                  ? tTx("empty.no_matching_message")
                  : t("stockHistory.empty.message")
              }
              emptyActionLabel={
                hasFilters ? tTx("filters.clear") : undefined
              }
              onEmptyAction={
                hasFilters
                  ? () => {
                      setFilterDateFrom("");
                      setFilterDateTo("");
                      setFilterReason("");
                      setItemFilter("");
                      setPage(1);
                    }
                  : undefined
              }
              loaderColumns={6}
            >
              <DataTable<StockMovementRow>
                scrollMaxHeight={`calc(100vh - 22rem)`}
                columns={columns}
                data={rows}
                getRowKey={(r) => String(r.id)}
                tableClassName="min-w-full divide-y divide-[var(--color-border-default)]"
                rowClassName="group border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors"
                pagination={{
                  type: "controlled",
                  page,
                  total,
                  onPageChange: setPage,
                  pageSize: PAGE_SIZE,
                }}
              />
            </SalesListAsyncPanel>
          </div>
        </SalesListSectionPanel>
      </DashboardSectionBoundary>
    </div>
  );
}
