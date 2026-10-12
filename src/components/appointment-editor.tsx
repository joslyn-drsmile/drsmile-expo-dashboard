"use client";

import { useMemo, useState } from "react";
import { Ban, Check, RotateCcw, ShieldAlert, Trash2, TriangleAlert, X } from "lucide-react";
import type { AppData, Appointment, BlacklistEntry, Gender, UserType } from "@/lib/types";
import type { NewAppointmentInput } from "@/lib/store";
import { customerFor, displayPhone, formatDate, formatPhoneInput, normalizePhone } from "@/lib/utils";

type BlacklistDraft = Omit<BlacklistEntry, "id" | "normalizedPhone" | "active">;

interface Props {
  data: AppData;
  appointment: Appointment;
  onClose: () => void;
  onSave: (id: string, input: NewAppointmentInput) => { ok: boolean; error?: string };
  onDelete: (id: string) => void;
  onAddBlacklist: (entry: BlacklistDraft) => { ok: boolean; error?: string };
  onReactivateBlacklist: (id: string) => void;
  onSetAttention: (id: string, attention: boolean, reason: string) => void;
}

const attentionPresets = ["Freebie risk", "High maintenance", "Bringing family", "Needs extra care"];

function parseAttentionReason(reason: string) {
  const lines = reason.split("\n").map((line) => line.trim()).filter(Boolean);
  return {
    selected: lines.filter((line) => attentionPresets.includes(line)),
    note: lines.filter((line) => !attentionPresets.includes(line)).join("\n"),
  };
}

