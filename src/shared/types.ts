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

export interface Mahajan {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  gstin: string | null;
  created_at: string;
  updated_at: string;
}

export interface MahajanLend {
  id: number;
  mahajan_id: number;
  product_id: number | null;
  product_name: string | null;
  quantity: number;
  transaction_date: string;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MahajanDeposit {
  id: number;
  mahajan_id: number;
  transaction_date: string;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface LedgerRow {
  transaction_date: string;
  type: "lend" | "deposit" | "cash_purchase";
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
  created_at: string;
}
