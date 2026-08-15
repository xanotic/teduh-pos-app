export type PaymentMethod = "Cash" | "QR Pay" | "Giveaway";

export interface MenuItem {
  id: string;
  business_id: string;
  name: string;
  category: string;
  price: number;
  cost: number | null;
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

export interface ShelfLifeEntry {
  id: string;
  business_id: string;
  item: string;
  expires_at: string;
  notes: string | null;
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
