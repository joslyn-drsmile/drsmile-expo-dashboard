"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import type { AppData, Appointment, Gender, UserType } from "@/lib/types";
import type { NewAppointmentInput } from "@/lib/store";
import { customerFor, formatDate } from "@/lib/utils";

interface Props {
  data: AppData;
  appointment: Appointment;
  onClose: () => void;
  onSave: (id: string, input: NewAppointmentInput) => { ok: boolean; error?: string };
}

export function AppointmentEditor({ data, appointment, onClose, onSave }: Props) {
  const customer = customerFor(data, appointment)!;
  const [form, setForm] = useState<NewAppointmentInput>({
    name: customer.name, gender: customer.gender, phone: customer.originalPhone,
    expoId: appointment.expoId, dayId: appointment.dayId, slotId: appointment.slotId,
    concern: appointment.concern, userType: appointment.userType, platformName: appointment.platformName,
    sourceId: appointment.sourceId, adsName: appointment.adsName, adsLink: appointment.adsLink,
    paidStatus: appointment.paidStatus, paidNote: appointment.paidNote, remark: appointment.remark,
  });
  const [error, setError] = useState("");
  const days = useMemo(() => data.days.filter((day) => day.expoId === form.expoId).sort((a, b) => a.sortOrder - b.sortOrder), [data.days, form.expoId]);
  const slots = useMemo(() => data.slots.filter((slot) => slot.dayId === form.dayId && slot.active).sort((a, b) => a.sortOrder - b.sortOrder), [data.slots, form.dayId]);

  function save() {
    if (!form.name.trim() || !form.phone.trim() || !form.dayId || !form.slotId) return setError("Customer name, phone, date and time slot are required.");
    if (form.paidStatus === "Other" && !form.paidNote.trim()) return setError("Add a payment note for Other.");
    const result = onSave(appointment.id, form);
    if (!result.ok) return setError(result.error ?? "Unable to save changes.");
    onClose();
  }

  return <div className="drawer-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><aside className="drawer quick-add-drawer">
    <div className="drawer-head"><div><span className="eyebrow">Appointment record</span><h2>Edit appointment</h2><p>Update customer, schedule, source and payment details.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
    <div className="drawer-body review-body">
      <section className="form-section"><div className="section-label"><span>01</span><div><h3>Customer</h3><p>Name, contact and profile</p></div></div><div className="form-grid">
        <Field label="Customer name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Platform name"><input value={form.platformName} onChange={(event) => setForm({ ...form, platformName: event.target.value })} placeholder="FB / IG / WA username" /></Field>
        <Field label="Gender"><select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as Gender })}><option>Female</option><option>Male</option><option>Other</option></select></Field>
        <Field label="Phone number"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
        <Field label="User"><select value={form.userType} onChange={(event) => setForm({ ...form, userType: event.target.value as UserType })}><option>NEW</option><option>VIP</option></select></Field>
        <Field label="Problem / concern"><input value={form.concern} onChange={(event) => setForm({ ...form, concern: event.target.value })} /></Field>
      </div></section>
      <section className="form-section"><div className="section-label"><span>02</span><div><h3>Appointment</h3><p>Expo, date and time</p></div></div><div className="form-grid">
        <Field label="Expo" wide><select value={form.expoId} onChange={(event) => { const expoId = event.target.value; const nextDay = data.days.filter((day) => day.expoId === expoId).sort((a, b) => a.sortOrder - b.sortOrder)[0]; const nextSlot = data.slots.filter((slot) => slot.dayId === nextDay?.id && slot.active).sort((a, b) => a.sortOrder - b.sortOrder)[0]; setForm({ ...form, expoId, dayId: nextDay?.id ?? "", slotId: nextSlot?.id ?? "" }); }}>{data.expos.map((expo) => <option key={expo.id} value={expo.id}>{expo.name}</option>)}</select></Field>
        <Field label="Appointment date"><select value={form.dayId} onChange={(event) => { const dayId = event.target.value; const nextSlot = data.slots.filter((slot) => slot.dayId === dayId && slot.active).sort((a, b) => a.sortOrder - b.sortOrder)[0]; setForm({ ...form, dayId, slotId: nextSlot?.id ?? "" }); }}>{days.map((day) => <option key={day.id} value={day.id}>{formatDate(day.date, "long")}</option>)}</select></Field>
        <Field label="Time slot"><select value={form.slotId} onChange={(event) => setForm({ ...form, slotId: event.target.value })}>{slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}</select></Field>
      </div></section>
      <section className="form-section"><div className="section-label"><span>03</span><div><h3>Source & payment</h3><p>Marketing and internal notes</p></div></div><div className="form-grid">
        <Field label="Source" wide><select value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value })}>{data.sources.filter((source) => source.active).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></Field>
        <Field label="Ads name"><input value={form.adsName} onChange={(event) => setForm({ ...form, adsName: event.target.value })} /></Field>
        <Field label="Ads link"><input value={form.adsLink} onChange={(event) => setForm({ ...form, adsLink: event.target.value })} /></Field>
        <Field label="Paid status"><select value={form.paidStatus} onChange={(event) => setForm({ ...form, paidStatus: event.target.value as Appointment["paidStatus"] })}><option>Paid RM1</option><option>Unpaid</option><option>Other</option></select></Field>
        {form.paidStatus === "Other" && <Field label="Payment note"><input value={form.paidNote} onChange={(event) => setForm({ ...form, paidNote: event.target.value })} /></Field>}
        <Field label="Remark" wide><textarea value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} /></Field>
      </div></section>
      {error && <div className="form-error">{error}</div>}
    </div>
    <div className="drawer-footer"><button className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" onClick={save}><Check size={17} /> Save changes</button></div>
  </aside></div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>;
}
