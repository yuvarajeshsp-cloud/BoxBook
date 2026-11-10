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
  /** GST state code (e.g. '33'); when empty it is taken from the GSTIN. */
  stateCode?: string;
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
  /** HSN/SAC code for the tax invoice; falls back to the company default. */
  hsn?: string;
  /** Unit shown after the rate on the invoice, e.g. 'Nos.'. */
  unit?: string;
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

/** Extra fields printed in the header grid of the tax invoice. All optional. */
export interface InvoiceMeta {
  deliveryNote?: string;
  termsOfPayment?: string;
  dispatchDocNo?: string;
  deliveryNoteDate?: string;
  dispatchedThrough?: string;
  destination?: string;
  termsOfDelivery?: string;
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
  /** Assigned the first time an invoice PDF is made, then kept. */
  invoiceNo?: string;
  invoice?: InvoiceMeta;
  createdAt: string;
  updatedAt: string;
}

/** One paper reel in the godown. Its balance is `weightIn` plus every StockMove against it. */
export interface Reel {
  id: string;
  /** Reel number from the mill's label (or your own running number). */
  number: string;
  bf: number;
  gsm: number;
  /** Reel width in mm; it must be at least the deckle of the box you cut from it. */
  width: number;
  supplier: string;
  receivedAt: string; // yyyy-mm-dd
  /** Weight when received, kg. */
  weightIn: number;
  /** Purchase rate per kg. */
  rate: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** issue = paper used for an order, return = unused paper back to the reel, waste = trim / spoilage, adjust = count correction. */
export type StockMoveKind = 'issue' | 'return' | 'waste' | 'adjust';

export interface StockMove {
  id: string;
  reelId: string;
  /** ISO date-time. */
  date: string;
  kind: StockMoveKind;
  /** Signed: negative takes paper off the reel, positive puts it back. */
  kg: number;
  orderId?: string;
  /** Kept so the ledger still reads right if the order is deleted later. */
  orderNo?: string;
  note: string;
}

export interface Settings {
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  businessGstin: string;
  businessEmail: string;
  /** One line under the name on the invoice, e.g. 'An ISO 9001 : 2015 Certified Company'. */
  businessTagline: string;
  /** GST state code of the company, e.g. '33' for Tamil Nadu. */
  businessState: string;
  /** Company logo as a data URL (kept inside backups). */
  businessLogo: string;
  bankHolder: string;
  bankName: string;
  bankAccount: string;
  bankBranch: string;
  bankIfsc: string;
  invoiceDeclaration: string;
  invoicePrefix: string;
  nextInvoiceNo: number;
  defaultHsn: string;
  defaultUnit: string;
  currency: string;
  defaults: Pricing;
  theme: 'system' | 'light' | 'dark';
  nextOrderNo: number;
  autoBackup: boolean;
  keepBackups: number;
  lastAutoBackup: string; // yyyy-mm-dd
  lastBackupAt: string; // ISO, any backup (manual or auto)
  /** Also upload the daily backup to Google Drive. */
  driveAuto: boolean;
  lastDriveBackupAt: string; // ISO
  lastDriveAutoBackup: string; // yyyy-mm-dd
  /** Extra paper to plan for beyond the calculated need (start-up, spoilage), percent. */
  stockWastePct: number;
  /** Issue paper from the reels automatically when an order is confirmed and enough is in stock. */
  autoIssue: boolean;
  /** Reorder levels: minimum kg to keep per grade, keyed `${gsm}-${bf}`. */
  stockMin: Record<string, number>;
  /** Reel widths (mm) you usually buy; offered when adding a reel and used to group the stock by size. */
  reelWidths: number[];
  /** Payment methods offered when recording a payment. */
  payModes: string[];
}

export interface AppData {
  app: 'boxbook';
  schema: 1;
  savedAt: string;
  customers: Customer[];
  orders: Order[];
  boxes: SavedBox[];
  reels: Reel[];
  stockMoves: StockMove[];
  settings: Settings;
}
