"use client";

import { useMemo, useState } from "react";
import { Ban, Check, ChevronDown, Clock3, ExternalLink, Filter, LayoutList, ListFilter, PencilLine, Plus, Search, Table2, TriangleAlert, UserRound, X } from "lucide-react";
import type { AppData, Appointment, BlacklistEntry } from "@/lib/types";
import type { NewAppointmentInput } from "@/lib/store";
import { appointmentPhase, customerFor, displayPhone, formatDate, normalizePhone, sourceBadgeTone, sourceName, timeSlotTone } from "@/lib/utils";
import { PageHeader } from "./dashboard";
import { QuickAdd } from "./quick-add";
import { AppointmentEditor } from "./appointment-editor";

interface Props {
  data: AppData;
  expoId: string;
  onExpoChange: (id: string) => void;
  onToggle: (id: string, field: "baristaRegistered" | "attended" | "purchased" | "reminderSent") => void;
  onUpdate: (id: string, patch: Partial<Appointment>) => void;
  onUpdateDetails: (id: string, input: NewAppointmentInput) => { ok: boolean; error?: string };
  onDelete: (id: string) => void;
  onCreate: (input: NewAppointmentInput) => { ok: boolean; error?: string };
  onAddSource: (name: string) => string;
  onAddBlacklist: (entry: Omit<BlacklistEntry, "id" | "normalizedPhone" | "active">) => { ok: boolean; error?: string };
  onToggleBlacklist: (id: string) => void;
}

type View = "schedule" | "table";
const QUICK_ADD_OPEN_KEY = "drsmile-quick-add-open";

function activeBlacklistEntry(data: AppData, phone: string) {
  const normalized = normalizePhone(phone);
  return data.blacklist.find((entry) => entry.active && normalizePhone(entry.normalizedPhone || entry.originalPhone) === normalized);
}

