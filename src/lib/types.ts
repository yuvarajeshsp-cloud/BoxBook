export type Ply = 3 | 5 | 7 | 9;

export interface PaperLayer {
  gsm: number;
  bf: number;
  price: number; // per kg
}

export interface BoxSpec {
  length: number; // mm
  width: number; // mm
  height: number; // mm
  ply: Ply;
  perLayer: boolean; // false = same paper for every layer (layer 1 used)
  layers: PaperLayer[]; // always 9 entries, index 0 = top liner
}

export interface BoxResult {
  cutSize: number; // mm
  deckleSize: number; // mm
  sheets: number;
  weight: number; // grams
  bs: number; // bursting strength (kg/cm²)
  paperCost: number; // per box
}

export interface Pricing {
  overhead: number; // per box
  profitPct: number;
  taxPct: number;
}

export interface SavedBox {
  id: string;
  name: string;
  customerId?: string;
  spec: BoxSpec;
  pricing: Pricing;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'quote' | 'confirmed' | 'production' | 'ready' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  description: string;
  qty: number;
  rate: number;
  spec?: BoxSpec;
  boxId?: string;
}

export interface Payment {
  id: string;
  date: string; // yyyy-mm-dd
  amount: number;
  mode: string;
  note: string;
}

export interface Order {
  id: string;
  number: string;
  customerId: string;
  date: string; // yyyy-mm-dd
  dueDate: string; // yyyy-mm-dd or ''
  status: OrderStatus;
  items: OrderItem[];
  discount: number; // amount
  taxPct: number;
  payments: Payment[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  businessGstin: string;
  currency: string;
  defaults: Pricing;
  theme: 'system' | 'light' | 'dark';
  nextOrderNo: number;
  autoBackup: boolean;
  keepBackups: number;
  lastAutoBackup: string; // yyyy-mm-dd
  lastBackupAt: string; // ISO, any backup (manual or auto)
}

export interface AppData {
  app: 'boxbook';
  schema: 1;
  savedAt: string;
  customers: Customer[];
  orders: Order[];
  boxes: SavedBox[];
  settings: Settings;
}
