"use client";

import { useState } from "react";
import { CalendarDays, Clock3, MapPin, MoreHorizontal, PencilLine, Plus, Trash2, X } from "lucide-react";
import type { AppData, Expo } from "@/lib/types";
import { expoStatus, formatDate } from "@/lib/utils";
import { PageHeader } from "./dashboard";

interface ExpoDraft extends Omit<Expo, "id"> { id?: string }

const emptyDraft: ExpoDraft = { name: "", location: "", startDate: "", endDate: "", openingTime: "10:00" };
const standardSlots = ["10AM – 1PM", "1PM – 3PM", "3PM – 5PM", "5PM – 7PM", "7PM – 10PM"];

export function Expos({ data, onSave, onAddSlot, onDeleteSlot }: { data: AppData; onSave: (expo: ExpoDraft) => void; onAddSlot: (dayId: string, startTime: string, endTime: string) => { ok: boolean; error?: string }; onDeleteSlot: (id: string) => { ok: boolean; error?: string } }) {
  const [draft, setDraft] = useState<ExpoDraft | null>(null);
  const [error, setError] = useState("");
  const [slotDayId, setSlotDayId] = useState("");
  const [slotStart, setSlotStart] = useState("10:00");
  const [slotEnd, setSlotEnd] = useState("12:00");

  function edit(expo: Expo) {
    setDraft({ ...expo });
    setError("");
    setSlotDayId(data.days.filter((day) => day.expoId === expo.id).sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id ?? "");
  }

  function save() {
    if (!draft || !draft.name.trim() || !draft.location.trim() || !draft.startDate || !draft.endDate || draft.startDate > draft.endDate) return setError("Complete all fields and check the date range.");
    onSave(draft);
    setDraft(null);
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
    <PageHeader eyebrow="Event setup" title="Expos" subtitle="Create an expo once, then organise every day by clear appointment slots." actions={<button className="button primary" onClick={() => setDraft({ ...emptyDraft })}><Plus /> New expo</button>} />
    <div className="expo-card-grid">{data.expos.map((expo) => {
      const status = expoStatus(expo);
      const dayList = data.days.filter((item) => item.expoId === expo.id);
      const appointments = data.appointments.filter((item) => item.expoId === expo.id && item.state === "Booked");
      const firstSlots = data.slots.filter((item) => item.dayId === dayList[0]?.id).sort((a,b) => a.sortOrder-b.sortOrder);
      return <article className="panel expo-card" key={expo.id}>
        <div className="expo-card-top"><div className="expo-icon"><CalendarDays /></div><span className={`status-badge ${status.toLowerCase()}`}>{status}</span><button className="icon-button subtle" aria-label="More"><MoreHorizontal /></button></div>
        <h2>{expo.name}</h2><p className="expo-location"><MapPin /> {expo.location}</p>
        <div className="expo-detail-row"><div><span>Dates</span><strong>{formatDate(expo.startDate)} — {formatDate(expo.endDate)}</strong></div><div><span>Opening</span><strong>{expo.openingTime}</strong></div><div><span>RSVP</span><strong>{appointments.length}</strong></div></div>
        <div className="slot-preview"><span><Clock3 /> Standard slots</span><div>{firstSlots.map((slot) => <i key={slot.id}>{slot.label}</i>)}</div></div>
        <button className="button secondary full-button" onClick={() => edit(expo)}><PencilLine /> Edit expo</button>
      </article>;
    })}</div>

    {draft && <div className="modal-backdrop" onMouseDown={(e) => e.currentTarget === e.target && setDraft(null)}><div className="modal-card expo-modal"><div className="modal-head"><div><span className="eyebrow">Expo setup</span><h2>{draft.id ? "Edit expo" : "Create a new expo"}</h2><p>Dates automatically become tabs in the appointment schedule.</p></div><button className="icon-button" onClick={() => setDraft(null)}><X /></button></div><div className="modal-body form-grid">
      <label className="field wide"><span>Expo name</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="DRSMILE Experience • Location" /></label>
      <label className="field wide"><span>Location</span><input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></label>
      <label className="field"><span>Start date</span><input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></label>
      <label className="field"><span>End date</span><input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></label>
      <label className="field"><span>Opening time</span><input type="time" value={draft.openingTime} onChange={(e) => setDraft({ ...draft, openingTime: e.target.value })} /></label>
      {!draft.id && <div className="fixed-slots wide"><span>Starting time slots</span><div>{standardSlots.map((slot) => <i key={slot}>{slot}</i>)}</div><small>Create the Expo first, then edit it to add or delete slots for each date.</small></div>}
      {draft.id && <div className="slot-editor wide"><div className="slot-editor-head"><div><strong>Time slots by date</strong><small>Add different opening slots for each Expo day.</small></div><select value={slotDayId} onChange={(event) => setSlotDayId(event.target.value)}>{data.days.filter((day) => day.expoId === draft.id).sort((a, b) => a.sortOrder - b.sortOrder).map((day) => <option key={day.id} value={day.id}>{formatDate(day.date, "long")}</option>)}</select></div><div className="slot-editor-list">{data.slots.filter((slot) => slot.dayId === slotDayId && slot.active).sort((a, b) => a.sortOrder - b.sortOrder).map((slot) => <div key={slot.id}><span><Clock3 /> <b>{slot.label}</b><small>{slot.startTime} – {slot.endTime}</small></span><button type="button" className="icon-button danger" onClick={() => deleteSlot(slot.id)} aria-label={`Delete ${slot.label}`}><Trash2 /></button></div>)}</div><div className="slot-add-row"><label><span>Start</span><input type="time" value={slotStart} onChange={(event) => setSlotStart(event.target.value)} /></label><label><span>End</span><input type="time" value={slotEnd} onChange={(event) => setSlotEnd(event.target.value)} /></label><button type="button" className="button secondary" onClick={addSlot}><Plus /> Add slot</button></div></div>}
      {error && <p className="form-error wide">{error}</p>}
    </div><div className="modal-footer"><button className="button ghost" onClick={() => setDraft(null)}>Cancel</button><button className="button primary" onClick={save}>{draft.id ? "Save changes" : "Create expo"}</button></div></div></div>}
  </>;
}
