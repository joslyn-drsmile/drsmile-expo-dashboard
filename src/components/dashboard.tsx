"use client";

import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format as calendarFormat, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, ArrowUpRight, BadgeDollarSign, Calculator, CalendarDays, ChevronLeft, ChevronRight, History, MapPin, Megaphone, PencilLine, ReceiptText, ShoppingBag, Sparkles, TrendingUp, UserCheck, UserRoundX, UsersRound, WalletCards, X } from "lucide-react";
import type { AppData } from "@/lib/types";
import { dashboardMetrics } from "@/lib/metrics";
import { expoStatus, formatDate, money, percent } from "@/lib/utils";

interface Props {
  data: AppData;
  expoId: string;
  onExpoChange: (id: string) => void;
  onOpenAppointments: (id: string) => void;
  onSaveMarketing: (value: { expoId: string; asOfDate: string; adsSpend: number; forecastSales: number; sales: number }) => void;
}

export function Dashboard({ data, expoId, onExpoChange, onOpenAppointments, onSaveMarketing }: Props) {
  const expo = data.expos.find((item) => item.id === expoId) ?? data.expos[0];
  const [from, setFrom] = useState(expo?.startDate ?? "");
  const [to, setTo] = useState(expo?.endDate ?? "");
  const [marketingOpen, setMarketingOpen] = useState(false);
  const metrics = useMemo(() => dashboardMetrics(data, expo?.id ?? "", from, to), [data, expo?.id, from, to]);
  const [marketingForm, setMarketingForm] = useState({ asOfDate: expo?.endDate ?? "", adsSpend: metrics.adsSpend, forecastSales: metrics.forecastSales, sales: metrics.sales });
  const recentHistory = useMemo(() => [...data.auditLogs].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 15), [data.auditLogs]);
  const expoOverview = useMemo(() => {
    const summaries = data.expos.map((item) => ({
      expo: item,
      status: expoStatus(item),
      metrics: dashboardMetrics(data, item.id, item.startDate, item.endDate),
    }));
    const ongoing = summaries.filter((item) => item.status === "Ongoing").sort((left, right) => left.expo.startDate.localeCompare(right.expo.startDate));
    const upcoming = summaries.filter((item) => item.status === "Upcoming").sort((left, right) => left.expo.startDate.localeCompare(right.expo.startDate));
    const ended = summaries.filter((item) => item.status === "Ended").sort((left, right) => right.expo.endDate.localeCompare(left.expo.endDate));
    return [...ongoing, ...upcoming, ...ended].slice(0, 3);
  }, [data]);

  function changeExpo(id: string) {
    const selected = data.expos.find((item) => item.id === id);
    if (!selected) return;
    onExpoChange(id);
    setFrom(selected.startDate);
    setTo(selected.endDate);
  }

  function openMarketing() {
    const current = dashboardMetrics(data, expo.id, from, to);
    setMarketingForm({ asOfDate: to || expo.endDate, adsSpend: current.adsSpend, forecastSales: current.forecastSales, sales: current.sales });
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
        <DateRangePicker from={from} to={to} min={expo.startDate} max={expo.endDate} onChange={(nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo); }} />
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
      <MetricCard label="Forecast sales for lead" value={money(metrics.forecastSales)} detail="Marketer forecast" icon={<TrendingUp />} tone="blue" compact />
      <MetricCard label="Cost per appointment" value={metrics.costPerAppointment === null ? "—" : money(metrics.costPerAppointment)} detail="Ads spend / RSVP" icon={<Calculator />} tone="rose" compact />
      <MetricCard label="AOV" value={metrics.aov === null ? "—" : money(metrics.aov)} detail="Sales / purchase" icon={<ReceiptText />} tone="sage" compact />
      <MetricCard label="Sales from RSVP" value={money(metrics.sales)} detail={metrics.hasManualSales ? "Manual marketing snapshot" : "Auto total from purchase amounts"} icon={<BadgeDollarSign />} tone="gold" compact />
    </section>

    <section className="expo-overview panel">
      <div className="expo-overview-heading"><div><h2>Expo Overview</h2><p>Ongoing, upcoming and recent Expo performance</p></div><span>Full Expo totals</span></div>
      <div className="expo-overview-grid">{expoOverview.map(({ expo: item, status, metrics: summary }) => {
        const attendanceRate = summary.rsvp ? Math.round(summary.attended / summary.rsvp * 100) : 0;
        const dates = item.startDate === item.endDate ? formatDate(item.startDate) : `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`;
        return <button type="button" className={`expo-overview-card ${status.toLowerCase()}`} key={item.id} onClick={() => onOpenAppointments(item.id)} aria-label={`Open ${item.name} appointments`}>
          <div className="expo-overview-top"><span className="expo-overview-status">{status}</span><time>{dates}</time></div>
          <h3>{item.name}</h3>
          <p><MapPin /> {item.location}</p>
          <div className="expo-overview-stats"><div><span>RSVP</span><strong>{summary.rsvp}</strong></div><div><span>Attended</span><strong>{summary.attended}</strong><small>{attendanceRate}%</small></div><div><span>Conversion</span><strong>{summary.conversion === null ? "—" : `${Math.round(summary.conversion * 100)}%`}</strong><small>{summary.purchased} purchased</small></div><div><span>Sales from RSVP</span><strong>{money(summary.sales)}</strong></div></div>
          <div className="expo-attendance-track"><i style={{ width: `${attendanceRate}%` }} /></div>
          <div className="expo-overview-link">Open schedule <ArrowRight /></div>
        </button>;
      })}</div>
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

    <section className="panel edit-history-panel">
      <div className="panel-heading"><div><h2>Edit history</h2><p>Latest dashboard changes and who made them</p></div><span className="updated-pill"><History /> Recent activity</span></div>
      <div className="edit-history-list">
        {recentHistory.map((log) => {
          const actor = log.actorName || log.actorEmail || "System / Historical";
          const initials = actor === "System / Historical" ? "S" : actor.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
          return <article key={log.id}><i>{initials}</i><div><strong>{log.summary}</strong><span>by {actor} · {formatAuditTime(log.createdAt)}</span></div><b>{log.action}</b></article>;
        })}
        {!recentHistory.length && <div className="history-empty">No changes recorded yet.</div>}
      </div>
    </section>

    {marketingOpen && <div className="drawer-backdrop" onMouseDown={(e) => e.currentTarget === e.target && setMarketingOpen(false)}><aside className="drawer small-drawer">
      <div className="drawer-head"><div><span className="eyebrow">Marketer workspace</span><h2>Update performance</h2><p>Save cumulative figures as of a selected date.</p></div><button className="icon-button" onClick={() => setMarketingOpen(false)} aria-label="Close"><X /></button></div>
      <div className="drawer-body form-stack">
        <label className="field"><span>As of date</span><input type="date" value={marketingForm.asOfDate} onChange={(e) => setMarketingForm({ ...marketingForm, asOfDate: e.target.value })} /></label>
        <label className="field"><span>Actual ads spend UTD (RM)</span><input type="number" min="0" value={marketingForm.adsSpend} onChange={(e) => setMarketingForm({ ...marketingForm, adsSpend: Number(e.target.value) })} /></label>
        <label className="field"><span>Forecast sales for lead (RM)</span><input type="number" min="0" value={marketingForm.forecastSales} onChange={(e) => setMarketingForm({ ...marketingForm, forecastSales: Number(e.target.value) })} /></label>
        <label className="field"><span>Sales from RSVP UTD (RM)</span><input type="number" min="0" value={marketingForm.sales} onChange={(e) => setMarketingForm({ ...marketingForm, sales: Number(e.target.value) })} /></label>
        <div className="form-info marketing-sales-info"><span>Auto total from Purchase Amount: <strong>{money(metrics.autoSales)}</strong>. You may replace it with the marketer&apos;s confirmed total.</span><button type="button" onClick={() => setMarketingForm({ ...marketingForm, sales: metrics.autoSales })}>Use auto total</button></div>
        <div className="formula-preview"><div><span>CPA</span><strong>{metrics.rsvp ? money(marketingForm.adsSpend / metrics.rsvp) : "—"}</strong></div><div><span>AOV</span><strong>{metrics.purchased ? money(marketingForm.sales / metrics.purchased) : "—"}</strong></div><div><span>ROAS</span><strong>{marketingForm.adsSpend ? `${(marketingForm.sales / marketingForm.adsSpend).toFixed(2)}x` : "—"}</strong></div></div>
      </div>
      <div className="drawer-footer"><button className="button ghost" onClick={() => setMarketingOpen(false)}>Cancel</button><button className="button primary" onClick={() => { onSaveMarketing({ expoId: expo.id, ...marketingForm }); setMarketingOpen(false); }}>Save snapshot</button></div>
    </aside></div>}
  </>;
}

