"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, CalendarDays, Megaphone, PencilLine, ShoppingBag, Sparkles, UserCheck, UserRoundX, UsersRound, WalletCards, X } from "lucide-react";
import type { AppData } from "@/lib/types";
import { dashboardMetrics } from "@/lib/metrics";
import { formatDate, money, percent } from "@/lib/utils";

interface Props {
  data: AppData;
  expoId: string;
  onExpoChange: (id: string) => void;
  onSaveMarketing: (value: { expoId: string; asOfDate: string; adsSpend: number; sales: number }) => void;
}

export function Dashboard({ data, expoId, onExpoChange, onSaveMarketing }: Props) {
  const expo = data.expos.find((item) => item.id === expoId) ?? data.expos[0];
  const [from, setFrom] = useState(expo?.startDate ?? "");
  const [to, setTo] = useState(expo?.endDate ?? "");
  const [marketingOpen, setMarketingOpen] = useState(false);
  const metrics = useMemo(() => dashboardMetrics(data, expo?.id ?? "", from, to), [data, expo?.id, from, to]);
  const [marketingForm, setMarketingForm] = useState({ asOfDate: expo?.endDate ?? "", adsSpend: metrics.adsSpend, sales: metrics.sales });

  function changeExpo(id: string) {
    const selected = data.expos.find((item) => item.id === id);
    if (!selected) return;
    onExpoChange(id);
    setFrom(selected.startDate);
    setTo(selected.endDate);
  }

  function openMarketing() {
    const current = dashboardMetrics(data, expo.id, from, to);
    setMarketingForm({ asOfDate: to || expo.endDate, adsSpend: current.adsSpend, sales: current.sales });
    setMarketingOpen(true);
  }

  const statusData = [
    { name: "Attended", value: metrics.attended, color: "#163f35" },
    { name: "Pending", value: metrics.pending, color: "#d6a847" },
    { name: "No show", value: metrics.noShow, color: "#dc796d" },
  ];
  const clientData = [
    { name: "New", value: metrics.newCount, color: "#163f35" },
    { name: "VIP", value: metrics.vipCount, color: "#d8b15b" },
  ];

  return <>
    <PageHeader
      eyebrow="Performance overview"
      title="Expo dashboard"
      subtitle={expo ? `${expo.name} · ${expo.location}` : "Select an expo"}
      actions={<>
        <div className="date-control"><CalendarDays size={16} /><input aria-label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span>—</span><input aria-label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button className="button secondary" onClick={openMarketing}><PencilLine size={16} /> Marketing data</button>
      </>}
    />

    <div className="filter-row expo-filter-row">
      <label>Viewing</label>
      <select value={expo?.id} onChange={(e) => changeExpo(e.target.value)}>{data.expos.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <span className="freshness"><span /> Live local data</span>
    </div>

    <section className="metric-grid">
      <MetricCard label="RSVP" value={String(metrics.rsvp)} detail={`${metrics.pending} still pending`} icon={<UsersRound />} tone="sage" />
      <MetricCard label="Attended" value={String(metrics.attended)} detail={`${percent(metrics.attended, metrics.rsvp)} attendance`} icon={<UserCheck />} tone="blue" />
      <MetricCard label="No show" value={String(metrics.noShow)} detail={`${percent(metrics.noShow, metrics.rsvp)} of RSVP`} icon={<UserRoundX />} tone="rose" />
      <MetricCard label="Purchase" value={String(metrics.purchased)} detail={`${percent(metrics.purchased, metrics.attended)} conversion`} icon={<ShoppingBag />} tone="gold" />
      <MetricCard label="Conversion" value={metrics.conversion === null ? "—" : `${Math.round(metrics.conversion * 100)}%`} detail="Purchase / attended" icon={<ArrowUpRight />} tone="blue" />
      <MetricCard label="Freebie only" value={String(metrics.freebieOnly)} detail={`${percent(metrics.freebieOnly, metrics.attended)} of attended`} icon={<Sparkles />} tone="rose" />
      <MetricCard label="Ads spend UTD" value={money(metrics.adsSpend)} detail={metrics.costPerAppointment === null ? "CPA —" : `${money(metrics.costPerAppointment)} per RSVP`} icon={<Megaphone />} tone="sage" compact />
      <MetricCard label="ROAS" value={metrics.roas === null ? "—" : `${metrics.roas.toFixed(2)}x`} detail={metrics.aov === null ? "AOV —" : `AOV ${money(metrics.aov)}`} icon={<WalletCards />} tone="gold" />
    </section>

    <section className="analytics-grid">
      <ChartCard title="Daily appointment" subtitle={`${formatDate(from)} — ${formatDate(to)}`} className="wide">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={metrics.byDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs><linearGradient id="rsvpFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#183f35" stopOpacity={0.25}/><stop offset="100%" stopColor="#183f35" stopOpacity={0.01}/></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#e8e9e5" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#7a807c", fontSize: 12 }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#7a807c", fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e3e5e1", boxShadow: "0 12px 30px rgba(20,42,35,.12)" }} />
            <Area type="monotone" dataKey="RSVP" stroke="#183f35" strokeWidth={2.5} fill="url(#rsvpFill)" />
            <Area type="monotone" dataKey="Attended" stroke="#d3a746" strokeWidth={2.5} fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Appointment status" subtitle="Where every RSVP stands">
        <Donut data={statusData} center={`${metrics.rsvp}`} centerLabel="RSVP" />
        <Legend data={statusData} />
      </ChartCard>
      <ChartCard title="Time slot performance" subtitle="RSVP and purchase by slot" className="wide">
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={metrics.bySlot} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e8e9e5" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#7a807c", fontSize: 12 }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#7a807c", fontSize: 12 }} />
            <Tooltip cursor={{ fill: "#f4f4f1" }} contentStyle={{ borderRadius: 12, border: "1px solid #e3e5e1" }} />
            <Bar dataKey="RSVP" fill="#d8e7e1" radius={[5, 5, 0, 0]} />
            <Bar dataKey="Purchase" fill="#183f35" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="NEW vs VIP" subtitle="User mix for this expo">
        <Donut data={clientData} center={`${metrics.newCount}`} centerLabel="New" />
        <Legend data={clientData} />
      </ChartCard>
    </section>

    <section className="panel source-panel">
      <div className="panel-heading"><div><h2>Source performance</h2><p>RSVP quality and conversion by confirmed source</p></div><span className="updated-pill">UTD snapshot</span></div>
      <div className="table-wrap"><table><thead><tr><th>Source</th><th>RSVP</th><th>Attended</th><th>Purchase</th><th>Conversion</th><th>Share</th></tr></thead><tbody>
        {metrics.bySource.map((row) => <tr key={row.source}><td><strong>{row.source}</strong></td><td>{row.rsvp}</td><td>{row.attended}</td><td>{row.purchase}</td><td><span className="rate-pill">{row.conversion}%</span></td><td><div className="mini-progress"><i style={{ width: `${metrics.rsvp ? row.rsvp / metrics.rsvp * 100 : 0}%` }} /></div></td></tr>)}
      </tbody></table></div>
    </section>

    {marketingOpen && <div className="drawer-backdrop" onMouseDown={(e) => e.currentTarget === e.target && setMarketingOpen(false)}><aside className="drawer small-drawer">
      <div className="drawer-head"><div><span className="eyebrow">Marketer workspace</span><h2>Update performance</h2><p>Save cumulative figures as of a selected date.</p></div><button className="icon-button" onClick={() => setMarketingOpen(false)} aria-label="Close"><X /></button></div>
      <div className="drawer-body form-stack">
        <label className="field"><span>As of date</span><input type="date" value={marketingForm.asOfDate} onChange={(e) => setMarketingForm({ ...marketingForm, asOfDate: e.target.value })} /></label>
        <label className="field"><span>Actual ads spend UTD (RM)</span><input type="number" min="0" value={marketingForm.adsSpend} onChange={(e) => setMarketingForm({ ...marketingForm, adsSpend: Number(e.target.value) })} /></label>
        <label className="field"><span>Sales from RSVP UTD (RM)</span><input type="number" min="0" value={marketingForm.sales} onChange={(e) => setMarketingForm({ ...marketingForm, sales: Number(e.target.value) })} /></label>
        <div className="formula-preview"><div><span>CPA</span><strong>{metrics.rsvp ? money(marketingForm.adsSpend / metrics.rsvp) : "—"}</strong></div><div><span>AOV</span><strong>{metrics.purchased ? money(marketingForm.sales / metrics.purchased) : "—"}</strong></div><div><span>ROAS</span><strong>{marketingForm.adsSpend ? `${(marketingForm.sales / marketingForm.adsSpend).toFixed(2)}x` : "—"}</strong></div></div>
      </div>
      <div className="drawer-footer"><button className="button ghost" onClick={() => setMarketingOpen(false)}>Cancel</button><button className="button primary" onClick={() => { onSaveMarketing({ expoId: expo.id, ...marketingForm }); setMarketingOpen(false); }}>Save snapshot</button></div>
    </aside></div>}
  </>;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: React.ReactNode }) {
  return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="header-actions">{actions}</div>}</header>;
}

function MetricCard({ label, value, detail, icon, tone, compact }: { label: string; value: string; detail: string; icon: React.ReactNode; tone: string; compact?: boolean }) {
  return <article className={`metric-card ${tone}`}><div className="metric-top"><span>{label}</span><i>{icon}</i></div><strong className={compact ? "compact" : ""}>{value}</strong><p>{detail}</p></article>;
}

function ChartCard({ title, subtitle, children, className = "" }: { title: string; subtitle: string; children: React.ReactNode; className?: string }) {
  return <article className={`panel chart-card ${className}`}><div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</article>;
}

function Donut({ data, center, centerLabel }: { data: { name: string; value: number; color: string }[]; center: string; centerLabel: string }) {
  return <div className="donut-wrap"><ResponsiveContainer width="100%" height={175}><PieChart><Pie data={data} dataKey="value" innerRadius={55} outerRadius={73} startAngle={90} endAngle={-270} paddingAngle={3}>{data.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{center}</strong><span>{centerLabel}</span></div></div>;
}

function Legend({ data }: { data: { name: string; value: number; color: string }[] }) {
  return <div className="chart-legend">{data.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<strong>{item.value}</strong></span>)}</div>;
}
