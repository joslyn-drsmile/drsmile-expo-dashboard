"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Copy, Eye, ImagePlus, PackageOpen, PencilLine, Plus, Ticket, X } from "lucide-react";
import type { AppData, ExpoPackage, PackageDraft } from "@/lib/types";
import { formatFileSize, optimizePackageImage } from "@/lib/package-images";
import { getPackageImageUrls } from "@/lib/package-data";
import { PageHeader } from "./dashboard";

type Result = Promise<{ ok: boolean; error?: string }>;
type FormState = { packageItem?: ExpoPackage; draft: PackageDraft; image: File | null; preview: string; imageInfo: string };

function emptyDraft(expoId: string): PackageDraft {
  return { expoId, name: "", price: 0, description: "", voucherAmount: null, voucherQuantity: null, voucherNote: "" };
}

export function Packages({ data, expoId, onExpoChange, onCreate, onUpdate, onDuplicate, onSetActive, onReorder }: {
  data: AppData;
  expoId: string;
  onExpoChange: (id: string) => void;
  onCreate: (draft: PackageDraft, image: File | null) => Result;
  onUpdate: (id: string, draft: PackageDraft, image: File | null) => Result;
  onDuplicate: (id: string, targetExpoId: string) => Result;
  onSetActive: (id: string, active: boolean) => Result;
  onReorder: (expoId: string, orderedIds: string[]) => Result;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [detail, setDetail] = useState<ExpoPackage | null>(null);
  const [duplicate, setDuplicate] = useState<ExpoPackage | null>(null);
  const [duplicateExpoId, setDuplicateExpoId] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedExpoId = data.expos.some((expo) => expo.id === expoId) ? expoId : data.expos[0]?.id ?? "";
  const ordered = useMemo(() => data.packages.filter((item) => item.expoId === selectedExpoId && item.active !== showArchived).sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt)), [data.packages, selectedExpoId, showArchived]);

  useEffect(() => {
    let active = true;
    const paths = [...new Set(data.packages.map((item) => item.imagePath).filter(Boolean))];
    getPackageImageUrls(paths).then((next) => { if (active) setUrls(next); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Package images could not be loaded."); });
    return () => { active = false; };
  }, [data.packages]);

  useEffect(() => {
    if (!data.expos.length || selectedExpoId === expoId) return;
    onExpoChange(selectedExpoId);
  }, [data.expos.length, expoId, onExpoChange, selectedExpoId]);

  function openNew() {
    setError("");
    setForm({ draft: emptyDraft(selectedExpoId), image: null, preview: "", imageInfo: "" });
  }

  function openEdit(item: ExpoPackage) {
    setError("");
    setForm({ packageItem: item, draft: { expoId: item.expoId, name: item.name, price: item.price, description: item.description, voucherAmount: item.voucherAmount, voucherQuantity: item.voucherQuantity, voucherNote: item.voucherNote }, image: null, preview: urls[item.imagePath] ?? "", imageInfo: "Current 1080 × 1080 WebP" });
  }

  async function chooseImage(file: File | undefined) {
    if (!file || !form) return;
    setBusy(true);
    setError("");
    try {
      const image = await optimizePackageImage(file);
      if (form.preview.startsWith("blob:")) URL.revokeObjectURL(form.preview);
      setForm({ ...form, image, preview: URL.createObjectURL(image), imageInfo: `Optimised to 1080 × 1080 WebP · ${formatFileSize(image.size)}` });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to read this image.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setError("");
    const result = form.packageItem ? await onUpdate(form.packageItem.id, form.draft, form.image) : await onCreate(form.draft, form.image);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "Unable to save package.");
    if (form.preview.startsWith("blob:")) URL.revokeObjectURL(form.preview);
    setForm(null);
  }

  async function changeActive(item: ExpoPackage, active: boolean) {
    setBusy(true);
    setError("");
    const result = await onSetActive(item.id, active);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Unable to update package.");
    if (detail?.id === item.id) setDetail(null);
  }

  function beginDuplicate(item: ExpoPackage) {
    setDuplicate(item);
    setDuplicateExpoId(data.expos.find((expo) => expo.id !== item.expoId)?.id ?? item.expoId);
    setError("");
  }

  async function confirmDuplicate() {
    if (!duplicate || !duplicateExpoId) return;
    setBusy(true);
    const result = await onDuplicate(duplicate.id, duplicateExpoId);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "Unable to duplicate package.");
    setDuplicate(null);
    onExpoChange(duplicateExpoId);
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    const result = await onReorder(selectedExpoId, next.map((item) => item.id));
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Unable to reorder packages.");
  }

  return <>
    <PageHeader eyebrow="Expo offers" title="Packages" subtitle="Keep every Expo package, price and voucher in one place for the whole team." actions={<button className="button primary" onClick={openNew} disabled={!selectedExpoId}><Plus /> New package</button>} />
    <div className="package-toolbar panel">
      <label><span>Expo</span><select value={selectedExpoId} onChange={(event) => onExpoChange(event.target.value)}>{data.expos.map((expo) => <option key={expo.id} value={expo.id}>{expo.name}</option>)}</select></label>
      <div className="package-filter"><button className={!showArchived ? "active" : ""} onClick={() => setShowArchived(false)}>Active</button><button className={showArchived ? "active" : ""} onClick={() => setShowArchived(true)}>Archived</button></div>
      <span className="package-count">{ordered.length} {ordered.length === 1 ? "package" : "packages"}</span>
    </div>
    {error && <div className="package-alert">{error}<button onClick={() => setError("")}><X /></button></div>}
    {ordered.length ? <div className="package-grid">{ordered.map((item, index) => <article className={`package-card panel ${!item.active ? "archived" : ""}`} key={item.id}>
      <button className="package-image" style={{ backgroundImage: urls[item.imagePath] ? `url(${JSON.stringify(urls[item.imagePath]).slice(1, -1)})` : undefined }} onClick={() => setDetail(item)} aria-label={`View ${item.name}`}><span>{!urls[item.imagePath] && <ImagePlus />}</span></button>
      <div className="package-card-body"><div className="package-title-row"><div><h2>{item.name}</h2><strong>RM {item.price.toFixed(2)}</strong></div><button className="icon-button" onClick={() => setDetail(item)} aria-label="View details"><Eye /></button></div>
      <p className="package-description">{item.description || "No description added."}</p>
      {item.voucherAmount != null && <div className="voucher-callout"><Ticket /><div><strong>RM{item.voucherAmount.toFixed(0)} Voucher × {item.voucherQuantity}</strong>{item.voucherNote && <small>{item.voucherNote}</small>}</div></div>}
      <div className="package-actions"><button onClick={() => openEdit(item)}><PencilLine /> Edit</button><button onClick={() => beginDuplicate(item)}><Copy /> Duplicate</button>{item.active ? <button onClick={() => void changeActive(item, false)}><Archive /> Archive</button> : <button onClick={() => void changeActive(item, true)}><ArchiveRestore /> Restore</button>}</div>
      {item.active && <div className="package-order"><button disabled={index === 0 || busy} onClick={() => void move(index, -1)} aria-label="Move up"><ArrowUp /></button><span>Position {index + 1}</span><button disabled={index === ordered.length - 1 || busy} onClick={() => void move(index, 1)} aria-label="Move down"><ArrowDown /></button></div>}
      </div>
    </article>)}</div> : <div className="panel package-empty"><PackageOpen /><h2>{showArchived ? "No archived packages" : "No packages for this Expo yet"}</h2><p>{showArchived ? "Archived packages will stay recoverable here." : "Add the Expo offer so the whole team can refer back to it."}</p>{!showArchived && <button className="button primary" onClick={openNew}><Plus /> New package</button>}</div>}

    {form && <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && !busy && setForm(null)}><div className="modal-card package-modal"><div className="modal-head"><div><span className="eyebrow">Package setup</span><h2>{form.packageItem ? "Edit package" : "Create a package"}</h2><p>Save what you have now and add any missing details later. Images are optional.</p></div><button className="icon-button" disabled={busy} onClick={() => setForm(null)}><X /></button></div><div className="modal-body package-form">
      <label className="package-upload"><input type="file" accept="image/png,image/jpeg,image/webp,.jpg,.jpeg" onChange={(event) => void chooseImage(event.target.files?.[0])} /><div className="package-upload-preview" style={{ backgroundImage: form.preview ? `url(${JSON.stringify(form.preview).slice(1, -1)})` : undefined }}>{!form.preview && <><ImagePlus /><strong>Add image later or upload now</strong><span>Optional · PNG, JPG, JPEG or WebP · up to 25MB</span></>}</div>{form.imageInfo && <small>{form.imageInfo}</small>}<b>{form.preview ? "Replace image" : "Upload optional image"}</b></label>
      <div className="package-fields form-grid"><label className="field wide"><span>Expo</span><select value={form.draft.expoId} onChange={(event) => setForm({ ...form, draft: { ...form.draft, expoId: event.target.value } })}>{data.expos.map((expo) => <option key={expo.id} value={expo.id}>{expo.name}</option>)}</select></label>
      <label className="field wide"><span>Package name</span><input value={form.draft.name} onChange={(event) => setForm({ ...form, draft: { ...form.draft, name: event.target.value } })} placeholder="Expo Whitening Package" /></label>
      <label className="field"><span>Price (MYR)</span><input type="number" min="0" step="0.01" value={form.draft.price || ""} onChange={(event) => setForm({ ...form, draft: { ...form.draft, price: Number(event.target.value) } })} placeholder="299.00" /></label>
      <label className="field"><span>Voucher amount (RM)</span><input type="number" min="1" step="0.01" value={form.draft.voucherAmount ?? ""} onChange={(event) => setForm({ ...form, draft: { ...form.draft, voucherAmount: event.target.value ? Number(event.target.value) : null } })} placeholder="15" /></label>
      <label className="field"><span>Voucher quantity</span><input type="number" min="1" step="1" value={form.draft.voucherQuantity ?? ""} onChange={(event) => setForm({ ...form, draft: { ...form.draft, voucherQuantity: event.target.value ? Number(event.target.value) : null } })} placeholder="2" /></label>
      <label className="field wide"><span>Description</span><textarea value={form.draft.description} onChange={(event) => setForm({ ...form, draft: { ...form.draft, description: event.target.value } })} rows={4} placeholder="What is included in this package?" /></label>
      <label className="field wide"><span>Voucher note / terms</span><textarea value={form.draft.voucherNote} onChange={(event) => setForm({ ...form, draft: { ...form.draft, voucherNote: event.target.value } })} rows={2} placeholder="Optional usage conditions" /></label></div>
      {error && <p className="form-error wide">{error}</p>}
    </div><div className="modal-footer"><button className="button ghost" disabled={busy} onClick={() => setForm(null)}>Cancel</button><button className="button primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : form.packageItem ? "Save changes" : "Create package"}</button></div></div></div>}

    {detail && <div className="drawer-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setDetail(null)}><aside className="package-detail"><div className="drawer-head"><div><span className="eyebrow">Package details</span><h2>{detail.name}</h2></div><button className="icon-button" onClick={() => setDetail(null)}><X /></button></div><div className="package-detail-image" style={{ backgroundImage: urls[detail.imagePath] ? `url(${JSON.stringify(urls[detail.imagePath]).slice(1, -1)})` : undefined }} /><strong className="package-detail-price">RM {detail.price.toFixed(2)}</strong><p>{detail.description || "No description added."}</p>{detail.voucherAmount != null && <div className="voucher-callout large"><Ticket /><div><strong>RM{detail.voucherAmount.toFixed(0)} Voucher × {detail.voucherQuantity}</strong>{detail.voucherNote && <small>{detail.voucherNote}</small>}</div></div>}<div className="package-detail-actions"><button className="button secondary" onClick={() => { setDetail(null); openEdit(detail); }}><PencilLine /> Edit package</button><button className="button secondary" onClick={() => { setDetail(null); beginDuplicate(detail); }}><Copy /> Duplicate</button></div></aside></div>}

    {duplicate && <div className="modal-backdrop"><div className="modal-card package-copy-modal"><div className="modal-head"><div><span className="eyebrow">Duplicate package</span><h2>Copy {duplicate.name}</h2><p>The image and package details become an independent copy.</p></div><button className="icon-button" disabled={busy} onClick={() => setDuplicate(null)}><X /></button></div><div className="modal-body"><label className="field"><span>Target Expo</span><select value={duplicateExpoId} onChange={(event) => setDuplicateExpoId(event.target.value)}>{data.expos.map((expo) => <option key={expo.id} value={expo.id}>{expo.name}</option>)}</select></label>{error && <p className="form-error">{error}</p>}</div><div className="modal-footer"><button className="button ghost" disabled={busy} onClick={() => setDuplicate(null)}>Cancel</button><button className="button primary" disabled={busy || !duplicateExpoId} onClick={() => void confirmDuplicate()}>{busy ? "Copying…" : "Duplicate package"}</button></div></div></div>}
  </>;
}