export function AppointmentEditor({ data, appointment, onClose, onSave, onDelete, onAddBlacklist, onReactivateBlacklist, onSetAttention }: Props) {
  const customer = customerFor(data, appointment)!;
  const [form, setForm] = useState<NewAppointmentInput>({
    name: customer.name, gender: customer.gender, phone: displayPhone(customer.normalizedPhone),
    expoId: appointment.expoId, dayId: appointment.dayId, slotId: appointment.slotId,
    concern: appointment.concern, userType: appointment.userType, platformName: appointment.platformName,
    sourceId: appointment.sourceId, adsName: appointment.adsName, adsLink: appointment.adsLink,
    paidStatus: appointment.paidStatus, paidNote: appointment.paidNote, purchaseAmount: appointment.purchaseAmount, remark: appointment.remark,
  });
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState("");
  const [blacklistRemark, setBlacklistRemark] = useState("");
  const [blacklistMessage, setBlacklistMessage] = useState("");
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [attentionFlagged, setAttentionFlagged] = useState(Boolean(appointment.attention));
  const initialAttention = parseAttentionReason(appointment.attentionReason ?? "");
  const [attentionReasons, setAttentionReasons] = useState<string[]>(initialAttention.selected);
  const [attentionNote, setAttentionNote] = useState(initialAttention.note);
  const [attentionMessage, setAttentionMessage] = useState("");
  const days = useMemo(() => data.days.filter((day) => day.expoId === form.expoId).sort((a, b) => a.sortOrder - b.sortOrder), [data.days, form.expoId]);
  const slots = useMemo(() => data.slots.filter((slot) => slot.dayId === form.dayId && slot.active).sort((a, b) => a.sortOrder - b.sortOrder), [data.slots, form.dayId]);
  const normalizedFormPhone = normalizePhone(form.phone);
  const blacklistEntry = data.blacklist.find((entry) => entry.normalizedPhone === normalizedFormPhone);

  function save() {
    if (!form.name.trim() || !form.phone.trim() || !form.dayId || !form.slotId) return setError("Customer name, phone, date and time slot are required.");
    const result = onSave(appointment.id, form);
    if (!result.ok) return setError(result.error ?? "Unable to save changes.");
    onClose();
  }

  function confirmBlacklist() {
    setBlacklistMessage("");
    if (blacklistEntry && !blacklistEntry.active) {
      onReactivateBlacklist(blacklistEntry.id);
      setBlacklistOpen(false);
      setBlacklistMessage("Customer blacklist has been reactivated.");
      return;
    }
    if (!blacklistReason.trim()) return setBlacklistMessage("Please enter a reason before adding this customer to the blacklist.");
    const result = onAddBlacklist({
      customerName: form.name.trim(), originalPhone: form.phone, reason: blacklistReason.trim(),
      dateAdded: new Date().toISOString().slice(0, 10), relatedExpoId: form.expoId, remark: blacklistRemark.trim(),
    });
    if (!result.ok) return setBlacklistMessage(result.error ?? "Unable to add this customer to the blacklist.");
    setBlacklistOpen(false);
    setBlacklistMessage("Customer has been added to the blacklist.");
  }

  function confirmAttention() {
    const reason = [...attentionReasons, attentionNote.trim()].filter(Boolean).join("\n");
    if (!reason) return setAttentionMessage("Select or enter a reason before marking this customer for attention.");
    onSetAttention(appointment.id, true, reason);
    setAttentionFlagged(true);
    setAttentionOpen(false);
    setAttentionMessage("Attention flag saved for your team.");
  }

  function removeAttention() {
    onSetAttention(appointment.id, false, "");
    setAttentionFlagged(false);
    setAttentionReasons([]);
    setAttentionNote("");
    setAttentionOpen(false);
    setAttentionMessage("Attention flag removed.");
  }

  return <div className="drawer-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><aside className="drawer quick-add-drawer">
    <div className="drawer-head"><div><span className="eyebrow">Appointment record</span><h2>Edit appointment</h2><p>Update customer, schedule, source and payment details.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
    <div className="drawer-body review-body">
      <section className="form-section"><div className="section-label"><span>01</span><div><h3>Customer</h3><p>Name, contact and profile</p></div></div><div className="form-grid">
        <Field label="Customer name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Platform name"><input value={form.platformName} onChange={(event) => setForm({ ...form, platformName: event.target.value })} placeholder="FB / IG / WA username" /></Field>
        <Field label="Gender"><select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as Gender })}><option>Female</option><option>Male</option><option>Other</option></select></Field>
        <Field label="Phone number"><input inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} onBlur={(event) => setForm((current) => ({ ...current, phone: formatPhoneInput(event.target.value) }))} /></Field>
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
        <Field label="Purchase amount (RM)"><input type="number" min="0" step="0.01" value={form.purchaseAmount || ""} placeholder="0.00" onChange={(event) => setForm({ ...form, purchaseAmount: Math.max(0, Number(event.target.value)) })} /><small>Any amount above RM0 automatically marks Purchased and Attended.</small></Field>
        <Field label="Remark" wide><textarea value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} /></Field>
      </div></section>
      {error && <div className="form-error">{error}</div>}
      {blacklistMessage && !blacklistOpen && <div className="editor-blacklist-success"><Check /> {blacklistMessage}</div>}
      {attentionMessage && !attentionOpen && <div className="editor-attention-success"><TriangleAlert /> {attentionMessage}</div>}
    </div>
    {blacklistOpen && <div className="editor-blacklist-panel">
      <div className="editor-blacklist-heading"><span><ShieldAlert /></span><div><strong>{blacklistEntry && !blacklistEntry.active ? "Reactivate blacklist" : "Add customer to blacklist?"}</strong><p>{blacklistEntry && !blacklistEntry.active ? `This phone was previously blocked for: ${blacklistEntry.reason}` : `${form.name || "This customer"} will be blocked from creating another appointment with ${formatPhoneInput(form.phone)}.`}</p></div><button className="icon-button" onClick={() => { setBlacklistOpen(false); setBlacklistMessage(""); }} aria-label="Close blacklist confirmation"><X /></button></div>
      {!(blacklistEntry && !blacklistEntry.active) && <div className="editor-blacklist-fields"><label><span>Reason</span><input autoFocus value={blacklistReason} onChange={(event) => setBlacklistReason(event.target.value)} placeholder="Why is this customer being blocked?" /></label><label><span>Remark <i>Optional</i></span><input value={blacklistRemark} onChange={(event) => setBlacklistRemark(event.target.value)} placeholder="Additional internal note" /></label></div>}
      {blacklistMessage && <p className="editor-blacklist-error">{blacklistMessage}</p>}
      <div className="editor-blacklist-actions"><button className="button ghost" onClick={() => { setBlacklistOpen(false); setBlacklistMessage(""); }}>Cancel</button><button className="button danger-button" onClick={confirmBlacklist}>{blacklistEntry && !blacklistEntry.active ? <><RotateCcw /> Reactivate blacklist</> : <><Ban /> Add to blacklist</>}</button></div>
    </div>}
    {attentionOpen && <div className="editor-attention-panel">
      <div className="editor-blacklist-heading"><span className="attention-icon"><TriangleAlert /></span><div><strong>{attentionFlagged ? "Edit attention alert" : "Flag customer for attention?"}</strong><p>This is an internal warning only. It will not block the appointment.</p></div><button className="icon-button" onClick={() => { setAttentionOpen(false); setAttentionMessage(""); }} aria-label="Close attention form"><X /></button></div>
      <div className="attention-presets" role="group" aria-label="Attention reasons">{attentionPresets.map((preset) => {
        const selected = attentionReasons.includes(preset);
        return <button type="button" key={preset} className={selected ? "active" : ""} aria-pressed={selected} onClick={() => setAttentionReasons((current) => selected ? current.filter((reason) => reason !== preset) : [...current, preset])}>{selected && <Check />} {preset}</button>;
      })}</div>
      <p className="attention-presets-help">Choose one or more reasons.</p>
      <label className="attention-note-field"><span>Additional note <i>Optional</i></span><textarea value={attentionNote} onChange={(event) => setAttentionNote(event.target.value)} placeholder="Add any detail your teammates should know." /></label>
      {attentionMessage && <p className="editor-attention-error">{attentionMessage}</p>}
      <div className="editor-blacklist-actions">{attentionFlagged && <button className="button ghost attention-remove" onClick={removeAttention}>Remove attention</button>}<button className="button ghost" onClick={() => { setAttentionOpen(false); setAttentionMessage(""); }}>Cancel</button><button className="button attention-confirm" onClick={confirmAttention}><TriangleAlert /> Save attention</button></div>
    </div>}
    <div className="drawer-footer appointment-editor-footer"><div className="editor-record-actions"><button className={`button ${confirmDelete ? "danger-button" : "ghost"}`} onClick={() => { if (!confirmDelete) return setConfirmDelete(true); onDelete(appointment.id); onClose(); }}><Trash2 size={17} /> {confirmDelete ? "Confirm delete" : "Delete appointment"}</button><button className={`button ${blacklistEntry?.active ? "blacklist-active-button" : "secondary blacklist-button"}`} disabled={blacklistEntry?.active} onClick={() => { setConfirmDelete(false); setAttentionOpen(false); setBlacklistMessage(""); setBlacklistOpen(true); }}><Ban /> {blacklistEntry?.active ? "Blacklisted" : "Blacklist customer"}</button><button className={`button ${attentionFlagged ? "attention-active-button" : "secondary attention-button"}`} onClick={() => { setConfirmDelete(false); setBlacklistOpen(false); setAttentionMessage(""); setAttentionOpen(true); }}><TriangleAlert /> {attentionFlagged ? "Attention flagged" : "Attention"}</button></div><div className="editor-save-actions"><button className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" onClick={save}><Check size={17} /> Save changes</button></div></div>
  </aside></div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>;
}
