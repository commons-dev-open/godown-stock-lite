import { roundDecimal } from "./numbers";

export interface DiscountSettings {
  discount_percentage_enabled?: string;
  discount_flat_enabled?: string;
  discount_bogo_enabled?: string;
  discount_coupon_enabled?: string;
  discount_tiered_enabled?: string;
}

export interface LineDiscountInput {
  /** Line gross (qty × price) before any discount */
  gross: number;
  quantity: number;
  pricePerUnit: number;
  line_discount_percent?: number;
  line_discount_flat?: number;
  bogo_buy_qty?: number | null;
  bogo_get_qty?: number | null;
  bogo_discount_percent?: number;
}

export interface LineDiscountResult {
  /** Gross before line discounts */
  gross: number;
  /** Amount discounted by line-level % and flat */
  lineDiscountAmount: number;
  /** Amount discounted by BOGO */
  bogoDiscountAmount: number;
  /** Gross after all line-level discounts (before GST) */
  discountedGross: number;
}

/**
 * Apply line-level discounts: percentage, flat, BOGO.
 * Order: percent off gross → flat off → BOGO.
 * BOGO: for every (buy_qty + get_qty) units, get_qty units get discount_percent off.
 */
export function computeLineWithDiscounts(
  input: LineDiscountInput,
  settings: DiscountSettings = {}
): LineDiscountResult {
  let remaining = input.gross;
  let lineDiscountAmount = 0;
  let bogoDiscountAmount = 0;

  const pctEnabled = settings.discount_percentage_enabled === "true";
  const flatEnabled = settings.discount_flat_enabled === "true";
  const bogoEnabled = settings.discount_bogo_enabled === "true";

  if (pctEnabled && (input.line_discount_percent ?? 0) > 0) {
    const pct = Math.min(100, Math.max(0, input.line_discount_percent ?? 0));
    const disc = roundDecimal(remaining * (pct / 100));
    lineDiscountAmount += disc;
    remaining -= disc;
  }

  if (flatEnabled && (input.line_discount_flat ?? 0) > 0) {
    const flat = Math.min(remaining, input.line_discount_flat ?? 0);
    lineDiscountAmount += flat;
    remaining -= flat;
  }

  if (
    bogoEnabled &&
    (input.bogo_buy_qty ?? 0) > 0 &&
    (input.bogo_get_qty ?? 0) > 0 &&
    input.quantity > 0 &&
    input.pricePerUnit > 0
  ) {
    const buyQty = input.bogo_buy_qty!;
    const getQty = input.bogo_get_qty!;
    const discountPct = Math.min(100, Math.max(0, input.bogo_discount_percent ?? 100)) / 100;
    const cycle = buyQty + getQty;
    const cycles = Math.floor(input.quantity / cycle);
    const freeUnits = cycles * getQty;
    const bogoValue = freeUnits * input.pricePerUnit * discountPct;
    bogoDiscountAmount = roundDecimal(Math.min(remaining, bogoValue));
    remaining -= bogoDiscountAmount;
  }

  return {
    gross: input.gross,
    lineDiscountAmount,
    bogoDiscountAmount,
    discountedGross: roundDecimal(Math.max(0, remaining)),
  };
}

export interface OrderDiscountInput {
  subtotal: number;
  order_discount_percent?: number;
  order_discount_flat?: number;
  coupon?: {
    discount_type: "percent" | "flat";
    discount_value: number;
    code?: string;
  } | null;
  tieredRules?: Array<{
    min_order_amount: number;
    discount_percent: number;
    discount_flat?: number;
    max_discount_amount?: number | null;
  }>;
}

export interface OrderDiscountBreakdown {
  orderPercentAmount: number;
  orderFlatAmount: number;
  couponAmount: number;
  tieredAmount: number;
  total: number;
}

/**
 * Compute order-level discounts.
 * Order: percentage first, then flat, then coupon, then tiered.
 * Tiered: highest qualifying tier (by min_order_amount) wins.
 */
export function computeOrderDiscounts(
  input: OrderDiscountInput,
  settings: DiscountSettings = {}
): OrderDiscountBreakdown {
  const result: OrderDiscountBreakdown = {
    orderPercentAmount: 0,
    orderFlatAmount: 0,
    couponAmount: 0,
    tieredAmount: 0,
    total: 0,
  };

  let remaining = input.subtotal;

  const pctEnabled = settings.discount_percentage_enabled === "true";
  const flatEnabled = settings.discount_flat_enabled === "true";
  const couponEnabled = settings.discount_coupon_enabled === "true";
  const tieredEnabled = settings.discount_tiered_enabled === "true";

  if (pctEnabled && (input.order_discount_percent ?? 0) > 0) {
    const pct = Math.min(100, Math.max(0, input.order_discount_percent ?? 0));
    result.orderPercentAmount = roundDecimal(remaining * (pct / 100));
    remaining -= result.orderPercentAmount;
  }

  if (flatEnabled && (input.order_discount_flat ?? 0) > 0) {
    result.orderFlatAmount = Math.min(remaining, input.order_discount_flat ?? 0);
    remaining -= result.orderFlatAmount;
  }

  if (couponEnabled && input.coupon) {
    const { discount_type, discount_value } = input.coupon;
    if (discount_type === "percent") {
      const pct = Math.min(100, Math.max(0, discount_value));
      result.couponAmount = roundDecimal(remaining * (pct / 100));
    } else {
      result.couponAmount = Math.min(remaining, discount_value);
    }
    remaining -= result.couponAmount;
  }

  if (tieredEnabled && input.tieredRules?.length) {
    const sorted = [...input.tieredRules].sort(
      (a, b) => b.min_order_amount - a.min_order_amount
    );
    const qualifying = sorted.find((r) => remaining >= r.min_order_amount);
    if (qualifying) {
      const pct = qualifying.discount_percent ?? 0;
      const flat = qualifying.discount_flat ?? 0;
      let amount: number;
      if (pct > 0) {
        amount = roundDecimal(remaining * (pct / 100));
      } else if (flat > 0) {
        amount = flat;
      } else {
        amount = 0;
      }
      if (
        qualifying.max_discount_amount != null &&
        qualifying.max_discount_amount > 0 &&
        amount > 0
      ) {
        amount = Math.min(amount, qualifying.max_discount_amount);
      }
      result.tieredAmount = roundDecimal(Math.min(remaining, amount));
      remaining -= result.tieredAmount;
    }
  }

  result.total =
    result.orderPercentAmount +
    result.orderFlatAmount +
    result.couponAmount +
    result.tieredAmount;

  return result;
}

/**
 * Round amount to nearest whole number if enabled.
 */
export function roundToWholeIfEnabled(
  amount: number,
  roundToWhole: boolean | number
): number {
  if (roundToWhole === true || roundToWhole === 1) {
    return Math.round(amount);
  }
  return roundDecimal(amount);
}