export function Appointments({ data, expoId, onExpoChange, onToggle, onUpdate, onUpdateDetails, onDelete, onCreate, onAddSource, onAddBlacklist, onToggleBlacklist }: Props) {
  const [view, setView] = useState<View>("schedule");
  const expo = data.expos.find((item) => item.id === expoId) ?? data.expos[0];
  const days = data.days.filter((item) => item.expoId === expo.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const [dayId, setDayId] = useState(days[0]?.id ?? "");
  const [quickAdd, setQuickAddState] = useState(() => typeof window !== "undefined" && window.sessionStorage.getItem(QUICK_ADD_OPEN_KEY) === "1");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [baristaFilter, setBaristaFilter] = useState("all");
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [purchaseFilter, setPurchaseFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addingSource, setAddingSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const setQuickAdd = (open: boolean) => {
    if (open) window.sessionStorage.setItem(QUICK_ADD_OPEN_KEY, "1");
    else window.sessionStorage.removeItem(QUICK_ADD_OPEN_KEY);
    setQuickAddState(open);
  };

  const expoAppointments = useMemo(() => data.appointments.filter((appointment) => appointment.expoId === expo.id && appointment.state === "Booked").filter((appointment) => {
    const customer = customerFor(data, appointment);
    const needle = search.toLowerCase().trim();
    const matchesSearch = !needle || [customer?.name, customer?.normalizedPhone, appointment.platformName, appointment.adsName].some((value) => value?.toLowerCase().includes(needle));
    return matchesSearch
      && (sourceFilter === "all" || appointment.sourceId === sourceFilter)
      && (userFilter === "all" || appointment.userType === userFilter)
      && (baristaFilter === "all" || (baristaFilter === "yes" ? appointment.baristaRegistered : !appointment.baristaRegistered))
      && (attendanceFilter === "all" || (attendanceFilter === "yes" ? appointment.attended : !appointment.attended))
      && (purchaseFilter === "all" || (purchaseFilter === "yes" ? appointment.purchased : !appointment.purchased));
  }), [data, expo.id, search, sourceFilter, userFilter, baristaFilter, attendanceFilter, purchaseFilter]);

  function changeExpo(id: string) {
    onExpoChange(id);
    const nextDay = data.days.filter((item) => item.expoId === id).sort((a, b) => a.sortOrder - b.sortOrder)[0];
    setDayId(nextDay?.id ?? "");
  }

  const activeDayId = days.some((day) => day.id === dayId) ? dayId : days[0]?.id;
  const activeCount = [sourceFilter, userFilter, baristaFilter, attendanceFilter, purchaseFilter].filter((item) => item !== "all").length;
  const sortedTableAppointments = useMemo(() => [...expoAppointments].sort((left, right) => {
    const leftDay = data.days.find((item) => item.id === left.dayId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightDay = data.days.find((item) => item.id === right.dayId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftDay !== rightDay) return leftDay - rightDay;
    const leftSlot = data.slots.find((item) => item.id === left.slotId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightSlot = data.slots.find((item) => item.id === right.slotId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftSlot !== rightSlot) return leftSlot - rightSlot;
    const leftName = customerFor(data, left)?.name ?? "";
    const rightName = customerFor(data, right)?.name ?? "";
    return leftName.localeCompare(rightName);
  }), [data, expoAppointments]);

  function changeSourceFilter(value: string) {
    if (value !== "__add__") return setSourceFilter(value);
    setAddingSource(true);
  }

  function addSource() {
    const name = newSourceName.trim();
    if (!name) return;
    const id = onAddSource(name);
    if (id) setSourceFilter(id);
    setNewSourceName("");
    setAddingSource(false);
  }

  return <>
    <PageHeader eyebrow="Daily operations" title="Appointments" subtitle="See exactly who is arriving, when, and what needs attention." actions={<>
      <div className="segmented"><button className={view === "schedule" ? "active" : ""} onClick={() => setView("schedule")}><LayoutList /> Schedule</button><button className={view === "table" ? "active" : ""} onClick={() => setView("table")}><Table2 /> Table</button></div>
      <button className="button primary" onClick={() => setQuickAdd(true)}><Plus /> Quick add</button>
    </>} />

    <section className="appointment-toolbar panel">
      <div className="expo-picker"><span>Expo</span><select value={expo.id} onChange={(e) => changeExpo(e.target.value)}>{data.expos.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown /></div>
      <div className="search-box"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, phone, platform name or ads name" />{search && <button onClick={() => setSearch("")}><X /></button>}</div>
      <button className={`button filter-button ${activeCount ? "has-filters" : ""}`} onClick={() => setFiltersOpen(!filtersOpen)}><Filter /> Filters {activeCount > 0 && <b>{activeCount}</b>}</button>
    </section>

      {filtersOpen && <section className="filter-panel panel"><label>Source<select value={sourceFilter} onChange={(e) => changeSourceFilter(e.target.value)}><option value="all">All sources</option>{data.sources.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="__add__">＋ Add new source…</option></select>{addingSource && <div className="inline-add compact"><input autoFocus value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } if (e.key === "Escape") setAddingSource(false); }} placeholder="New source name" /><button type="button" className="button primary" onClick={addSource} disabled={!newSourceName.trim()}><Check size={14} /> Add</button><button type="button" className="icon-button" onClick={() => { setAddingSource(false); setNewSourceName(""); }} aria-label="Cancel adding source"><X size={14} /></button></div>}</label><label>User<select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}><option value="all">All users</option><option value="NEW">NEW</option><option value="VIP">VIP</option></select></label><label>Barista<select value={baristaFilter} onChange={(e) => setBaristaFilter(e.target.value)}><option value="all">All</option><option value="yes">Registered</option><option value="no">Not registered</option></select></label><label>Attended<select value={attendanceFilter} onChange={(e) => setAttendanceFilter(e.target.value)}><option value="all">All</option><option value="yes">Attended</option><option value="no">Not attended</option></select></label><label>Purchased<select value={purchaseFilter} onChange={(e) => setPurchaseFilter(e.target.value)}><option value="all">All</option><option value="yes">Purchased</option><option value="no">Not purchased</option></select></label><button className="link-button" onClick={() => { setSourceFilter("all"); setUserFilter("all"); setBaristaFilter("all"); setAttendanceFilter("all"); setPurchaseFilter("all"); }}>Clear all</button></section>}

    {view === "schedule" ? <>
      <div className="day-tabs">{days.map((day) => { const count = expoAppointments.filter((item) => item.dayId === day.id).length; return <button key={day.id} className={activeDayId === day.id ? "active" : ""} onClick={() => setDayId(day.id)}><span>{formatDate(day.date, "long")}</span><b>{count} appointments</b></button>; })}</div>
      <ScheduleView data={data} appointments={expoAppointments.filter((item) => item.dayId === activeDayId)} dayId={activeDayId} onToggle={onToggle} onEdit={setEditing} />
    </> : <TableView data={data} appointments={sortedTableAppointments} onToggle={onToggle} onUpdate={onUpdate} onEdit={setEditing} />}

    {quickAdd && <QuickAdd data={data} defaultExpoId={expo.id} onClose={() => setQuickAdd(false)} onCreate={onCreate} onAddSource={onAddSource} />}
    {editing && <AppointmentEditor data={data} appointment={editing} onClose={() => setEditing(null)} onSave={onUpdateDetails} onDelete={onDelete} onAddBlacklist={onAddBlacklist} onReactivateBlacklist={onToggleBlacklist} onSetAttention={(id, attention, reason) => onUpdate(id, { attention, attentionReason: reason })} />}
  </>;
}

function ScheduleView({ data, appointments, dayId, onToggle, onEdit }: { data: AppData; appointments: Appointment[]; dayId: string; onToggle: Props["onToggle"]; onEdit: (appointment: Appointment) => void }) {
  const slots = data.slots.filter((item) => item.dayId === dayId && item.active).sort((a, b) => a.sortOrder - b.sortOrder);
  return <div className="schedule-list">{slots.map((slot) => {
    const rows = appointments.filter((item) => item.slotId === slot.id);
    return <section className="slot-group panel" key={slot.id}>
      <div className={`slot-header ${timeSlotTone(slot.startTime)}`}><div className="slot-time"><Clock3 /><div><h2>{slot.label}</h2><p>{slot.startTime} – {slot.endTime}</p></div></div><div className="slot-count"><strong>{rows.length}</strong><span>appointments</span></div></div>
      {rows.length ? <div className="appointment-cards">{rows.map((appointment) => <AppointmentCard key={appointment.id} data={data} appointment={appointment} onToggle={onToggle} onEdit={onEdit} />)}</div> : <div className="empty-slot"><UserRound /><span>No appointments in this time slot</span></div>}
    </section>;
  })}</div>;
}

function AppointmentCard({ data, appointment, onToggle, onEdit }: { data: AppData; appointment: Appointment; onToggle: Props["onToggle"]; onEdit: (appointment: Appointment) => void }) {
  const customer = customerFor(data, appointment)!;
  const blacklistEntry = activeBlacklistEntry(data, customer.normalizedPhone);
  const phase = appointmentPhase(appointment, data.slots.find((item) => item.id === appointment.slotId), data);
  const source = sourceName(data, appointment.sourceId);
  return <article className={`appointment-card ${appointment.attention ? "attention-row" : ""} ${blacklistEntry ? "blacklisted-row" : ""}`}>
    <div className="customer-cell"><div className="avatar">{customer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><strong>{customer.name}</strong><a href={`tel:+${customer.normalizedPhone}`}>{displayPhone(customer.normalizedPhone)}</a></div></div>
    <div className="appointment-meta"><span className={`status-badge ${phase.toLowerCase().replace(" ", "-")}`}>{phase}</span><span className={`source-badge ${sourceBadgeTone(source)}`}>{source}</span><span className={`client-badge ${appointment.userType.toLowerCase()}`}>{appointment.userType}</span>{blacklistEntry && <span className="blacklisted-badge" title={blacklistEntry.reason}><Ban /> Blacklisted</span>}{appointment.attention && <span className="attention-badge" title={appointment.attentionReason}><TriangleAlert /> Attention</span>}</div>
    <div className="concern"><span>Concern</span><strong>{appointment.concern || "—"}</strong>{blacklistEntry && <div className="blacklist-reason-detail"><Ban /><span><b>Blacklist reason</b><p>{blacklistEntry.reason}</p></span></div>}{appointment.attention && <div className="attention-reason"><TriangleAlert /><span><b>Team attention</b><p>{appointment.attentionReason}</p></span></div>}<div className={`schedule-remark ${appointment.remark ? "has-remark" : "empty"}`}><b>Remark</b><p>{appointment.remark || "No remark"}</p></div></div>
    <div className="quick-checks"><QuickCheck label="Barista" checked={appointment.baristaRegistered} onClick={() => onToggle(appointment.id, "baristaRegistered")} /><QuickCheck label="Attended" checked={appointment.attended} onClick={() => onToggle(appointment.id, "attended")} /><QuickCheck label="Purchased" checked={appointment.purchased} onClick={() => onToggle(appointment.id, "purchased")} /><QuickCheck label="Reminder" checked={appointment.reminderSent} onClick={() => onToggle(appointment.id, "reminderSent")} /><button className="edit-record" onClick={() => onEdit(appointment)}><i><PencilLine /></i><span>Edit</span></button></div>
  </article>;
}

function QuickCheck({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return <button className={checked ? "checked" : ""} onClick={onClick}><i>{checked && <Check />}</i><span>{label}</span></button>;
}

function TableView({ data, appointments, onToggle, onUpdate, onEdit }: { data: AppData; appointments: Appointment[]; onToggle: Props["onToggle"]; onUpdate: Props["onUpdate"]; onEdit: (appointment: Appointment) => void }) {
  return <section className="panel appointment-table-panel"><div className="table-summary"><div><ListFilter /><span><strong>{appointments.length}</strong> matching appointments</span></div><small>Type directly, press Enter or Tab to save</small></div><div className="table-wrap appointment-table-wrap"><table className="appointment-table"><thead><tr><th className="sticky-customer">Customer</th><th>Platform Name</th><th>Phone</th><th>Date</th><th>Time</th><th>Source</th><th>User</th><th>Purchase amount</th><th>Barista</th><th>Attended</th><th>Purchased</th><th>Reminder</th><th>Ads name</th><th>Ads link</th><th>Remark</th><th>Edit</th></tr></thead><tbody>{appointments.map((appointment) => {
    const customer = customerFor(data, appointment)!;
    const blacklistEntry = activeBlacklistEntry(data, customer.normalizedPhone);
    const day = data.days.find((item) => item.id === appointment.dayId);
    const slot = data.slots.find((item) => item.id === appointment.slotId);
    const source = sourceName(data, appointment.sourceId);
    return <tr key={appointment.id} className={`${appointment.attention ? "attention-row" : ""} ${blacklistEntry ? "blacklisted-row" : ""}`} title={blacklistEntry?.reason || (appointment.attention ? appointment.attentionReason : undefined)}><td className="sticky-customer"><strong>{customer.name}</strong><span>{customer.gender}</span>{blacklistEntry && <div className="table-blacklist-detail"><i className="table-blacklisted-badge"><Ban /> Blacklisted</i><p>{blacklistEntry.reason}</p></div>}{appointment.attention && <div className="table-attention-detail"><i className="table-attention-badge"><TriangleAlert /> Attention</i><p>{appointment.attentionReason}</p></div>}</td><td><InlineEdit value={appointment.platformName} placeholder="Add platform name" label="Platform name" onCommit={(value) => onUpdate(appointment.id, { platformName: value })} /></td><td>{displayPhone(customer.normalizedPhone)}</td><td>{day ? formatDate(day.date) : "—"}</td><td><span className={`time-pill ${timeSlotTone(slot?.startTime)}`}>{slot?.label}</span></td><td><span className={`source-badge ${sourceBadgeTone(source)}`}>{source}</span></td><td><span className={`client-badge ${appointment.userType.toLowerCase()}`}>{appointment.userType}</span></td><td><InlineMoneyEdit value={appointment.purchaseAmount} onCommit={(value) => onUpdate(appointment.id, { purchaseAmount: value })} /></td><td><TableCheck checked={appointment.baristaRegistered} onClick={() => onToggle(appointment.id, "baristaRegistered")} /></td><td><TableCheck checked={appointment.attended} onClick={() => onToggle(appointment.id, "attended")} /></td><td><TableCheck checked={appointment.purchased} onClick={() => onToggle(appointment.id, "purchased")} /></td><td><TableCheck checked={appointment.reminderSent} onClick={() => onToggle(appointment.id, "reminderSent")} /></td><td><InlineEdit value={appointment.adsName} placeholder="Add ads name" label="Ads name" onCommit={(value) => onUpdate(appointment.id, { adsName: value })} /></td><td>{appointment.adsLink ? <a className="external-link" href={appointment.adsLink} target="_blank" rel="noreferrer">Open <ExternalLink /></a> : "—"}</td><td><InlineEdit value={appointment.remark} placeholder="Add remark" label="Remark" onCommit={(value) => onUpdate(appointment.id, { remark: value })} /></td><td><button className="table-edit" onClick={() => onEdit(appointment)} aria-label={`Edit ${customer.name}`}><PencilLine /></button></td></tr>;
  })}</tbody></table></div></section>;
}

function InlineMoneyEdit({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  return <label className="inline-money-edit"><span>RM</span><input
    key={value}
    type="number"
    min="0"
    step="0.01"
    defaultValue={value || ""}
    placeholder="0.00"
    aria-label="Purchase amount in RM"
    onBlur={(event) => {
      const next = Math.max(0, Number(event.currentTarget.value) || 0);
      event.currentTarget.value = next ? next.toFixed(2) : "";
      if (next !== value) onCommit(next);
    }}
    onKeyDown={(event) => {
      if (event.key === "Enter") event.currentTarget.blur();
      if (event.key === "Escape") {
        event.currentTarget.value = value ? value.toFixed(2) : "";
        event.currentTarget.blur();
      }
    }}
  /></label>;
}

function InlineEdit({ value, placeholder, label, onCommit }: { value: string; placeholder: string; label: string; onCommit: (value: string) => void }) {
  return <textarea
    key={value}
    className="inline-cell-input"
    defaultValue={value}
    placeholder={placeholder}
    aria-label={label}
    rows={2}
    onBlur={(event) => {
      const next = event.currentTarget.value.trim();
      if (next !== value) onCommit(next);
    }}
    onKeyDown={(event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.currentTarget.blur();
      }
      if (event.key === "Escape") {
        event.currentTarget.value = value;
        event.currentTarget.blur();
      }
    }}
  />;
}

function TableCheck({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return <button className={`table-check ${checked ? "checked" : ""}`} onClick={onClick} aria-label={checked ? "Checked" : "Unchecked"}>{checked && <Check />}</button>;
}
