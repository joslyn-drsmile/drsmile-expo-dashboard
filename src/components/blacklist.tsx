"use client";

import { useMemo, useState } from "react";
import { Ban, CalendarDays, Phone, Plus, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
import type { AppData, BlacklistEntry } from "@/lib/types";
import { displayPhone, formatDate, formatPhoneInput } from "@/lib/utils";
import { PageHeader } from "./dashboard";

type Draft = Omit<BlacklistEntry, "id" | "normalizedPhone" | "active">;
const emptyDraft: Draft = { customerName: "", originalPhone: "", reason: "", dateAdded: new Date().toISOString().slice(0, 10), relatedExpoId: "", remark: "" };

export function Blacklist({ data, onAdd, onToggle }: { data: AppData; onAdd: (entry: Draft) => { ok: boolean; error?: string }; onToggle: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const rows = useMemo(() => data.blacklist.filter((item) => (showInactive || item.active) && [item.customerName, item.normalizedPhone, item.reason].some((value) => value.toLowerCase().includes(search.toLowerCase()))), [data.blacklist, showInactive, search]);

  function save() {
    if (!draft || !draft.customerName.trim() || !draft.reason.trim()) return setError("Name, phone and reason are required.");
    const result = onAdd(draft);
    if (!result.ok) return setError(result.error ?? "Unable to add blacklist entry.");
    setDraft(null);
  }

  return <>
    <PageHeader eyebrow="Eligibility control" title="Blacklist" subtitle="Prevent repeat freebie claims and make the reason visible at intake." actions={<button className="button danger-button" onClick={() => setDraft({ ...emptyDraft, relatedExpoId: data.expos[0]?.id ?? "" })}><Plus /> Add to blacklist</button>} />
    <section className="blacklist-summary"><article><div className="summary-icon red"><ShieldAlert /></div><div><strong>{data.blacklist.filter((item) => item.active).length}</strong><span>Active blocks</span></div></article><article><div className="summary-icon green"><ShieldCheck /></div><div><strong>{data.blacklist.filter((item) => !item.active).length}</strong><span>Deactivated</span></div></article><p><Ban /> A matching phone number is blocked before an appointment can be saved.</p></section>
    <section className="panel blacklist-panel"><div className="blacklist-toolbar"><div className="search-box"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or reason" /></div><label className="switch-label"><button className={`switch ${showInactive ? "on" : ""}`} onClick={() => setShowInactive(!showInactive)}><i /></button> Show inactive</label></div><div className="blacklist-list">{rows.map((entry) => {
      const expo = data.expos.find((item) => item.id === entry.relatedExpoId);
      return <article key={entry.id} className={!entry.active ? "inactive" : ""}><div className="blacklist-person"><div className="avatar alert-avatar">{entry.customerName.split(" ").map((part) => part[0]).slice(0,2).join("")}</div><div><strong>{entry.customerName}</strong><span><Phone /> {displayPhone(entry.normalizedPhone)}</span></div></div><div><span>Reason</span><strong>{entry.reason}</strong><small>{entry.remark || "No additional remark"}</small></div><div><span>Related expo</span><strong>{expo?.name ?? "—"}</strong><small><CalendarDays /> Added {formatDate(entry.dateAdded)}</small></div><div className="blacklist-status"><span className={`status-badge ${entry.active ? "blocked" : "inactive"}`}>{entry.active ? "Blocked" : "Inactive"}</span><button className="button secondary" onClick={() => onToggle(entry.id)}>{entry.active ? "Deactivate" : "Reactivate"}</button></div></article>;
    })}{!rows.length && <div className="empty-state"><ShieldCheck /><h3>No matching blacklist records</h3><p>Try another search or include inactive entries.</p></div>}</div></section>

    {draft && <div className="modal-backdrop" onMouseDown={(e) => e.currentTarget === e.target && setDraft(null)}><div className="modal-card blacklist-modal"><div className="modal-head"><div><span className="eyebrow">Eligibility control</span><h2>Add to blacklist</h2><p>This phone will be blocked during appointment intake.</p></div><button className="icon-button" onClick={() => setDraft(null)}><X /></button></div><div className="modal-body form-grid">
      <label className="field"><span>Customer name</span><input value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} /></label><label className="field"><span>Phone number</span><input inputMode="tel" value={draft.originalPhone} onChange={(e) => setDraft({ ...draft, originalPhone: e.target.value })} onBlur={(e) => setDraft((current) => current ? { ...current, originalPhone: formatPhoneInput(e.target.value) } : current)} /></label><label className="field wide"><span>Reason</span><input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></label><label className="field"><span>Date added</span><input type="date" value={draft.dateAdded} onChange={(e) => setDraft({ ...draft, dateAdded: e.target.value })} /></label><label className="field"><span>Related expo</span><select value={draft.relatedExpoId} onChange={(e) => setDraft({ ...draft, relatedExpoId: e.target.value })}>{data.expos.map((expo) => <option key={expo.id} value={expo.id}>{expo.name}</option>)}</select></label><label className="field wide"><span>Remark</span><textarea value={draft.remark} onChange={(e) => setDraft({ ...draft, remark: e.target.value })} /></label>{error && <p className="form-error wide">{error}</p>}
    </div><div className="modal-footer"><button className="button ghost" onClick={() => setDraft(null)}>Cancel</button><button className="button danger-button" onClick={save}>Block phone</button></div></div></div>}
  </>;
}
