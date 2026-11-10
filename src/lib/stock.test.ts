// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { calcBox, layerGrams } from './calc';
import { availableNet, issuedByGrade, issuedNet, matchingReels, paperNeed, reelBalance, reelDraw, stockByGrade } from './stock';
import { emptyData, normalize } from './storage';
import type { BoxSpec, OrderItem, Reel, StockMove } from './types';

const spec = (over: Partial<BoxSpec> = {}): BoxSpec => ({
  length: 300,
  width: 200,
  height: 150,
  ply: 3,
  perLayer: true,
  layers: [
    { gsm: 150, bf: 18, price: 42 },
    { gsm: 120, bf: 16, price: 36 },
    { gsm: 150, bf: 18, price: 42 },
    ...Array.from({ length: 6 }, () => ({ gsm: 0, bf: 0, price: 0 })),
  ],
  ...over,
});
const item = (qty: number, s = spec(), description = 'Box'): OrderItem => ({ id: 'i' + qty, description, qty, rate: 10, spec: s });
const reel = (id: string, gsm: number, bf: number, width: number, kg: number): Reel => ({ id, number: id, gsm, bf, width, supplier: '', receivedAt: '2026-11-01', weightIn: kg, rate: 40, note: '', createdAt: '', updatedAt: '' });
const move = (reelId: string, kg: number, orderId?: string): StockMove => ({ id: reelId + kg, reelId, date: '', kind: kg < 0 ? 'issue' : 'return', kg, orderId, note: '' });

describe('paper per layer', () => {
  it('adds up to the box weight', () => {
    const s = spec();
    expect(layerGrams(s).reduce((t, l) => t + l.grams, 0)).toBeCloseTo(calcBox(s).weight, 1);
  });
  it('gives the hand-worked figures for 300×200×150, 3-ply (area 1050 × 370 mm)', () => {
    const [top, flute, bottom] = layerGrams(spec());
    expect(top.grams).toBeCloseTo(58.275, 3);
    expect(flute.grams).toBeCloseTo(65.268, 3); // 120 GSM × 1.4 take-up
    expect(bottom.grams).toBeCloseTo(58.275, 3);
  });
});

describe('paper an order needs', () => {
  it('groups layers of the same grade and scales by quantity', () => {
    const need = paperNeed([item(1000)]);
    expect(need).toHaveLength(2);
    expect(need[0]).toMatchObject({ gsm: 150, bf: 18, kg: 116.55, minWidth: 370 }); // two liners
    expect(need[1]).toMatchObject({ gsm: 120, bf: 16, kg: 65.268 });
  });
  it('adds several items and keeps the widest deckle', () => {
    const wide = spec({ width: 300 }); // deckle 470
    const need = paperNeed([item(1000, spec(), 'A'), item(500, wide, 'B')]);
    const liner = need.find((n) => n.gsm === 150)!;
    expect(liner.minWidth).toBe(470);
    expect(liner.items).toEqual(['A', 'B']);
    expect(liner.kg).toBeGreaterThan(116.55);
  });
  it('skips items without a box spec or quantity', () => {
    expect(paperNeed([{ id: 'x', description: 'Tape', qty: 5, rate: 1 }, item(0)])).toEqual([]);
  });
});

describe('reel balance and matching', () => {
  const reels = [reel('a', 150, 18, 400, 200), reel('b', 150, 18, 380, 50), reel('c', 150, 18, 350, 300), reel('d', 150, 20, 372, 100), reel('e', 120, 16, 400, 80), reel('f', 150, 18, 390, 0)];
  const need = { gsm: 150, bf: 18, minWidth: 370 };

  it('balance = received + movements', () => {
    expect(reelBalance(reels[0], [move('a', -60.5, 'o1'), move('a', 10), move('b', -5)])).toBe(149.5);
  });
  it('offers only wide-enough, same-GSM reels with paper left, least trim first, higher BF last', () => {
    const got = matchingReels(need, reels, []).map((c) => c.reel.id);
    expect(got).toEqual(['b', 'a', 'd']); // c too narrow, e other GSM, f empty; d has higher BF
  });
  it('an emptied reel drops out', () => {
    expect(matchingReels(need, reels, [move('b', -50, 'o1')]).map((c) => c.reel.id)).toEqual(['a', 'd']);
  });
  it('counts issued paper per grade for one order, net of returns', () => {
    const moves = [move('a', -100, 'o1'), move('a', 20, 'o1'), move('e', -30, 'o1'), move('a', -999, 'o2')];
    const m = issuedByGrade('o1', reels, moves);
    expect(m.get('150-18')).toBe(80);
    expect(m.get('120-16')).toBe(30);
  });
  it('totals stock by grade', () => {
    const g = stockByGrade(reels, []);
    const g150 = g.find((x) => x.key === '150-18')!;
    expect(g150.kg).toBe(550);
    expect(g150.value).toBe(550 * 40);
    expect(g150.reels.map((r) => r.reel.width)).toEqual([350, 380, 400]);
    expect(g.some((x) => x.reels.some((r) => r.reel.id === 'f'))).toBe(false);
  });
});

describe('side trim', () => {
  const reels = [reel('a', 150, 18, 400, 200), reel('b', 150, 18, 370, 100)];
  const need = { gsm: 150, bf: 18, minWidth: 370 };
  it('takes more off a wider reel for the same usable paper', () => {
    expect(reelDraw(92.5, 400, 370)).toBe(100);
    expect(reelDraw(50, 370, 370)).toBe(50);
    expect(reelDraw(50, 300, 370)).toBe(50); // never less than asked
  });
  it('counts only the usable share of what was issued, and ignores waste', () => {
    const moves: StockMove[] = [move('a', -100, 'o1'), move('b', -20, 'o1'), { ...move('a', -5, 'o1'), kind: 'waste' }, move('a', -40, 'o2')];
    expect(issuedNet('o1', need, reels, moves)).toBe(112.5); // 100×370/400 + 20
  });
  it('adds up the usable paper left in matching reels', () => {
    expect(availableNet({ ...need, key: '', kg: 0, items: [] }, reels, [])).toBe(285); // 200×0.925 + 100
  });
});

describe('older backups', () => {
  it('load with no reels', () => {
    const d = emptyData() as unknown as Record<string, unknown>;
    delete d.reels;
    delete d.stockMoves;
    const n = normalize(d);
    expect(n.reels).toEqual([]);
    expect(n.stockMoves).toEqual([]);
    expect(n.settings.stockWastePct).toBe(5);
  });
  it('keep reels and movements', () => {
    const d = emptyData();
    d.reels = [reel('a', 150, 18, 400, 200)];
    d.stockMoves = [move('a', -10, 'o1')];
    const n = normalize(JSON.parse(JSON.stringify(d)));
    expect(n.reels).toHaveLength(1);
    expect(n.stockMoves[0].kg).toBe(-10);
  });
});
