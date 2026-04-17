import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { useTranslation } from "react-i18next";
import { getElectron } from "../api/client";
import TableLoader from "../components/TableLoader";
import DataTable from "../components/DataTable";
import { formatDateForView, formatDateForForm, todayISO } from "../lib/date";
import Tooltip from "../components/Tooltip";
import {
  DashboardEmptyState,
  DashboardHero,
  DashboardSectionBoundary,
  LenderSummarySection,
  LowStockAlertsSection,
  QuickActionsSection,
  RangeCompositionSection,
  WeeklyDetailsSection,
  WeeklyMomentumSection,
} from "../components/home-dashboard";
import {
  DATE_PRESETS,
  getMonthStart,
} from "../components/home-dashboard/datePresets";
import {
  createCashExpenditureOption,
  createRangeBreakdownOption,
  createWeeklyTrendOption,
  getThemePalette,
} from "../components/home-dashboard/chartOptions";
import {
  type DatePreset,
  type LowStockItem,
  type WeeklyRow,
} from "../components/home-dashboard/types";
import {
  formatDecimal,
  formatAbbreviatedRupee,
  formatRupee,
  NUMBER_ABBREVIATION_STYLE_KEY,
  parseNumberAbbreviationStyle,
} from "../../shared/numbers";

interface ReportSummary {
  todaySale: number;
  weekSale: number;
  monthSale: number;
}

interface MahajanSummary {
  totalLend: number;
  totalDeposit: number;
  balance: number;
  countOweMe: number;
  countIOwe: number;
  totalCreditPurchase?: number;
  totalSettlement?: number;
}

interface TotalSaleResult {
  invoice_sales?: number;
  misc_sales?: number;
  expenditure?: number;
  total: number;
}

function netBalanceClass(balance: number): string {
  if (balance > 0) return "text-[var(--color-danger)]";
  if (balance < 0) return "text-[var(--color-success)]";
  return "text-[var(--color-text-primary)]";
}

