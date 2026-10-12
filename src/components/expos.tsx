"use client";

import { useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format as calendarFormat, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, MoreHorizontal, PackageOpen, PencilLine, Plus, Trash2, X } from "lucide-react";
import type { AppData, Expo } from "@/lib/types";
import type { MorningSlotStart } from "@/lib/store";
import { expoStatus, formatDate } from "@/lib/utils";
import { PageHeader } from "./dashboard";

interface ExpoDraft extends Omit<Expo, "id"> { id?: string }

const emptyDraft: ExpoDraft = { name: "", location: "", startDate: "", endDate: "", openingTime: "10:00" };
const morningOptions: Array<{ value: MorningSlotStart; label: string }> = [
  { value: "10:00", label: "10AM – 1PM" },
  { value: "11:00", label: "11AM – 1PM" },
  { value: "12:00", label: "12PM – 3PM" },
];

export function Expos({ data, onSave, onApplyTemplate, onAddSlot, onDeleteSlot, onViewPackages }: { data: AppData; onSave: (expo: ExpoDraft, morningStart: MorningSlotStart) => void; onApplyTemplate: (expoId: string, morningStart: MorningSlotStart) => { ok: boolean; error?: string }; onAddSlot: (dayId: string, startTime: string, endTime: string) => { ok: boolean; error?: string }; onDeleteSlot: (id: string) => { ok: boolean; error?: string }; onViewPackages: (expoId: string) => void }) {
  const [draft, setDraft] = useState<ExpoDraft | null>(null);
  const [error, setError] = useState("");
  const [slotDayId, setSlotDayId] = useState("");
  const [slotStart, setSlotStart] = useState("10:00");
  const [slotEnd, setSlotEnd] = useState("12:00");
  const [templateStart, setTemplateStart] = useState<MorningSlotStart>("10:00");

  function edit(expo: Expo) {
    setDraft({ ...expo });
    setError("");
    const firstDayId = data.days.filter((day) => day.expoId === expo.id).sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id ?? "";
    const firstSlotStart = data.slots.filter((slot) => slot.dayId === firstDayId && slot.active).sort((a, b) => a.sortOrder - b.sortOrder)[0]?.startTime;
    setSlotDayId(firstDayId);
    setTemplateStart(morningOptions.some((option) => option.value === firstSlotStart) ? firstSlotStart as MorningSlotStart : "10:00");
  }

  function save() {
    if (!draft || !draft.name.trim() || !draft.location.trim() || !draft.startDate || !draft.endDate || draft.startDate > draft.endDate) return setError("Complete all fields and check the date range.");
    onSave(draft, templateStart);
    setDraft(null);
  }

  function applyTemplateToAllDays() {
    if (!draft?.id) return;
    const result = onApplyTemplate(draft.id, templateStart);
    if (!result.ok) return setError(result.error ?? "Unable to apply time slots to every date.");
    setError("");
  }

  function addSlot() {
    const result = onAddSlot(slotDayId, slotStart, slotEnd);
    if (!result.ok) return setError(result.error ?? "Unable to add time slot.");
    setError("");
  }

  function deleteSlot(id: string) {
    const result = onDeleteSlot(id);
    if (!result.ok) return setError(result.error ?? "Unable to delete time slot.");
    setError("");
  }

  return <>
    <PageHeader eyebrow="Event setup" title="Expos" subtitle="Create an expo once, then organise every day by clear appointment slots." actions={<button className="button primary" onClick={() => { setTemplateStart("10:00"); setError(""); setDraft({ ...emptyDraft }); }}><Plus /> New expo</button>} />
    <div className="expo-card-grid">{data.expos.map((expo) => {
      const status = expoStatus(expo);
      const dayList = data.days.filter((item) => item.expoId === expo.id);
      const appointments = data.appointments.filter((item) => item.expoId === expo.id && item.state === "Booked");
      const packageCount = data.packages.filter((item) => item.expoId === expo.id && item.active).length;
      const firstSlots = data.slots.filter((item) => item.dayId === dayList[0]?.id).sort((a,b) => a.sortOrder-b.sortOrder);
      return <article className="panel expo-card" key={expo.id}>
        <div className="expo-card-top"><div className="expo-icon"><CalendarDays /></div><span className={`status-badge ${status.toLowerCase()}`}>{status}</span><button className="icon-button subtle" aria-label="More"><MoreHorizontal /></button></div>
        <h2>{expo.name}</h2><p className="expo-location"><MapPin /> {expo.location}</p>
        <div className="expo-detail-row expo-detail-four"><div><span>Dates</span><strong>{formatDate(expo.startDate)} — {formatDate(expo.endDate)}</strong></div><div><span>Opening</span><strong>{expo.openingTime}</strong></div><div><span>RSVP</span><strong>{appointments.length}</strong></div><div><span>Packages</span><strong>{packageCount}</strong></div></div>
        <div className="slot-preview"><span><Clock3 /> Standard slots</span><div>{firstSlots.map((slot) => <i key={slot.id}>{slot.label}</i>)}</div></div>
        <div className="expo-card-actions"><button className="button secondary" onClick={() => onViewPackages(expo.id)}><PackageOpen /> View packages</button><button className="button secondary" onClick={() => edit(expo)}><PencilLine /> Edit expo</button></div>
      </article>;
    })}</div>

    {draft && <div className="modal-backdrop" onMouseDown={(e) => e.currentTarget === e.target && setDraft(null)}><div className="modal-card expo-modal"><div className="modal-head"><div><span className="eyebrow">Expo setup</span><h2>{draft.id ? "Edit expo" : "Create a new expo"}</h2><p>Dates automatically become tabs in the appointment schedule.</p></div><button className="icon-button" onClick={() => setDraft(null)}><X /></button></div><div className="modal-body form-grid">
      <label className="field wide"><span>Expo name</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="DRSMILE Experience • Location" /></label>
      <label className="field wide"><span>Location</span><input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></label>
      <div className="field"><span>Start date</span><ExpoDatePicker label="Start date" value={draft.startDate} max={draft.endDate || undefined} onChange={(value) => setDraft({ ...draft, startDate: value })} /></div>
      <div className="field"><span>End date</span><ExpoDatePicker label="End date" value={draft.endDate} min={draft.startDate || undefined} onChange={(value) => setDraft({ ...draft, endDate: value })} /></div>
      <label className="field"><span>Opening time</span><input type="time" value={draft.openingTime} onChange={(e) => setDraft({ ...draft, openingTime: e.target.value })} /></label>
      <SlotTemplatePicker selected={templateStart} onSelect={(value) => { setTemplateStart(value); if (!draft.id) setDraft({ ...draft, openingTime: value }); }} editing={Boolean(draft.id)} onApply={applyTemplateToAllDays} />
      {draft.id && <div className="slot-editor wide"><div className="slot-editor-head"><div><strong>Adjust one date only</strong><small>Use this only when a specific day has different hours.</small></div><select value={slotDayId} onChange={(event) => setSlotDayId(event.target.value)}>{data.days.filter((day) => day.expoId === draft.id).sort((a, b) => a.sortOrder - b.sortOrder).map((day) => <option key={day.id} value={day.id}>{formatDate(day.date, "long")}</option>)}</select></div><div className="slot-editor-list">{data.slots.filter((slot) => slot.dayId === slotDayId && slot.active).sort((a, b) => a.sortOrder - b.sortOrder).map((slot) => <div key={slot.id}><span><Clock3 /> <b>{slot.label}</b><small>{slot.startTime} – {slot.endTime}</small></span><button type="button" className="icon-button danger" onClick={() => deleteSlot(slot.id)} aria-label={`Delete ${slot.label}`}><Trash2 /></button></div>)}</div><div className="slot-add-row"><label><span>Start</span><input type="time" value={slotStart} onChange={(event) => setSlotStart(event.target.value)} /></label><label><span>End</span><input type="time" value={slotEnd} onChange={(event) => setSlotEnd(event.target.value)} /></label><button type="button" className="button secondary" onClick={addSlot}><Plus /> Add slot</button></div></div>}
      {error && <p className="form-error wide">{error}</p>}
    </div><div className="modal-footer"><button className="button ghost" onClick={() => setDraft(null)}>Cancel</button><button className="button primary" onClick={save}>{draft.id ? "Save changes" : "Create expo"}</button></div></div></div>}
  </>;
}

