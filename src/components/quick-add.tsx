"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ChevronLeft, ClipboardPaste, Link2, ShieldAlert, Sparkles, X } from "lucide-react";
import type { AppData, Gender, UserType } from "@/lib/types";
import { detectAdsLink, parseSmartPaste } from "@/lib/parser";
import { getEligibility, type NewAppointmentInput } from "@/lib/store";
import { customerFor, displayPhone, formatDate, formatPhoneInput, normalizePhone } from "@/lib/utils";

interface Props {
  data: AppData;
  defaultExpoId: string;
  onClose: () => void;
  onCreate: (input: NewAppointmentInput) => { ok: boolean; error?: string };
  onAddSource: (name: string) => string;
}

const emptyForm: NewAppointmentInput = {
  name: "", gender: "Female", phone: "", expoId: "", dayId: "", slotId: "", concern: "", userType: "NEW",
  platformName: "", sourceId: "ig-ads", adsName: "", adsLink: "", paidStatus: "Paid RM1", paidNote: "", purchaseAmount: 0, remark: "",
};

const DRAFT_KEY = "drsmile-quick-add-draft-v1";
type SavedDraft = {
  step: "paste" | "review";
  raw: string;
  form: NewAppointmentInput;
  parsedConfidence: Record<string, string>;
  detectedTime: string;
};

function readDraft(): SavedDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(DRAFT_KEY);
    return value ? JSON.parse(value) as SavedDraft : null;
  } catch {
    return null;
  }
}