export default function Home() {
  const { t } = useTranslation("home");
  const api = getElectron();
  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const abbreviationStyle = useMemo(
    () => parseNumberAbbreviationStyle(settings[NUMBER_ABBREVIATION_STYLE_KEY]),
    [settings]
  );
  const defaultTotalFrom = useMemo(() => getMonthStart(), []);
  const defaultTotalTo = useMemo(() => todayISO(), []);
  const [weeklyDate, setWeeklyDate] = useState(todayISO());
  const [totalFrom, setTotalFrom] = useState(defaultTotalFrom);
  const [totalTo, setTotalTo] = useState(defaultTotalTo);

  const { data: reportSummary, isLoading: reportSummaryLoading } =
    useQuery<ReportSummary>({
      queryKey: ["reportSummary"],
      queryFn: () => api.getReportSummary(),
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    });
  const { data: mahajanSummary, isLoading: mahajanSummaryLoading } =
    useQuery<MahajanSummary>({
      queryKey: ["mahajanSummary"],
      queryFn: () => api.getMahajanSummary(),
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    });
  const {
    data: lowStockItemsData,
    isLoading: lowStockLoading,
    isError: lowStockError,
  } = useQuery<LowStockItem[]>({
    queryKey: ["lowStockItems"],
    queryFn: async () => (await api.getLowStockItems()) as LowStockItem[],
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
  });
  const {
    data: weeklySalesData,
    isLoading: weeklyLoading,
    isError: weeklyError,
  } = useQuery<WeeklyRow[]>({
    queryKey: ["weeklySale", weeklyDate],
    queryFn: async () => (await api.getWeeklySale(weeklyDate)) as WeeklyRow[],
    enabled: !!weeklyDate,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
  const { data: totalSaleResult, isLoading: totalSaleLoading } =
    useQuery<TotalSaleResult>({
      queryKey: ["totalSale", totalFrom, totalTo],
      queryFn: () => api.getTotalSale(totalFrom, totalTo),
      enabled: !!totalFrom && !!totalTo,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    });

  const lowStockItems = lowStockItemsData ?? [];
  const weeklySales = weeklySalesData ?? [];

  const applyPreset = useCallback((preset: DatePreset) => {
    setTotalFrom(preset.getFrom());
    setTotalTo(preset.getTo());
  }, []);
  const handlePresetClick = useCallback(
    (label: string) => {
      const selectedPreset = DATE_PRESETS.find(
        (preset) => preset.label === label
      );
      if (!selectedPreset) {
        return;
      }
      applyPreset(selectedPreset);
    },
    [applyPreset]
  );
  const isPresetActive = useCallback(
    (preset: DatePreset) => {
      return totalFrom === preset.getFrom() && totalTo === preset.getTo();
    },
    [totalFrom, totalTo]
  );
  const isPresetLabelActive = useCallback(
    (label: string) => {
      const selectedPreset = DATE_PRESETS.find(
        (preset) => preset.label === label
      );
      if (!selectedPreset) {
        return false;
      }
      return isPresetActive(selectedPreset);
    },
    [isPresetActive]
  );

  const palette = useMemo(
    () => getThemePalette(),
    [weeklySales.length, totalSaleResult]
  );
  const orderedWeeklyData = useMemo(
    () => [...weeklySales].reverse(),
    [weeklySales]
  );
  const totalWeekSales = useMemo(
    () =>
      orderedWeeklyData.reduce((sum, row) => sum + (row.sale_amount ?? 0), 0),
    [orderedWeeklyData]
  );
  const totalWeekExpenditure = useMemo(
    () =>
      orderedWeeklyData.reduce(
        (sum, row) => sum + (row.expenditure_amount ?? 0),
        0
      ),
    [orderedWeeklyData]
  );

  const peakWeekSale = useMemo(
    () =>
      orderedWeeklyData.reduce(
        (maxValue, row) => Math.max(maxValue, row.sale_amount ?? 0),
        0
      ),
    [orderedWeeklyData]
  );
  const hasWeeklySales = orderedWeeklyData.length > 0;
  const hasRangeData =
    (totalSaleResult?.invoice_sales ?? 0) > 0 ||
    (totalSaleResult?.misc_sales ?? 0) > 0 ||
    (totalSaleResult?.expenditure ?? 0) > 0;
  const todaySaleLabel = reportSummaryLoading
    ? "..."
    : formatAbbreviatedRupee(reportSummary?.todaySale ?? 0, abbreviationStyle);
  const weekSaleLabel = reportSummaryLoading
    ? "..."
    : formatAbbreviatedRupee(reportSummary?.weekSale ?? 0, abbreviationStyle);
  const monthSaleLabel = reportSummaryLoading
    ? "..."
    : formatAbbreviatedRupee(reportSummary?.monthSale ?? 0, abbreviationStyle);
  const lenderNetLabel = mahajanSummaryLoading
    ? "..."
    : formatAbbreviatedRupee(
        Math.abs(mahajanSummary?.balance ?? 0),
        abbreviationStyle
      );

  const weeklyTrendOption = useMemo(
    () =>
      createWeeklyTrendOption(orderedWeeklyData, palette, {
        totalSale: t("charts.totalSale"),
        expenditure: t("charts.expenditure"),
      }),
    [orderedWeeklyData, palette, t]
  );
  const breakdownOption = useMemo(
    () =>
      createRangeBreakdownOption(totalSaleResult ?? {}, palette, {
        invoice: t("charts.invoice"),
        misc: t("charts.misc"),
        expenditure: t("charts.expenditure"),
        rangeTotal: t("charts.rangeTotal"),
      }),
    [totalSaleResult, palette, t]
  );
  const cashExpenditureOption = useMemo(
    () =>
      createCashExpenditureOption(orderedWeeklyData, palette, {
        cashInHand: t("charts.cashInHand"),
        expenditure: t("charts.expenditure"),
      }),
    [orderedWeeklyData, palette, t]
  );

  const lowStockContent = useMemo(() => {
    if (lowStockError) {
      return (
        <p className="text-sm text-[var(--color-danger)]">
          {t("lowStock.errorLoading")}
        </p>
      );
    }
    if (lowStockLoading) {
      return <TableLoader />;
    }
    if (lowStockItems.length === 0) {
      return (
        <DashboardEmptyState
          title={t("lowStock.emptyTitle")}
          description={t("lowStock.emptyDescription")}
          actionLabel={t("lowStock.goToStock")}
          actionTo="/stock"
        />
      );
    }
    return (
      <DataTable<LowStockItem>
        scrollHeightPreset="compact"
        columns={[
          { key: "name", label: t("lowStock.table.item") },
          {
            key: "current_stock",
            label: t("lowStock.table.current"),
            align: "right" as const,
            render: (item: LowStockItem) => {
              const isZero = item.current_stock === 0;
              const colorClass = isZero
                ? "text-[var(--color-danger)]"
                : "text-[var(--color-warning-text)]";
              const dotClass = isZero
                ? "bg-[var(--color-danger)]"
                : "bg-[var(--color-warning)]";
              return (
                <span className={`inline-flex items-center justify-end ${colorClass}`}>
                  <span
                    className={`w-2 h-2 rounded-full inline-block mr-2 ${dotClass}`}
                  />
                  {formatDecimal(item.current_stock)}
                </span>
              );
            },
          },
          {
            key: "reorder_level",
            label: t("lowStock.table.reorderAt"),
            align: "right" as const,
            render: (item: LowStockItem) => formatDecimal(item.reorder_level),
          },
          { key: "unit", label: t("lowStock.table.unit") },
        ]}
        data={lowStockItems}
        pagination={{ type: "client" }}
      />
    );
  }, [lowStockError, lowStockItems, lowStockLoading, t]);

  let weeklyTrendContent: ReactNode;
  if (weeklyLoading) {
    weeklyTrendContent = <div className="dashboard-chart-skeleton" />;
  } else if (weeklyError) {
    weeklyTrendContent = (
      <DashboardEmptyState
        title={t("weeklyMomentum.errorTitle")}
        description={t("weeklyMomentum.errorDescription")}
      />
    );
  } else if (hasWeeklySales) {
    weeklyTrendContent = (
      <ReactECharts
        option={weeklyTrendOption}
        notMerge
        lazyUpdate
        style={{ height: 280 }}
      />
    );
  } else {
    weeklyTrendContent = (
      <DashboardEmptyState
        title={t("weeklyMomentum.emptyTitle")}
        description={t("weeklyMomentum.emptyDescription")}
        actionLabel={t("actions.createInvoice")}
        actionTo="/invoices"
      />
    );
  }

  let rangeCompositionContent: ReactNode;
  if (totalSaleLoading) {
    rangeCompositionContent = (
      <div className="dashboard-chart-skeleton h-[240px]" />
    );
  } else if (totalSaleResult && hasRangeData) {
    rangeCompositionContent = (
      <ReactECharts
        option={breakdownOption}
        notMerge
        lazyUpdate
        style={{ height: 228 }}
      />
    );
  } else {
    rangeCompositionContent = (
      <DashboardEmptyState
        title={t("rangeComposition.emptyTitle")}
        description={t("rangeComposition.emptyDescription")}
        actionLabel={t("actions.createInvoice")}
        actionTo="/invoices"
      />
    );
  }

  let cashExpenditureContent: ReactNode;
  if (weeklyLoading) {
    cashExpenditureContent = (
      <div className="dashboard-chart-skeleton h-[148px]" />
    );
  } else if (hasWeeklySales) {
    cashExpenditureContent = (
      <ReactECharts
        option={cashExpenditureOption}
        notMerge
        lazyUpdate
        style={{ height: 148 }}
      />
    );
  } else {
    cashExpenditureContent = (
      <DashboardEmptyState
        title={t("quickActions.cashTrendEmptyTitle")}
        description={t("quickActions.cashTrendEmptyDescription")}
      />
    );
  }

  let weeklyDetailsContent: ReactNode;
  if (weeklyLoading) {
    weeklyDetailsContent = <TableLoader />;
  } else if (weeklyError) {
    weeklyDetailsContent = (
      <DashboardEmptyState
        title={t("weeklyDetails.errorTitle")}
        description={t("weeklyDetails.errorDescription")}
      />
    );
  } else if (hasWeeklySales) {
    weeklyDetailsContent = (
      <DataTable<WeeklyRow>
        columns={[
          {
            key: "sale_date",
            label: t("weeklyDetails.table.date"),
            render: (sale) => (
              <Tooltip content={formatDateForForm(sale.sale_date)}>
                <span>{formatDateForView(sale.sale_date)}</span>
              </Tooltip>
            ),
          },
          {
            key: "sale_amount",
            label: t("weeklyDetails.table.sale"),
            align: "right" as const,
            render: (sale) => (
              <span className="tabular-nums">{formatRupee(sale.sale_amount)}</span>
            ),
          },
          {
            key: "invoice_sales",
            label: t("weeklyDetails.table.invoice"),
            align: "right" as const,
            render: (sale) => (
              <span className="tabular-nums">
                {formatRupee(sale.invoice_sales ?? 0)}
              </span>
            ),
          },
          {
            key: "misc_sales",
            label: t("weeklyDetails.table.misc"),
            align: "right" as const,
            render: (sale) => (
              <span className="tabular-nums">
                {formatRupee(sale.misc_sales ?? 0)}
              </span>
            ),
          },
          {
            key: "cash_in_hand",
            label: t("weeklyDetails.table.cashInHand"),
            align: "right" as const,
            render: (sale) => (
              <span className="tabular-nums">
                {formatRupee(sale.cash_in_hand)}
              </span>
            ),
          },
          {
            key: "expenditure_amount",
            label: t("weeklyDetails.table.expenditure"),
            align: "right" as const,
            render: (sale) => (
              <span className="tabular-nums">
                {formatRupee(sale.expenditure_amount ?? 0)}
              </span>
            ),
          },
        ]}
        data={weeklySales}
        pagination={{ type: "client" }}
      />
    );
  } else {
    weeklyDetailsContent = (
      <DashboardEmptyState
        title={t("weeklyDetails.emptyTitle")}
        description={t("weeklyDetails.emptyDescription")}
        actionLabel={t("actions.createInvoice")}
        actionTo="/invoices"
      />
    );
  }

  let lenderSummaryContent: ReactNode;
  if (mahajanSummaryLoading) {
    lenderSummaryContent = (
      <div className="space-y-3">
        <div className="dashboard-chart-skeleton h-[74px]" />
        <div className="dashboard-chart-skeleton h-[74px]" />
        <div className="dashboard-chart-skeleton h-[86px]" />
      </div>
    );
  } else if (mahajanSummary) {
    lenderSummaryContent = (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="dashboard-mini-stat">
          <p className="text-[var(--color-text-tertiary)]">
            {t("lender.totalCreditPurchase")}
          </p>
          <p className="font-medium text-[var(--color-text-primary)]">
            {formatRupee(
              mahajanSummary.totalCreditPurchase ?? mahajanSummary.totalLend
            )}
          </p>
        </div>
        <div className="dashboard-mini-stat">
          <p className="text-[var(--color-text-tertiary)]">
            {t("lender.totalSettlements")}
          </p>
          <p className="font-medium text-[var(--color-text-primary)]">
            {formatRupee(
              mahajanSummary.totalSettlement ?? mahajanSummary.totalDeposit
            )}
          </p>
        </div>
        <div className="dashboard-mini-stat sm:col-span-2">
          <p className="text-[var(--color-text-tertiary)]">{t("lender.netBalance")}</p>
          <p
            className={`font-semibold ${netBalanceClass(mahajanSummary.balance)}`}
          >
            {formatRupee(Math.abs(mahajanSummary.balance))}
            {mahajanSummary.balance > 0 ? (
              <span className="text-[var(--color-text-tertiary)] font-normal">
                {" "}
                ({t("lender.payable")})
              </span>
            ) : null}
            {mahajanSummary.balance < 0 ? (
              <span className="text-[var(--color-text-tertiary)] font-normal">
                {" "}
                ({t("lender.receivable")})
              </span>
            ) : null}
          </p>
          {mahajanSummary.countOweMe > 0 || mahajanSummary.countIOwe > 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              {t("lender.receivablePayableStats", {
                receivable: mahajanSummary.countOweMe,
                payable: mahajanSummary.countIOwe,
              })}
            </p>
          ) : null}
        </div>
      </div>
    );
  } else {
    lenderSummaryContent = (
      <DashboardEmptyState
        title={t("lender.emptyTitle")}
        description={t("lender.emptyDescription")}
        actionLabel={t("lender.viewLenders")}
        actionTo="/mahajans"
      />
    );
  }

  return (
    <div className="space-y-4 home-dashboard pb-3">
      <DashboardHero
        todaySaleLabel={todaySaleLabel}
        weekSaleLabel={weekSaleLabel}
        monthSaleLabel={monthSaleLabel}
        lenderNetLabel={lenderNetLabel}
        lenderNetClassName={netBalanceClass(mahajanSummary?.balance ?? 0)}
      />
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <DashboardSectionBoundary
          sectionTitle={t("weeklyMomentum.title")}
          containerClassName="dashboard-panel xl:col-span-2 min-h-[23rem]"
          resetKeys={[weeklyDate, orderedWeeklyData.length]}
        >
          <WeeklyMomentumSection
            weeklyDate={weeklyDate}
            content={weeklyTrendContent}
            totalWeekSales={totalWeekSales}
            totalWeekExpenditure={totalWeekExpenditure}
            peakWeekSale={peakWeekSale}
            entriesCount={orderedWeeklyData.length}
          />
        </DashboardSectionBoundary>
        <DashboardSectionBoundary
          sectionTitle={t("sections.rangeComposition")}
          containerClassName="dashboard-panel min-h-[23rem]"
          resetKeys={[totalFrom, totalTo, totalSaleResult?.total ?? 0]}
        >
          <RangeCompositionSection
            totalFrom={totalFrom}
            totalTo={totalTo}
            onFromChange={setTotalFrom}
            onToChange={setTotalTo}
            onPresetClick={handlePresetClick}
            isPresetActive={isPresetLabelActive}
            content={rangeCompositionContent}
          />
        </DashboardSectionBoundary>
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <DashboardSectionBoundary
          sectionTitle={t("sections.quickActions")}
          containerClassName="dashboard-panel xl:col-span-4"
          resetKeys={[weeklyDate, orderedWeeklyData.length]}
        >
          <QuickActionsSection
            cashExpenditureContent={cashExpenditureContent}
          />
        </DashboardSectionBoundary>
        <DashboardSectionBoundary
          sectionTitle={t("sections.lowStockAlerts")}
          containerClassName="dashboard-panel xl:col-span-8"
          resetKeys={[lowStockItems.length, lowStockLoading, lowStockError]}
        >
          <LowStockAlertsSection
            count={lowStockItems.length}
            content={lowStockContent}
          />
        </DashboardSectionBoundary>
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <DashboardSectionBoundary
          sectionTitle={t("sections.weeklyDetails")}
          containerClassName="dashboard-panel xl:col-span-2"
          resetKeys={[weeklyDate, orderedWeeklyData.length, weeklyLoading]}
        >
          <WeeklyDetailsSection
            weeklyDate={weeklyDate}
            onWeeklyDateChange={setWeeklyDate}
            onSetToday={() => setWeeklyDate(todayISO())}
            content={weeklyDetailsContent}
          />
        </DashboardSectionBoundary>
        <DashboardSectionBoundary
          sectionTitle={t("sections.lenderSummary")}
          containerClassName="dashboard-panel"
          resetKeys={[mahajanSummaryLoading, mahajanSummary?.balance ?? 0]}
        >
          <LenderSummarySection content={lenderSummaryContent} />
        </DashboardSectionBoundary>
      </section>
    </div>
  );
}
