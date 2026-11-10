import { Box, CircleHelp, DatabaseBackup, Layers, Plus, Settings2 } from 'lucide-react';
import { stockAlerts, stockByGrade } from '../lib/stock';
import { useStore } from '../store';
import { useNav } from '../nav';
import { specLabel } from '../lib/calc';
import { timeAgo } from '../lib/format';
import type { AppData } from '../lib/types';
import { Empty, Header, List, Page, Row, Section, Fab } from '../ui';

const iconCls = 'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary';

const stockSub = (d: AppData) => {
  const g = stockByGrade(d.reels, d.stockMoves);
  if (!g.length) return 'Reels, issue to orders';
  const kg = g.reduce((s, x) => s + x.kg, 0);
  const a = stockAlerts(d.reels, d.stockMoves, d.orders, d.settings.stockMin, d.settings.stockWastePct);
  const n = a.low.length + a.short.length;
  return `${Math.round(kg).toLocaleString('en-IN')} kg · ${g.reduce((s, x) => s + x.reels.length, 0)} reels${n ? ` · ${n} to buy` : ''}`;
};

export function More() {
  const { data } = useStore();
  const nav = useNav();
  const { settings } = data;
  return (
    <>
      <Header title="More" large />
      <Page>
        <Section>
          <List>
            <Row
              onClick={() => nav.push({ name: 'settings' })}
              icon={
                <span className={iconCls}>
                  <Settings2 size={20} />
                </span>
              }
              title="App settings"
              sub={settings.businessName || 'Company, invoice, pricing, paper stock, backup'}
            />
            <Row
              onClick={() => nav.push({ name: 'boxes' })}
              icon={
                <span className={iconCls}>
                  <Box size={20} />
                </span>
              }
              title="Saved boxes"
              sub={`${data.boxes.length} saved`}
            />
            <Row
              onClick={() => nav.push({ name: 'stock' })}
              icon={
                <span className={iconCls}>
                  <Layers size={20} />
                </span>
              }
              title="Paper stock"
              sub={stockSub(data)}
            />
            <Row
              onClick={() => nav.push({ name: 'backup' })}
              icon={
                <span className={iconCls}>
                  <DatabaseBackup size={20} />
                </span>
              }
              title="Backup & restore"
              sub={settings.lastBackupAt ? `Last backup ${timeAgo(settings.lastBackupAt)}` : 'Not backed up yet'}
            />
            <Row
              onClick={() => nav.push({ name: 'help' })}
              icon={
                <span className={iconCls}>
                  <CircleHelp size={20} />
                </span>
              }
              title="Help & FAQ"
              sub="Answers, backup tips and privacy"
            />
          </List>
        </Section>

        <p className="px-2 text-center text-[12.5px] text-muted-foreground">
          BoxBook keeps all data on this phone only. There is no account and no server — so back up regularly.
        </p>
      </Page>
    </>
  );
}

export function BoxesList() {
  const { data } = useStore();
  const nav = useNav();
  const customers = new Map(data.customers.map((c) => [c.id, c]));
  const list = [...data.boxes].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <Header title="Saved boxes" subtitle={`${list.length} saved`} back />
      <Page>
        {list.length === 0 ? (
          <Empty
            icon={<Box size={28} />}
            title="No saved boxes"
            text="Save a box from the calculator to reuse its size, paper and price in orders."
            action={
              <button className="btn-primary" onClick={() => nav.push({ name: 'box' })}>
                <Plus size={18} /> New box
              </button>
            }
          />
        ) : (
          <List>
            {list.map((b) => (
              <Row
                key={b.id}
                onClick={() => nav.push({ name: 'box', id: b.id })}
                icon={<Box size={20} className="text-primary" />}
                title={b.name}
                sub={[specLabel(b.spec), customers.get(b.customerId || '')?.name].filter(Boolean).join(' · ')}
              />
            ))}
          </List>
        )}
      </Page>
      {list.length > 0 && <Fab label="Box" icon={<Plus size={20} />} onClick={() => nav.push({ name: 'box' })} />}
    </>
  );
}