export function QuickAdd({ data, defaultExpoId, onClose, onCreate, onAddSource }: Props) {
  const expo = data.expos.find((item) => item.id === defaultExpoId) ?? data.expos[0];
  const firstDay = data.days.filter((item) => item.expoId === expo.id).sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const [savedDraft] = useState(readDraft);
  const [step, setStep] = useState<"paste" | "review">(savedDraft?.step ?? "paste");
  const [raw, setRaw] = useState(savedDraft?.raw ?? "1. 姓名：\n2. 性别：Female\n3. 电话号码：\n4. 日期：\n5. 时间：\n6. 想解决什么问题：\n7. 已经是DrSmile用户：否");
  const [form, setForm] = useState<NewAppointmentInput>(() => {
    if (savedDraft?.form && data.expos.some((item) => item.id === savedDraft.form.expoId)) return { ...emptyForm, ...savedDraft.form };
    return { ...emptyForm, expoId: expo.id, dayId: firstDay?.id ?? "", slotId: "" };
  });
  const [parsedConfidence, setParsedConfidence] = useState<Record<string, string>>(savedDraft?.parsedConfidence ?? {});
  const [detectedTime, setDetectedTime] = useState(savedDraft?.detectedTime ?? "");
  const [error, setError] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const eligibility = useMemo(() => getEligibility(data, form.phone), [data, form.phone]);
  const dayOptions = data.days.filter((item) => item.expoId === form.expoId).sort((a, b) => a.sortOrder - b.sortOrder);
  const slotOptions = data.slots.filter((item) => item.dayId === form.dayId && item.active).sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, raw, form, parsedConfidence, detectedTime } satisfies SavedDraft));
  }, [step, raw, form, parsedConfidence, detectedTime]);

  function discardAndClose() {
    window.sessionStorage.removeItem(DRAFT_KEY);
    onClose();
  }

  function parse() {
    const result = parseSmartPaste(raw, data.days.map((day) => day.date));
    const matchingDays = data.days.filter((day) => day.date === result.date.value);
    const matchingDay = matchingDays.length === 1
      ? matchingDays[0]
      : matchingDays.find((day) => day.expoId === form.expoId) ?? matchingDays[0];
    const parsedRange = parseTimeRange(result.time.value);
    const matchingSlot = data.slots.find((slot) => slot.dayId === matchingDay?.id && slot.active && (parsedRange ? slot.startTime === parsedRange.start && slot.endTime === parsedRange.end : slot.label.replace(/\s/g, "").toUpperCase() === result.time.value.replace(/\s/g, "").replace(/-/g, "–").toUpperCase()));
    setForm((current) => ({
      ...current,
      name: result.name.value || current.name,
      gender: (result.gender.value || current.gender) as Gender,
      phone: result.phone.value || current.phone,
      expoId: matchingDay?.expoId ?? current.expoId,
      dayId: matchingDay?.id ?? current.dayId,
      slotId: matchingSlot?.id ?? "",
      concern: result.concern.value || current.concern,
      userType: result.existingUser.value === null ? current.userType : result.existingUser.value ? "VIP" : "NEW",
    }));
    setParsedConfidence(Object.fromEntries(Object.entries(result).map(([key, value]) => [key, value.confidence])));
    setDetectedTime(result.time.value);
    setStep("review");
  }

  function updateAdsLink(value: string) {
    const suggestion = detectAdsLink(value);
    const source = data.sources.find((item) => item.name === suggestion.source);
    setForm({ ...form, adsLink: value, ...(source ? { sourceId: source.id } : {}) });
  }

  function selectSource(value: string) {
    if (value !== "__add__") return setForm({ ...form, sourceId: value });
    setAddingSource(true);
  }

  function addSource() {
    const name = newSourceName.trim();
    if (!name) return;
    const id = onAddSource(name);
    if (id) setForm({ ...form, sourceId: id });
    setNewSourceName("");
    setAddingSource(false);
  }

  function save() {
    setError("");
    if (!form.name.trim() || !normalizePhone(form.phone) || !form.dayId || !form.slotId) {
      setError("Name, valid phone, date and time slot are required.");
      return;
    }
    const result = onCreate(form);
    if (!result.ok) return setError(result.error ?? "Unable to save appointment.");
    window.sessionStorage.removeItem(DRAFT_KEY);
    onClose();
  }

  const history = eligibility.status === "first" ? [] : eligibility.history;

  return <div className="drawer-backdrop" onMouseDown={(e) => e.currentTarget === e.target && discardAndClose()}><aside className="drawer quick-add-drawer">
    <div className="drawer-head"><div><span className="eyebrow">Fast intake</span><h2>New appointment</h2><p>{step === "paste" ? "Paste the message exactly as you received it." : "Review the detected details before saving."}</p></div><button className="icon-button" onClick={discardAndClose} aria-label="Close"><X /></button></div>
    <div className="stepper"><span className="active"><i>1</i> Smart paste</span><b /><span className={step === "review" ? "active" : ""}><i>2</i> Review & save</span></div>

    {step === "paste" ? <>
      <div className="drawer-body paste-step">
        <div className="paste-intro"><div className="spark-icon"><Sparkles /></div><div><h3>Paste customer details</h3><p>Chinese, English and mixed formats are supported.</p></div></div>
        <textarea className="smart-paste-box" value={raw} onChange={(e) => setRaw(e.target.value)} autoFocus />
        <div className="privacy-note"><ShieldAlert size={16} /><span>This draft is kept only in this browser tab so it survives an accidental reload. It is cleared after Save or Cancel.</span></div>
      </div>
      <div className="drawer-footer"><button className="button ghost" onClick={discardAndClose}>Cancel</button><button className="button primary" onClick={parse}><ClipboardPaste size={17} /> Parse details <ArrowRight size={17} /></button></div>
    </> : <>
      <div className="drawer-body review-body">
        {eligibility.status !== "first" && <div className="eligibility-warning"><div className="warning-title"><AlertTriangle /><div><strong>{eligibility.label} — appointment blocked</strong><span>This phone number has existing history and cannot register again.</span></div></div>
          {eligibility.status === "blacklisted" && <p className="blacklist-reason"><b>Blacklist reason:</b> {eligibility.entry.reason}</p>}
          {history.map((appointment) => {
            const customer = customerFor(data, appointment);
            const day = data.days.find((item) => item.id === appointment.dayId);
            const slot = data.slots.find((item) => item.id === appointment.slotId);
            const previousExpo = data.expos.find((item) => item.id === appointment.expoId);
            return <div className="history-card" key={appointment.id}><div><span>Previous record</span><strong>{previousExpo?.name}</strong></div><dl><div><dt>Customer</dt><dd>{customer?.name}</dd></div><div><dt>Date</dt><dd>{day ? formatDate(day.date) : "—"} · {slot?.label}</dd></div><div><dt>Status</dt><dd>{appointment.attended ? "Redeemed" : "Registered"}{appointment.purchased ? " · Purchased" : ""}</dd></div><div><dt>Remark</dt><dd>{appointment.remark || "—"}</dd></div></dl></div>;
          })}
        </div>}
        {eligibility.status === "first" && normalizePhone(form.phone) && <div className="eligibility-ok"><Check /> <div><strong>First appointment</strong><span>No registration or blacklist history found for {displayPhone(normalizePhone(form.phone))}.</span></div></div>}

        <section className="form-section"><div className="section-label"><span>01</span><div><h3>Customer</h3><p>Detected from the pasted message</p></div></div><div className="form-grid">
          <Field label="Customer name" confidence={parsedConfidence.name}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Platform name"><input value={form.platformName} onChange={(e) => setForm({ ...form, platformName: e.target.value })} placeholder="FB / IG / WA username" /></Field>
          <Field label="Gender" confidence={parsedConfidence.gender}><select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}><option>Female</option><option>Male</option><option>Other</option></select></Field>
          <Field label="Phone number" confidence={parsedConfidence.phone}><input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} onBlur={(e) => setForm((current) => ({ ...current, phone: formatPhoneInput(e.target.value) }))} /></Field>
          <Field label="User" confidence={parsedConfidence.existingUser}><select value={form.userType} onChange={(e) => setForm({ ...form, userType: e.target.value as UserType })}><option value="NEW">NEW</option><option value="VIP">VIP</option></select></Field>
          <Field label="Problem / concern" confidence={parsedConfidence.concern} wide><input value={form.concern} onChange={(e) => setForm({ ...form, concern: e.target.value })} /></Field>
        </div></section>

        <section className="form-section"><div className="section-label"><span>02</span><div><h3>Appointment</h3><p>Detected automatically, or select manually if needed</p></div></div><div className="form-grid">
          <Field label="Expo" wide><select value={form.expoId} onChange={(e) => { const newDays = data.days.filter((day) => day.expoId === e.target.value).sort((a,b) => a.sortOrder-b.sortOrder); const nextDay = newDays[0]; setForm({ ...form, expoId: e.target.value, dayId: nextDay?.id ?? "", slotId: "" }); }}>{data.expos.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="Appointment date" confidence={parsedConfidence.date}><select value={form.dayId} onChange={(e) => { const currentLabel = data.slots.find((slot) => slot.id === form.slotId)?.label; const nextSlot = data.slots.find((slot) => slot.dayId === e.target.value && slot.label === currentLabel); setForm({ ...form, dayId: e.target.value, slotId: nextSlot?.id ?? "" }); }}>{dayOptions.map((day) => <option key={day.id} value={day.id}>{formatDate(day.date, "long")}</option>)}</select></Field>
          <Field label="Time slot" confidence={parsedConfidence.time}>{form.slotId
            ? <div className="detected-value success">{slotOptions.find((slot) => slot.id === form.slotId)?.label}</div>
            : <><select value="" onChange={(e) => setForm({ ...form, slotId: e.target.value })}><option value="" disabled>{detectedTime ? `Detected ${detectedTime} — select an available slot` : "Not detected — select manually"}</option>{slotOptions.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}</select>{detectedTime && <small>No exact slot exists for this date. Add it under Expos, or select another slot.</small>}</>}
          </Field>
        </div></section>

        <section className="form-section"><div className="section-label"><span>03</span><div><h3>Source & payment</h3><p>Confirm marketing attribution</p></div></div><div className="form-grid">
          <Field label="Source" wide><select value={form.sourceId} onChange={(e) => selectSource(e.target.value)}>{data.sources.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="__add__">＋ Add new source…</option></select>{addingSource && <div className="inline-add"><input autoFocus value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(); } if (e.key === "Escape") setAddingSource(false); }} placeholder="Enter new source name" /><button type="button" className="button primary" onClick={addSource} disabled={!newSourceName.trim()}><Check size={14} /> Add</button><button type="button" className="icon-button" onClick={() => { setAddingSource(false); setNewSourceName(""); }} aria-label="Cancel adding source"><X size={14} /></button></div>}</Field>
          <Field label="Ads name"><input value={form.adsName} onChange={(e) => setForm({ ...form, adsName: e.target.value })} placeholder="Campaign or creative name" /></Field>
          <Field label="Ads / post link"><div className="input-with-icon"><Link2 /><input value={form.adsLink} onChange={(e) => updateAdsLink(e.target.value)} placeholder="https://..." /></div></Field>
          <Field label="Remark" wide><textarea value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></Field>
        </div></section>
        {error && <div className="form-error"><AlertTriangle />{error}</div>}
      </div>
      <div className="drawer-footer"><button className="button ghost" onClick={() => setStep("paste")}><ChevronLeft size={17} /> Back to paste</button><button className="button primary" disabled={eligibility.status !== "first"} onClick={save}><Check size={17} /> Save appointment</button></div>
    </>}
  </aside></div>;
}

function parseTimeRange(value: string) {
  const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!match) return null;
  const [, startHourRaw, startMinute = "00", startMeridiemRaw, endHourRaw, endMinute = "00", endMeridiemRaw] = match;
  const endMeridiem = endMeridiemRaw.toUpperCase();
  const startMeridiem = (startMeridiemRaw || (endMeridiem === "PM" && Number(startHourRaw) > Number(endHourRaw) ? "AM" : endMeridiem)).toUpperCase();
  const to24 = (hourRaw: string, minute: string, meridiem: string) => {
    let hour = Number(hourRaw) % 12;
    if (meridiem === "PM") hour += 12;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  };
  return { start: to24(startHourRaw, startMinute, startMeridiem), end: to24(endHourRaw, endMinute, endMeridiem) };
}

function Field({ label, confidence, wide, children }: { label: string; confidence?: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}{confidence && <i className={`confidence ${confidence}`}>{confidence}</i>}</span>{children}</label>;
}
