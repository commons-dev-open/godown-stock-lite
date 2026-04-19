export interface UnitType {
  id: number;
  name: string;
  created_at: string;
}

export interface Unit {
  id: number;
  name: string;
  symbol: string | null;
  unit_type_id: number | null;
  unit_type_name: string | null;
  created_at: string;
}

export interface UnitConversion {
  id: number;
  from_unit: string;
  to_unit: string;
  factor: number;
  created_at: string;
}

export type InvoiceUnit = Unit;

export interface ItemOtherUnit {
  id?: number;
  unit: string;
  sort_order: number;
}

export interface Item {
  id: number;
  name: string;
  code: string | null;
  unit: string;
  reference_unit: string | null;
  quantity_per_primary: number | null;
  retail_primary_unit: string | null;
  selling_price: number | null;
  selling_price_unit: string | null;
  gst_rate: number;
  hsn_code: string | null;
  current_stock: number;
  reorder_level: number | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  phone: string;
  name: string | null;
  address: string | null;
  gstin: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lender {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  gstin: string | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use Lender */
export type Mahajan = Lender;

export interface CreditPurchase {
  id: number;
  lender_id: number;
  product_id: number | null;
  product_name: string | null;
  quantity: number;
  transaction_date: string;
  amount: number;
  notes: string | null;
  lender_invoice_number?: string | null;
  invoice_file_path?: string | null;
  gst_rate?: number;
  gst_inclusive?: boolean;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use CreditPurchase */
export type MahajanLend = CreditPurchase;

export interface Settlement {
  id: number;
  lender_id: number;
  transaction_date: string;
  amount: number;
  notes: string | null;
  payment_method?: string | null;
  reference_number?: string | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use Settlement */
export type MahajanDeposit = Settlement;


export interface DailySale {
  id: number;
  sale_date: string;
  sale_amount: number;
  invoice_sales: number;
  misc_sales: number;
  cash_in_hand: number;
  expenditure_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: number;
  product_id: number;
  transaction_date: string;
  quantity: number;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierPurchasePageRow {
  id: number;
  kind: "credit" | "cash";
  lender_id: number | null;
  lender_name: string | null;
  document_date: string;
  total_amount: number;
  /** Sum of settlement amounts linked to this purchase (credit only; cash is always 0). */
  allocated_total: number;
  notes: string | null;
  lender_invoice_number: string | null;
  invoice_file_path: string | null;
  /** Cash purchase: optional vendor / shop name. */
  vendor_name: string | null;
  /** Cash purchase: how the bill was paid (cash, UPI, bank, etc.). */
  payment_method: string | null;
  /** Cash purchase: freight and other non-line charges included in total_amount. */
  other_charges: number;
  line_count: number;
  product_summary: string | null;
}

export interface SupplierPurchaseLineDetail {
  id: number;
  product_id: number;
  quantity: number;
  unit: string;
  amount: number;
  gst_rate: number;
  gst_inclusive: boolean;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
}

export interface SupplierPurchaseAllocationSummary {
  movement_id: number;
  direction: string;
  movement_amount: number;
  movement_date: string;
  payment_method: string | null;
  reference_number: string | null;
  allocated_amount: number;
}

export interface SupplierPurchaseDetail {
  header: {
    id: number;
    kind: "credit" | "cash";
    lender_id: number | null;
    document_date: string;
    notes: string | null;
    lender_invoice_number: string | null;
    invoice_file_path: string | null;
    vendor_name: string | null;
    payment_method: string | null;
    other_charges: number;
    total_amount: number;
  };
  lines: SupplierPurchaseLineDetail[];
  allocations: SupplierPurchaseAllocationSummary[];
}

export interface LedgerRow {
  transaction_date: string;
  type: "credit_purchase" | "settlement" | "cash_purchase" | "lender_refund";
  description: string;
  amount: number;
  id: number;
}

export interface Invoice {
  id: number;
  invoice_number: string | null;
  customer_name: string | null;
  customer_address: string | null;
  customer_phone?: string | null;
  customer_id?: number | null;
  invoice_date: string;
  notes: string | null;
  order_discount_amount?: number;
  round_to_whole?: number;
  coupon_code?: string | null;
  created_at: string;
  updated_at: string;
}

export type PriceEnteredAs = "per_unit" | "total";

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  product_id: number | null;
  product_name: string | null;
  quantity: number;
  unit: string;
  /** Unit the price is expressed per (e.g. "kg"). */
  price_unit?: string | null;
  /** Unit price (for display). When user entered total, this is amount/quantity. */
  price: number;
  /** Line total in currency including GST. Source of truth. */
  amount: number;
  /** Whether the user entered price per unit or total for this line. Defaults to 'per_unit' for older rows. */
  price_entered_as?: PriceEnteredAs;
  gst_rate: number;
  gst_inclusive: boolean;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  hsn_code?: string | null;
  line_discount_percent?: number;
  line_discount_flat?: number;
  bogo_buy_qty?: number | null;
  bogo_get_qty?: number | null;
  bogo_discount_percent?: number;
  created_at: string;
}

export interface Coupon {
  id: number;
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  min_order_amount: number | null;
  valid_from: string | null;
  valid_to: string | null;
  usage_limit: number | null;
  used_count: number;
  created_at: string;
  updated_at: string;
}

export interface TieredDiscountRule {
  id: number;
  min_order_amount: number;
  discount_percent: number;
  discount_flat: number;
  max_discount_amount: number | null;
  sort_order: number;
  created_at: string;
}