function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function DateRangePicker({ from, to, min, max, onChange }: { from: string; to: string; min: string; max: string; onChange: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(parseISO(from || min)));
  const [rangeStart, setRangeStart] = useState("");
  const monthDays = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }) });
  const rangeLabel = from === to ? calendarFormat(parseISO(from), "d MMM yyyy") : `${calendarFormat(parseISO(from), "d MMM")} – ${calendarFormat(parseISO(to), "d MMM yyyy")}`;
  const expoLabel = min === max ? calendarFormat(parseISO(min), "d MMM yyyy") : `${calendarFormat(parseISO(min), "d MMM")}–${calendarFormat(parseISO(max), "d MMM yyyy")}`;
  const firstMonth = min.slice(0, 7);
  const lastMonth = max.slice(0, 7);
  const currentMonth = calendarFormat(month, "yyyy-MM");

  function showCalendar() {
    setMonth(startOfMonth(parseISO(from || min)));
    setRangeStart("");
    setOpen((value) => !value);
  }

  function selectDate(value: string) {
    if (!rangeStart) {
      setRangeStart(value);
      onChange(value, value);
      return;
    }
    onChange(value < rangeStart ? value : rangeStart, value < rangeStart ? rangeStart : value);
    setRangeStart("");
    setOpen(false);
  }

  return <div className="date-picker-wrap">
    <button type="button" className="date-range-trigger" onClick={showCalendar} aria-haspopup="dialog" aria-expanded={open}>
      <i><CalendarDays /></i><span><small>Reporting period</small><strong>{rangeLabel}</strong></span>
    </button>
    {open && <>
      <button type="button" className="date-picker-dismiss" aria-label="Close calendar" onClick={() => { setOpen(false); setRangeStart(""); }} />
      <div className="date-picker-popover" role="dialog" aria-label="Choose dashboard date range">
        <div className="date-picker-heading">
          <button type="button" aria-label="Previous month" disabled={currentMonth <= firstMonth} onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></button>
          <strong>{calendarFormat(month, "MMMM yyyy")}</strong>
          <button type="button" aria-label="Next month" disabled={currentMonth >= lastMonth} onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></button>
        </div>
        <div className="date-picker-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="date-picker-days">{monthDays.map((day) => {
          const value = calendarFormat(day, "yyyy-MM-dd");
          const available = value >= min && value <= max;
          const start = value === from;
          const end = value === to;
          const within = value > from && value < to;
          return <button type="button" key={value} disabled={!available} className={`${!isSameMonth(day, month) ? "outside" : ""} ${start ? "range-start" : ""} ${end ? "range-end" : ""} ${within ? "in-range" : ""}`} onClick={() => selectDate(value)} aria-label={calendarFormat(day, "d MMMM yyyy")}>{calendarFormat(day, "d")}</button>;
        })}</div>
        <div className="date-picker-foot"><strong>{rangeStart ? "Now choose the end date" : "Choose the start date"}</strong><span>Available Expo dates: {expoLabel}</span></div>
      </div>
    </>}
  </div>;
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
