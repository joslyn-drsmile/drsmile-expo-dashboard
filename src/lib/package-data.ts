import { supabase } from "./supabase";
import { mapPackageRow } from "./remote-data";
import type { AuditLog, ExpoPackage, PackageDraft } from "./types";
import { uid } from "./utils";

const BUCKET = "expo-package-images";

function packagePath(expoId: string, packageId: string) {
  return `packages/${expoId}/${packageId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
}

async function uploadImage(path: string, file: File) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: "image/webp", upsert: false });
  if (error) throw error;
}

async function cleanupImage(path: string) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error("Unable to clean package image", error);
}

async function writeAudit(log: AuditLog) {
  const { error } = await supabase.from("expo_audit_logs").insert({
    id: log.id, entity: log.entity, record_id: log.recordId, action: log.action, summary: log.summary,
    actor_id: log.actorId ?? null, actor_name: log.actorName ?? null, actor_email: log.actorEmail ?? null, created_at: log.createdAt,
  });
  if (error) throw error;
}

function packageInsert(id: string, draft: PackageDraft, imagePath: string, sortOrder: number, copiedFromPackageId: string | null = null) {
  const voucherAmount = draft.voucherAmount != null && draft.voucherAmount > 0 ? draft.voucherAmount : null;
  const voucherQuantity = voucherAmount == null ? null : draft.voucherQuantity != null && draft.voucherQuantity > 0 ? Math.round(draft.voucherQuantity) : 1;
  return {
    id, expo_id: draft.expoId, name: draft.name.trim() || "Untitled package", price: Number.isFinite(draft.price) && draft.price > 0 ? draft.price : 0, currency: "MYR", description: draft.description.trim(),
    voucher_amount: voucherAmount, voucher_quantity: voucherQuantity, voucher_note: draft.voucherNote.trim(), image_path: imagePath,
    sort_order: sortOrder, active: true, copied_from_package_id: copiedFromPackageId,
  };
}

export async function createPackageRemote(draft: PackageDraft, image: File | null, sortOrder: number, audit: AuditLog) {
  const id = uid("package");
  const imagePath = image ? packagePath(draft.expoId, id) : "";
  if (image) await uploadImage(imagePath, image);
  const { data, error } = await supabase.from("expo_packages").insert(packageInsert(id, draft, imagePath, sortOrder)).select("*").single();
  if (error) {
    if (imagePath) await cleanupImage(imagePath);
    throw error;
  }
  await writeAudit({ ...audit, recordId: id });
  return mapPackageRow(data);
}

export async function updatePackageRemote(current: ExpoPackage, draft: PackageDraft, image: File | null, audit: AuditLog) {
  const nextPath = image ? packagePath(draft.expoId, current.id) : current.imagePath;
  if (image) await uploadImage(nextPath, image);
  const normalized = packageInsert(current.id, draft, nextPath, current.sortOrder, current.copiedFromPackageId || null);
  const { data, error } = await supabase.from("expo_packages").update({
    expo_id: normalized.expo_id, name: normalized.name, price: normalized.price, description: normalized.description, voucher_amount: normalized.voucher_amount,
    voucher_quantity: normalized.voucher_quantity, voucher_note: normalized.voucher_note, image_path: normalized.image_path,
  }).eq("id", current.id).select("*").single();
  if (error) {
    if (image) await cleanupImage(nextPath);
    throw error;
  }
  await writeAudit(audit);
  if (image && current.imagePath && current.imagePath !== nextPath) await cleanupImage(current.imagePath);
  return mapPackageRow(data);
}

export async function duplicatePackageRemote(current: ExpoPackage, targetExpoId: string, sortOrder: number, audit: AuditLog) {
  const id = uid("package");
  const nextPath = current.imagePath ? packagePath(targetExpoId, id) : "";
  if (current.imagePath) {
    const { error: copyError } = await supabase.storage.from(BUCKET).copy(current.imagePath, nextPath);
    if (copyError) throw copyError;
  }
  const draft: PackageDraft = { expoId: targetExpoId, name: `${current.name} (Copy)`, price: current.price, description: current.description, voucherAmount: current.voucherAmount, voucherQuantity: current.voucherQuantity, voucherNote: current.voucherNote };
  const { data, error } = await supabase.from("expo_packages").insert(packageInsert(id, draft, nextPath, sortOrder, current.id)).select("*").single();
  if (error) {
    if (nextPath) await cleanupImage(nextPath);
    throw error;
  }
  await writeAudit({ ...audit, recordId: id });
  return mapPackageRow(data);
}

export async function setPackageActiveRemote(id: string, active: boolean, audit: AuditLog) {
  const { data, error } = await supabase.from("expo_packages").update({ active }).eq("id", id).select("*").single();
  if (error) throw error;
  await writeAudit(audit);
  return mapPackageRow(data);
}

export async function reorderPackagesRemote(orderedIds: string[]) {
  for (const [sortOrder, id] of orderedIds.entries()) {
    const { error } = await supabase.from("expo_packages").update({ sort_order: sortOrder }).eq("id", id);
    if (error) throw error;
  }
}

export async function getPackageImageUrls(paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) throw error;
  return Object.fromEntries((data ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl])) as Record<string, string>;
}