function ExpoDatePicker({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(value ? parseISO(value) : new Date()));
  const monthDays = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }) });

  function showCalendar() {
    setMonth(startOfMonth(value ? parseISO(value) : new Date()));
    setOpen((current) => !current);
  }

  function selectDate(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return <div className="expo-date-picker">
    <button type="button" className={`expo-date-trigger ${value ? "has-value" : ""}`} onClick={showCalendar} aria-haspopup="dialog" aria-expanded={open}>
      <CalendarDays /><strong>{value ? calendarFormat(parseISO(value), "d MMM yyyy") : "Choose a date"}</strong>
    </button>
    {open && <>
      <button type="button" className="date-picker-dismiss" aria-label="Close calendar" onClick={() => setOpen(false)} />
      <div className="expo-date-popover" role="dialog" aria-label={`Choose ${label.toLowerCase()}`}>
        <div className="date-picker-heading">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></button>
          <strong>{calendarFormat(month, "MMMM yyyy")}</strong>
          <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></button>
        </div>
        <div className="date-picker-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="date-picker-days">{monthDays.map((day) => {
          const nextValue = calendarFormat(day, "yyyy-MM-dd");
          const available = (!min || nextValue >= min) && (!max || nextValue <= max);
          return <button type="button" key={nextValue} disabled={!available} className={`${!isSameMonth(day, month) ? "outside" : ""} ${nextValue === value ? "selected" : ""}`} onClick={() => selectDate(nextValue)} aria-label={calendarFormat(day, "d MMMM yyyy")} aria-pressed={nextValue === value}>{calendarFormat(day, "d")}</button>;
        })}</div>
        <div className="expo-date-foot"><span>{label}</span><button type="button" onClick={() => setMonth(startOfMonth(new Date()))}>Today</button></div>
      </div>
    </>}
  </div>;
}

function SlotTemplatePicker({ selected, onSelect, editing, onApply }: { selected: MorningSlotStart; onSelect: (value: MorningSlotStart) => void; editing: boolean; onApply: () => void }) {
  const fixedSlots = selected === "12:00" ? ["3PM – 5PM", "5PM – 7PM", "7PM – 10PM"] : ["1PM – 3PM", "3PM – 5PM", "5PM – 7PM", "7PM – 10PM"];
  return <div className="slot-template wide">
    <div className="slot-template-heading"><div><strong>Time slots for all dates</strong><small>Choose the first slot. The remaining slots are added automatically.</small></div>{editing && <button type="button" className="button secondary" onClick={onApply}>Apply to all dates</button>}</div>
    <span>First time slot</span><div className="morning-slot-options">{morningOptions.map((option) => <button type="button" key={option.value} className={selected === option.value ? "active" : ""} onClick={() => onSelect(option.value)}>{option.label}</button>)}</div>
    <span>Automatically included</span><div className="fixed-slot-preview">{fixedSlots.map((slot) => <i key={slot}>{slot}</i>)}</div>
    <small>{editing ? "Apply once for every Expo date, then adjust an individual date below only if needed." : "These time slots will be created automatically for every date in this Expo."}</small>
  </div>;
}
