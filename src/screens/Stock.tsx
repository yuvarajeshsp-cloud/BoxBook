import { useState } from 'react';
import { AlertTriangle, Layers, Pencil, Plus, Scissors, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../store';
import { useNav } from '../nav';
import { fmtDate, fmtDateTime, money0, num, todayISO } from '../lib/format';
import { gradeFromKey, gradeKey, gradeLabel, reelBalance, stockAlerts, stockByGrade } from '../lib/stock';
import type { Reel, StockMoveKind } from '../lib/types';
import { Confirm, Empty, Fab, Field, Header, IconBtn, List, NumInput, Page, Row, Section, Segmented, Sheet, Stat, Toggle } from '../ui';
import { Missing } from './Customers';

const kg = (n: number) => `${num(n, 1)} kg`;

const KIND: Record<StockMoveKind, string> = { issue: 'Issued', return: 'Returned', waste: 'Waste / trim', adjust: 'Correction' };

/** Paper stock by grade (BF · GSM), reel by reel. */
export function StockList() {
  const { data, updateSettings } = useStore();
  const nav = useNav();
  const [showEmpty, setShowEmpty] = useState(false);
  const groups = stockByGrade(data.reels, data.stockMoves, showEmpty);
  const totalKg = groups.reduce((s, g) => s + g.kg, 0);
  const reelCount = groups.reduce((s, g) => s + g.reels.filter((r) => r.balance > 0.001).length, 0);
  const value = groups.reduce((s, g) => s + g.value, 0);
  const add = () => nav.push({ name: 'reelEdit' });
  const alerts = stockAlerts(data.reels, data.stockMoves, data.orders, data.settings.stockMin, data.settings.stockWastePct);
  const lowKeys = new Set(alerts.low.map((l) => l.key));
  const [levelSheet, setLevelSheet] = useState<{ key?: string } | null>(null);
  const levels = Object.entries(data.settings.stockMin || {}).filter(([, v]) => v > 0);
  const haveKg = new Map(stockByGrade(data.reels, data.stockMoves).map((g) => [g.key, g.kg]));

  return (
    <>
      <Header title="Paper stock" subtitle="Reels in the godown" back />
      <Page>
        <div className="mb-5 grid grid-cols-3 gap-3">
          <Stat label="In stock" value={kg(totalKg)} tone="kraft" />
          <Stat label="Reels" value={String(reelCount)} />
          <Stat label="Value" value={money0(value, data.settings.currency)} />
        </div>

        {(alerts.low.length > 0 || alerts.short.length > 0) && (
          <div className="mb-5 space-y-1.5 rounded-2xl bg-bad/10 p-4 text-bad">
            <div className="flex items-center gap-2 text-[14px] font-bold">
              <AlertTriangle size={18} /> Time to buy paper
            </div>
            {alerts.low.map((l) => (
              <p key={'l' + l.key} className="text-[13.5px]">
                <b>{gradeLabel(l.gsm, l.bf)}</b>: {l.kg > 0 ? kg(l.kg) : 'none'} left, keep at least {kg(l.min)}
              </p>
            ))}
            {alerts.short.map((x) => (
              <p key={'s' + x.key} className="text-[13.5px]">
                <b>{gradeLabel(x.gsm, x.bf)}</b>: open orders need {kg(x.missing)} more than is in stock
              </p>
            ))}
          </div>
        )}

        {groups.length === 0 ? (
          <div className="card">
            <Empty
              icon={<Layers size={28} />}
              title="No reels yet"
              text="Add each paper reel when it arrives. Orders then show the paper they need and you issue it from the reels."
              action={
                <button className="btn-primary" onClick={add}>
                  <Plus size={18} /> Add a reel
                </button>
              }
            />
          </div>
        ) : (
          groups.map((g) => (
            <Section
              key={g.key}
              title={gradeLabel(g.gsm, g.bf)}
              action={
                <span className={`tnum text-[13px] font-semibold ${lowKeys.has(g.key) ? 'text-bad' : 'text-muted-foreground'}`}>
                  {lowKeys.has(g.key) && 'Low · '}
                  {kg(g.kg)}
                </span>
              }
            >
              <List>
                {g.reels.map(({ reel, balance }) => (
                  <Row
                    key={reel.id}
                    onClick={() => nav.push({ name: 'reel', id: reel.id })}
                    title={
                      <>
                        #{reel.number} <span className="font-normal text-muted-foreground">· {reel.width} mm</span>
                      </>
                    }
                    sub={`${reel.supplier || 'No supplier'} · ${fmtDate(reel.receivedAt)}`}
                    right={
                      <span className="text-right">
                        <span className={`tnum block text-[15px] font-bold ${balance <= 0.001 ? 'text-muted-foreground' : ''}`}>{kg(balance)}</span>
                        <span className="tnum block text-[11.5px] text-muted-foreground">of {num(reel.weightIn, 0)}</span>
                      </span>
                    }
                  />
                ))}
              </List>
            </Section>
          ))
        )}

        <Section title="Reorder levels" action={<button className="text-[14px] font-semibold text-primary" onClick={() => setLevelSheet({})}>+ Add level</button>}>
          {levels.length === 0 ? (
            <div className="card p-5 text-center text-[14px] text-muted-foreground">Set the least paper you want to keep for each grade and BoxBook warns you here and on Home when stock drops below it.</div>
          ) : (
            <List>
              {levels.map(([key, min]) => {
                const have = haveKg.get(key) ?? 0;
                const low = have < min;
                const { gsm, bf } = gradeFromKey(key);
                return (
                  <Row
                    key={key}
                    onClick={() => setLevelSheet({ key })}
                    title={gradeLabel(gsm, bf)}
                    sub={`Keep at least ${kg(min)} · have ${kg(have)}`}
                    right={low ? <span className="chip bg-bad/12 text-bad">Low</span> : undefined}
                  />
                );
              })}
            </List>
          )}
        </Section>

        <Section title="Settings">
          <div className="card space-y-4 p-4">
            <Toggle
              checked={data.settings.autoIssue}
              onChange={(v) => updateSettings({ autoIssue: v })}
              label="Issue paper automatically"
              desc="When an order is confirmed, take its paper from the reels if all of it is in stock. If not, you are told what is short and nothing is taken for that grade."
            />
            <Field label="Extra paper to plan for" hint="Added to the calculated need on every order for start-up waste and spoilage. Side trim from the reel width is worked out separately.">
              <NumInput value={data.settings.stockWastePct} onValue={(v) => updateSettings({ stockWastePct: Math.max(0, v) })} suffix="%" />
            </Field>
            <Toggle checked={showEmpty} onChange={setShowEmpty} label="Show used-up reels" desc="Reels with nothing left are hidden from the list." />
          </div>
        </Section>
      </Page>
      {groups.length > 0 && <Fab label="Add reel" icon={<Plus size={20} />} onClick={add} />}
      <LevelSheet state={levelSheet} onClose={() => setLevelSheet(null)} />
    </>
  );
}

function LevelSheet({ state, onClose }: { state: { key?: string } | null; onClose: () => void }) {
  const { data, updateSettings, toast } = useStore();
  const editing = state?.key;
  const [bf, setBf] = useState(0);
  const [gsm, setGsm] = useState(0);
  const [min, setMin] = useState(0);
  const [loaded, setLoaded] = useState<string | null | undefined>(undefined);
  const id = state ? (editing ?? '') : null;
  if (id !== loaded) {
    // (re)load the form when the sheet opens
    setLoaded(id);
    if (state) {
      const g = editing ? gradeFromKey(editing) : { gsm: 0, bf: 0 };
      setBf(g.bf);
      setGsm(g.gsm);
      setMin(editing ? data.settings.stockMin[editing] || 0 : 0);
    }
  }
  const save = () => {
    if (!(bf > 0 && gsm > 0 && min > 0)) return;
    updateSettings({ stockMin: { ...data.settings.stockMin, [gradeKey(gsm, bf)]: min } });
    toast('Reorder level saved');
    onClose();
  };
  const remove = () => {
    if (!editing) return;
    const next = { ...data.settings.stockMin };
    delete next[editing];
    updateSettings({ stockMin: next });
    toast('Reorder level removed');
    onClose();
  };
  return (
    <Sheet open={!!state} onClose={onClose} title={editing ? `Level for ${gradeLabel(gradeFromKey(editing).gsm, gradeFromKey(editing).bf)}` : 'New reorder level'}>
      <div className="space-y-4">
        {!editing && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="BF">
              <NumInput value={bf} onValue={setBf} />
            </Field>
            <Field label="GSM">
              <NumInput value={gsm} onValue={setGsm} />
            </Field>
          </div>
        )}
        <Field label="Keep at least" hint="You are warned when the paper in stock for this grade falls below this.">
          <NumInput value={min} onValue={setMin} suffix="kg" />
        </Field>
        <button className="btn-primary w-full" disabled={!(bf > 0 && gsm > 0 && min > 0)} onClick={save}>
          Save
        </button>
        {editing && (
          <button className="btn-danger w-full" onClick={remove}>
            Remove level
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** One reel: balance, details and its movement ledger. */
export function ReelDetail({ id }: { id: string }) {
  const { data, addStockMove, deleteStockMove, toast } = useStore();
  const nav = useNav();
  const [adjOpen, setAdjOpen] = useState(false);
  const [delMove, setDelMove] = useState<string | null>(null);
  const reel = data.reels.find((r) => r.id === id);
  if (!reel) return <Missing />;
  const balance = reelBalance(reel, data.stockMoves);
  const moves = data.stockMoves.filter((m) => m.reelId === id).sort((a, b) => b.date.localeCompare(a.date));
  const pct = reel.weightIn > 0 ? Math.max(0, Math.min(100, (balance / reel.weightIn) * 100)) : 0;

  return (
    <>
      <Header
        title={`Reel #${reel.number}`}
        subtitle={gradeLabel(reel.gsm, reel.bf)}
        back
        actions={
          <IconBtn label="Edit" onClick={() => nav.push({ name: 'reelEdit', id })}>
            <Pencil size={19} />
          </IconBtn>
        }
      />
      <Page>
        <div className="lg:mx-auto lg:max-w-2xl">
          <div className="card mb-5 p-4">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Left on the reel</div>
            <div className="tnum mt-0.5 text-[28px] font-bold tracking-tight">{kg(balance)}</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <div className="tnum mt-1 text-[12.5px] text-muted-foreground">of {kg(reel.weightIn)} received</div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-4 text-[14px]">
              <Info k="Width" v={`${reel.width} mm`} />
              <Info k="Rate" v={reel.rate ? `${data.settings.currency}${num(reel.rate)} / kg` : '—'} />
              <Info k="Supplier" v={reel.supplier || '—'} />
              <Info k="Received" v={fmtDate(reel.receivedAt)} />
              <Info k="Value left" v={reel.rate ? money0(balance * reel.rate, data.settings.currency) : '—'} />
            </dl>
            {reel.note && <p className="mt-3 whitespace-pre-wrap border-t border-border/60 pt-3 text-[13.5px] text-muted-foreground">{reel.note}</p>}
          </div>

          <button className="btn-ghost mb-5 w-full" onClick={() => setAdjOpen(true)}>
            <SlidersHorizontal size={18} /> Record waste or correct the weight
          </button>

          <Section title="Movements">
            <List>
              {moves.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">
                      {KIND[m.kind]}
                      {m.orderNo && (
                        <button className="ml-1.5 font-semibold text-primary" onClick={() => m.orderId && data.orders.some((o) => o.id === m.orderId) && nav.push({ name: 'order', id: m.orderId })}>
                          {m.orderNo}
                        </button>
                      )}
                    </div>
                    <div className="truncate text-[12.5px] text-muted-foreground">
                      {fmtDateTime(m.date)}
                      {m.note ? ` · ${m.note}` : ''}
                    </div>
                  </div>
                  <span className={`tnum text-[15px] font-bold ${m.kg < 0 ? 'text-bad' : 'text-good'}`}>
                    {m.kg > 0 ? '+' : '−'}
                    {num(Math.abs(m.kg), 1)} kg
                  </span>
                  <button aria-label="Undo this movement" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:bg-muted" onClick={() => setDelMove(m.id)}>
                    <X size={18} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">Received</div>
                  <div className="truncate text-[12.5px] text-muted-foreground">{fmtDate(reel.receivedAt)}</div>
                </div>
                <span className="tnum text-[15px] font-bold text-good">+{num(reel.weightIn, 1)} kg</span>
              </div>
            </List>
          </Section>
        </div>
      </Page>

      <AdjustSheet
        open={adjOpen}
        onClose={() => setAdjOpen(false)}
        balance={balance}
        onSave={(kind, amount, note) => {
          addStockMove({ reelId: id, kind, kg: amount, note });
          setAdjOpen(false);
          toast('Stock updated');
        }}
      />
      <Confirm
        open={delMove !== null}
        onClose={() => setDelMove(null)}
        title="Undo this movement?"
        text="It is removed from the ledger and the reel balance changes back."
        confirmLabel="Undo"
        onConfirm={() => {
          if (delMove) deleteStockMove(delMove);
          toast('Movement removed');
        }}
      />
    </>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted-foreground">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

function AdjustSheet({ open, onClose, balance, onSave }: { open: boolean; onClose: () => void; balance: number; onSave: (kind: StockMoveKind, kg: number, note: string) => void }) {
  const [kind, setKind] = useState<'waste' | 'less' | 'more'>('waste');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const removes = kind !== 'more';
  const tooMuch = removes && amount > balance + 0.001;
  const save = () => {
    if (!(amount > 0) || tooMuch) return;
    onSave(kind === 'waste' ? 'waste' : 'adjust', removes ? -amount : amount, note.trim());
    setAmount(0);
    setNote('');
  };
  return (
    <Sheet open={open} onClose={onClose} title="Waste or correction">
      <div className="space-y-4">
        <Segmented<'waste' | 'less' | 'more'>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'waste', label: 'Waste' },
            { value: 'less', label: 'Weighs less' },
            { value: 'more', label: 'Weighs more' },
          ]}
        />
        <p className="text-[13px] text-muted-foreground">
          {kind === 'waste' ? 'Paper thrown away: damaged outer wraps, end of reel, spoilage not tied to one order.' : 'Use after weighing the reel: enter only the difference from what the app shows.'}
        </p>
        <Field label="Kg" hint={tooMuch ? `Only ${kg(balance)} is left on this reel.` : undefined}>
          <NumInput value={amount} onValue={setAmount} suffix="kg" />
        </Field>
        <Field label="Note (optional)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. damp outer layers" />
        </Field>
        <button className="btn-primary w-full" disabled={!(amount > 0) || tooMuch} onClick={save}>
          <Scissors size={18} /> Save
        </button>
      </div>
    </Sheet>
  );
}

/** Add or edit a reel. */
export function ReelEdit({ id }: { id?: string }) {
  const { data, upsertReel, deleteReel, toast } = useStore();
  const nav = useNav();
  const existing = id ? data.reels.find((r) => r.id === id) : undefined;
  const nextNo = () => `R-${String(data.reels.length + 1).padStart(3, '0')}`;
  const blank = (): Pick<Reel, 'number' | 'supplier' | 'bf' | 'gsm' | 'width' | 'weightIn' | 'rate' | 'receivedAt' | 'note'> => ({
    number: nextNo(),
    supplier: '',
    bf: 0,
    gsm: 0,
    width: 0,
    weightIn: 0,
    rate: 0,
    receivedAt: todayISO(),
    note: '',
  });
  const [f, setF] = useState(() => (existing ? { ...existing } : blank()));
  const [del, setDel] = useState(false);
  const [saved, setSaved] = useState(0);
  if (id && !existing) return <Missing />;

  const ok = f.number.trim() && f.gsm > 0 && f.bf > 0 && f.width > 0 && f.weightIn > 0;
  const save = (another: boolean) => {
    if (!ok) {
      toast('Fill in reel no., BF, GSM, width and weight');
      return;
    }
    upsertReel({ ...f, id: existing?.id, number: f.number.trim(), supplier: f.supplier.trim(), note: f.note.trim() });
    toast(existing ? 'Reel updated' : 'Reel added');
    if (another) {
      // keep supplier, date, grade and rate: reels usually arrive in a batch
      setF((x) => ({ ...x, number: `R-${String(data.reels.length + 2).padStart(3, '0')}`, width: 0, weightIn: 0, note: '' }));
      setSaved((n) => n + 1);
    } else nav.back();
  };

  return (
    <>
      <Header title={existing ? `Edit reel #${existing.number}` : 'Add reel'} subtitle={saved ? `${saved} added in this batch` : undefined} back />
      <Page>
        <div className="lg:mx-auto lg:max-w-2xl">
          <Section title="Paper">
            <div className="card space-y-4 p-4">
              <div className="grid grid-cols-3 gap-3">
                <Field label="BF">
                  <NumInput value={f.bf} onValue={(v) => setF({ ...f, bf: v })} />
                </Field>
                <Field label="GSM">
                  <NumInput value={f.gsm} onValue={(v) => setF({ ...f, gsm: v })} />
                </Field>
                <Field label="Width">
                  <NumInput value={f.width} onValue={(v) => setF({ ...f, width: v })} suffix="mm" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Weight" hint="As received, from the label or weighbridge.">
                  <NumInput value={f.weightIn} onValue={(v) => setF({ ...f, weightIn: v })} suffix="kg" />
                </Field>
                <Field label="Rate / kg">
                  <NumInput value={f.rate} onValue={(v) => setF({ ...f, rate: v })} suffix={data.settings.currency} />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Details">
            <div className="card space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Reel no.">
                  <input className="input" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />
                </Field>
                <Field label="Received on">
                  <input className="input" type="date" value={f.receivedAt} onChange={(e) => setF({ ...f, receivedAt: e.target.value })} />
                </Field>
              </div>
              <Field label="Supplier / mill">
                <input className="input" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} list="boxbook-suppliers" />
                <datalist id="boxbook-suppliers">
                  {[...new Set(data.reels.map((r) => r.supplier).filter(Boolean))].map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
              <Field label="Note (optional)">
                <textarea className="input min-h-[72px]" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
              </Field>
            </div>
          </Section>

          <button className="btn-primary w-full" onClick={() => save(false)}>
            {existing ? 'Save changes' : 'Save reel'}
          </button>
          {!existing && (
            <button className="btn-ghost mt-3 w-full" onClick={() => save(true)}>
              <Plus size={18} /> Save & add another
            </button>
          )}
          {existing && (
            <button className="btn-danger mt-3 w-full" onClick={() => setDel(true)}>
              Delete reel
            </button>
          )}
        </div>
      </Page>
      <Confirm
        open={del}
        onClose={() => setDel(false)}
        title="Delete this reel?"
        text={`Reel #${existing?.number} and all its movements are removed. Paper already issued to orders is no longer tracked. This cannot be undone.`}
        onConfirm={() => {
          if (existing) deleteReel(existing.id);
          toast('Reel deleted');
          nav.setTab('more');
          nav.push({ name: 'stock' });
        }}
      />
    </>
  );
}
