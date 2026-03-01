export interface Unit {
  id: number;
  name: string;
  created_at: string;
}

export interface Item {
  id: number;
  name: string;
  code: string | null;
  unit: string;
  current_stock: number;
  reorder_level: number | null;
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
