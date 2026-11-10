/**
 * Paper-reel stock. A reel's balance is what came in plus every movement against it (issue, return, waste, adjust).
 * The paper an order needs comes from the box spec on its items: kg per layer grade, and the narrowest reel that can be cut.
 */
import { deckleAllowance, layerGrams } from './calc';
import type { OrderItem, Reel, StockMove } from './types';

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const gradeKey = (gsm: number, bf: number) => `${gsm}-${bf}`;
export const gradeLabel = (gsm: number, bf: number) => `${bf} BF · ${gsm} GSM`;

/** Kg left on a reel. */
export function reelBalance(reel: Reel, moves: StockMove[]): number {
  let kg = reel.weightIn || 0;
  for (const m of moves) if (m.reelId === reel.id) kg += m.kg;
  return r3(kg);
}

export interface PaperNeed {
  key: string;
  gsm: number;
  bf: number;
  /** Calculated kg for the whole order. */
  kg: number;
  /** Narrowest reel (mm) the biggest-deckle item can be cut from. */
  minWidth: number;
  /** Items that use this grade. */
  items: string[];
}

/** Paper an order needs, grouped by grade (GSM + BF). Items without a box spec are skipped. */
export function paperNeed(items: OrderItem[]): PaperNeed[] {
  const map = new Map<string, PaperNeed>();
  for (const it of items) {
    if (!it.spec || !(it.qty > 0)) continue;
    const deckle = it.spec.width + it.spec.height + deckleAllowance(it.spec.ply);
    for (const l of layerGrams(it.spec)) {
      if (!(l.gsm > 0)) continue;
      const key = gradeKey(l.gsm, l.bf);
      const cur = map.get(key) ?? { key, gsm: l.gsm, bf: l.bf, kg: 0, minWidth: 0, items: [] };
      cur.kg += (l.grams * it.qty) / 1000;
      cur.minWidth = Math.max(cur.minWidth, deckle);
      const name = it.description || 'Item';
      if (!cur.items.includes(name)) cur.items.push(name);
      map.set(key, cur);
    }
  }
  return [...map.values()].map((n) => ({ ...n, kg: r3(n.kg) })).sort((a, b) => b.kg - a.kg);
}

/** Kg already issued to an order for each grade (returns and waste count too). */
export function issuedByGrade(orderId: string, reels: Reel[], moves: StockMove[]): Map<string, number> {
  const byReel = new Map(reels.map((r) => [r.id, r]));
  const out = new Map<string, number>();
  for (const m of moves) {
    if (m.orderId !== orderId) continue;
    const r = byReel.get(m.reelId);
    if (!r) continue;
    const key = gradeKey(r.gsm, r.bf);
    out.set(key, r3((out.get(key) ?? 0) - m.kg));
  }
  return out;
}

export interface ReelChoice {
  reel: Reel;
  balance: number;
  /** Side trim in mm when cut for the order's widest deckle. */
  trim: number;
  /** Higher BF than asked for (stronger, fine to use). */
  higherBf: boolean;
}

/**
 * Reels that can serve a need: same GSM, same or higher BF, wide enough, something left.
 * Best first: the exact BF, then the least side trim, then the part-used reel (so butt-rolls get used up).
 */
export function matchingReels(need: Pick<PaperNeed, 'gsm' | 'bf' | 'minWidth'>, reels: Reel[], moves: StockMove[]): ReelChoice[] {
  return reels
    .filter((r) => r.gsm === need.gsm && r.bf >= need.bf && r.width >= need.minWidth)
    .map((reel) => ({ reel, balance: reelBalance(reel, moves), trim: reel.width - need.minWidth, higherBf: reel.bf > need.bf }))
    .filter((c) => c.balance > 0.001)
    .sort((a, b) => Number(a.higherBf) - Number(b.higherBf) || a.trim - b.trim || a.balance - b.balance);
}

/** Paper the order really uses is the deckle's share of the reel; the rest of the width is side trim. */
const usable = (reelWidth: number, minWidth: number) => (reelWidth > 0 ? Math.min(1, minWidth / reelWidth) : 1);

/** Kg to take off a reel of this width to get `netKg` of usable paper at the given deckle. */
export const reelDraw = (netKg: number, reelWidth: number, minWidth: number) => r3(netKg / usable(reelWidth, minWidth));

/** Usable paper (kg) already issued to an order for a grade: issues less returns, after side trim. Waste and corrections do not count. */
export function issuedNet(orderId: string, need: Pick<PaperNeed, 'gsm' | 'bf' | 'minWidth'>, reels: Reel[], moves: StockMove[]): number {
  const byReel = new Map(reels.map((r) => [r.id, r]));
  let kg = 0;
  for (const m of moves) {
    if (m.orderId !== orderId || (m.kind !== 'issue' && m.kind !== 'return')) continue;
    const r = byReel.get(m.reelId);
    if (r && r.gsm === need.gsm && r.bf === need.bf) kg -= m.kg * usable(r.width, need.minWidth);
  }
  return r3(kg);
}

/** Usable paper (kg) the matching reels in stock could give for a need. */
export const availableNet = (need: PaperNeed, reels: Reel[], moves: StockMove[]) =>
  r3(matchingReels(need, reels, moves).reduce((s, c) => s + c.balance * usable(c.reel.width, need.minWidth), 0));

export interface GradeStock {
  key: string;
  gsm: number;
  bf: number;
  kg: number;
  value: number;
  reels: { reel: Reel; balance: number }[];
}

/** Stock grouped by grade; empty reels are left out unless `includeEmpty`. */
export function stockByGrade(reels: Reel[], moves: StockMove[], includeEmpty = false): GradeStock[] {
  const map = new Map<string, GradeStock>();
  for (const reel of reels) {
    const balance = reelBalance(reel, moves);
    if (!includeEmpty && balance <= 0.001) continue;
    const key = gradeKey(reel.gsm, reel.bf);
    const g = map.get(key) ?? { key, gsm: reel.gsm, bf: reel.bf, kg: 0, value: 0, reels: [] };
    g.kg = r3(g.kg + balance);
    g.value += balance * (reel.rate || 0);
    g.reels.push({ reel, balance });
    map.set(key, g);
  }
  for (const g of map.values()) g.reels.sort((a, b) => a.reel.width - b.reel.width || a.balance - b.balance);
  return [...map.values()].sort((a, b) => a.gsm - b.gsm || a.bf - b.bf);
}
