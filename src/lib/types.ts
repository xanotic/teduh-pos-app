export type PaymentMethod = "Cash" | "QR Pay" | "Giveaway";

export interface MenuItem {
  id: string;
  business_id: string;
  name: string;
  category: string;
  price: number;
  cost: number | null;
  stock: number | null;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  name: string;
  category: string;
  price: number;
  cost: number | null;
  qty: number;
}

export interface Transaction {
  id: string;
  business_id: string;
  ts: string;
  payment_method: PaymentMethod;
  note: string | null;
  total: number;
  transaction_items: TransactionItem[];
}

export type PaymentType = "consignment" | "upfront";

export interface Vendor {
  id: string;
  business_id: string;
  name: string;
  qr_url: string | null;
  created_at: string;
}

export interface ShelfLifeEntry {
  id: string;
  business_id: string;
  item: string;
  expires_at: string;
  notes: string | null;
  payment_type: PaymentType;
  qty: number;
  initial_qty?: number | null;
  cost: number | null;
  stock_deducted?: boolean;
  vendor_id?: string | null;
  created_at: string;
}

export interface DailyBalance {
  id: string;
  business_id: string;
  date: string;
  opening_balance: number;
  actual_closing: number | null;
  updated_at: string;
}

export interface ConsignmentSettlementItem {
  id: string;
  settlement_id: string;
  name: string;
  delivered_qty: number;
  remaining_qty: number;
  cost: number | null;
}

export interface ConsignmentSettlement {
  id: string;
  business_id: string;
  settled_at: string;
  period_label?: string | null;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
  consignment_settlement_items: ConsignmentSettlementItem[];
}

export interface MiscExpense {
  id: string;
  business_id: string;
  description: string;
  amount: number;
  spent_at: string;
  created_at: string;
}

export interface CartLine {
  itemId: string;
  name: string;
  category: string;
  price: number;
  cost: number | null;
  qty: number;
}

export type HappyHourDiscountType = "flat" | "percent";

export interface HappyHourSettings {
  id: string;
  business_id: string;
  is_enabled: boolean;
  discount_type?: HappyHourDiscountType;
  price?: number;
  discount_percent?: number;
  start_time: string;
  end_time: string;
  target_date?: string | null;
  days?: string[];
  force_active: boolean;
  updated_at: string;
}

