export interface WeeklyRow {
  id: number;
  sale_date: string;
  sale_amount: number;
  cash_in_hand: number;
  expenditure_amount: number | null;
  invoice_sales?: number;
  misc_sales?: number;
}

export interface ThemePalette {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentSubtle: string;
  success: string;
  warning: string;
}

export type DatePresetKey =
  | "today"
  | "yesterday"
  | "last7Days"
  | "last14Days"
  | "thisMonth"
  | "lastMonth"
  | "last30Days"
  | "last90Days"
  | "thisQuarter"
  | "thisYear";

export interface DatePreset {
  key: DatePresetKey;
  label: string;
  getFrom: () => string;
  getTo: () => string;
}

export interface LowStockItem {
  id: number;
  name: string;
  current_stock: number;
  reorder_level: number;
  unit: string;
}
