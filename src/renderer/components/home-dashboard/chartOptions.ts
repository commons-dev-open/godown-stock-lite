import { type EChartsOption } from "echarts";
import { formatDateForView } from "../../lib/date";
import { formatRupee } from "../../../shared/numbers";
import { type ThemePalette, type WeeklyRow } from "./types";

function getCssColor(variableName: string, fallback: string): string {
  if (globalThis.window === undefined) {
    return fallback;
  }
  const rawValue = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  return rawValue || fallback;
}

export function getThemePalette(): ThemePalette {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  return {
    isDark,
    textPrimary: getCssColor(
      "--color-text-primary",
      isDark ? "#FAFAF9" : "#1C1917"
    ),
    textSecondary: getCssColor(
      "--color-text-secondary",
      isDark ? "#A8A29E" : "#78716C"
    ),
    border: getCssColor(
      "--color-border-default",
      isDark ? "#292524" : "#E7E5E4"
    ),
    accent: getCssColor("--color-accent", "#2563EB"),
    accentSubtle: getCssColor(
      "--color-accent-muted",
      isDark ? "rgba(37, 99, 235, 0.25)" : "#DBEAFE"
    ),
    success: getCssColor("--color-success", "#16A34A"),
    warning: getCssColor("--color-warning", "#D97706"),
  };
}

export function createBaseChartOptions(theme: ThemePalette): EChartsOption {
  return {
    backgroundColor: "transparent",
    animationDuration: 450,
    textStyle: {
      color: theme.textSecondary,
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    },
    grid: {
      top: 36,
      right: 12,
      left: 10,
      bottom: 22,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "line",
      },
      borderColor: theme.border,
      backgroundColor: theme.isDark ? "#1C1917" : "#FFFFFF",
      textStyle: {
        color: theme.textPrimary,
      },
    },
    xAxis: {
      type: "category",
      axisTick: {
        show: false,
      },
      axisLine: {
        lineStyle: {
          color: theme.border,
        },
      },
      axisLabel: {
        color: theme.textSecondary,
      },
    },
    yAxis: {
      type: "value",
      splitLine: {
        lineStyle: {
          color: theme.border,
          opacity: 0.45,
        },
      },
      axisLabel: {
        color: theme.textSecondary,
      },
    },
  };
}

export function createWeeklyTrendOption(
  orderedWeeklyData: WeeklyRow[],
  palette: ThemePalette
): EChartsOption {
  const base = createBaseChartOptions(palette);
  return {
    ...base,
    legend: {
      top: 0,
      right: 0,
      textStyle: {
        color: palette.textSecondary,
      },
    },
    xAxis: {
      ...(base.xAxis as object),
      data: orderedWeeklyData.map((row) => formatDateForView(row.sale_date)),
    },
    series: [
      {
        name: "Total Sale",
        type: "line",
        smooth: true,
        symbolSize: 7,
        data: orderedWeeklyData.map((row) => row.sale_amount ?? 0),
        lineStyle: {
          width: 3,
          color: palette.accent,
        },
        itemStyle: {
          color: palette.accent,
        },
        areaStyle: {
          color: palette.accentSubtle,
          opacity: 0.45,
        },
      },
      {
        name: "Expenditure",
        type: "line",
        smooth: true,
        symbolSize: 6,
        data: orderedWeeklyData.map((row) => row.expenditure_amount ?? 0),
        lineStyle: {
          width: 2,
          color: palette.warning,
          type: "dashed",
        },
        itemStyle: {
          color: palette.warning,
        },
      },
    ],
  } satisfies EChartsOption;
}

export function createRangeBreakdownOption(
  totalSaleResult: {
    invoice_sales?: number;
    misc_sales?: number;
    expenditure?: number;
    total?: number;
  },
  palette: ThemePalette
): EChartsOption {
  const invoiceSales = totalSaleResult?.invoice_sales ?? 0;
  const miscSales = totalSaleResult?.misc_sales ?? 0;
  const expenditure = totalSaleResult?.expenditure ?? 0;
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      borderColor: palette.border,
      backgroundColor: palette.isDark ? "#1C1917" : "#FFFFFF",
      textStyle: {
        color: palette.textPrimary,
      },
    },
    legend: {
      bottom: 0,
      left: "center",
      textStyle: {
        color: palette.textSecondary,
      },
    },
    series: [
      {
        type: "pie",
        radius: ["58%", "78%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        label: {
          show: false,
        },
        itemStyle: {
          borderRadius: 8,
          borderWidth: 2,
          borderColor: palette.isDark ? "#1C1917" : "#FFFFFF",
        },
        data: [
          { value: invoiceSales, name: "Invoice", itemStyle: { color: palette.accent } },
          { value: miscSales, name: "Misc", itemStyle: { color: palette.success } },
          {
            value: expenditure,
            name: "Expenditure",
            itemStyle: { color: palette.warning },
          },
        ],
      },
    ],
    graphic: [
      {
        type: "text",
        left: "center",
        top: "35%",
        style: {
          text: "Range Total",
          fill: palette.textSecondary,
          font: "500 12px Inter, system-ui",
        },
      },
      {
        type: "text",
        left: "center",
        top: "46%",
        style: {
          text: formatRupee(totalSaleResult?.total ?? 0),
          fill: palette.textPrimary,
          font: "700 15px Inter, system-ui",
        },
      },
    ],
  } satisfies EChartsOption;
}

export function createCashExpenditureOption(
  orderedWeeklyData: WeeklyRow[],
  palette: ThemePalette
): EChartsOption {
  const base = createBaseChartOptions(palette);
  return {
    ...base,
    grid: {
      top: 28,
      right: 6,
      left: 8,
      bottom: 12,
      containLabel: true,
    },
    xAxis: {
      ...(base.xAxis as object),
      data: orderedWeeklyData.map((row) => formatDateForView(row.sale_date)),
      axisLabel: {
        show: false,
      },
    },
    yAxis: {
      ...(base.yAxis as object),
      axisLabel: {
        show: false,
      },
    },
    tooltip: {
      ...base.tooltip,
    },
    series: [
      {
        name: "Cash In Hand",
        type: "bar",
        barWidth: "40%",
        data: orderedWeeklyData.map((row) => row.cash_in_hand ?? 0),
        itemStyle: {
          color: palette.accentSubtle,
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: "Expenditure",
        type: "line",
        smooth: true,
        symbol: "none",
        lineStyle: {
          color: palette.warning,
          width: 2,
        },
        data: orderedWeeklyData.map((row) => row.expenditure_amount ?? 0),
      },
    ],
  } satisfies EChartsOption;
}
