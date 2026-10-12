import type { AppData, Appointment, AuditLog, BlacklistEntry, Customer, Expo, ExpoDay, ExpoPackage, MarketingSnapshot, MarketingSource, TimeSlot } from "./types";
import { supabase } from "./supabase";

const tables = {
  expos: "expo_expos", days: "expo_days", slots: "expo_time_slots", customers: "expo_customers",
  appointments: "expo_appointments", sources: "expo_marketing_sources", blacklist: "expo_blacklist_entries",
  marketing: "expo_marketing_snapshots", packages: "expo_packages", auditLogs: "expo_audit_logs",
} as const;

const rowMappers = {
  expos: (item: Expo) => ({ id: item.id, name: item.name, location: item.location, start_date: item.startDate, end_date: item.endDate, opening_time: item.openingTime }),
  days: (item: ExpoDay) => ({ id: item.id, expo_id: item.expoId, date: item.date, sort_order: item.sortOrder }),
  slots: (item: TimeSlot) => ({ id: item.id, day_id: item.dayId, label: item.label, start_time: item.startTime, end_time: item.endTime, sort_order: item.sortOrder, active: item.active }),
  customers: (item: Customer) => ({ id: item.id, name: item.name, gender: item.gender, original_phone: item.originalPhone, normalized_phone: item.normalizedPhone, created_at: item.createdAt }),
  appointments: (item: Appointment) => ({ id: item.id, customer_id: item.customerId, expo_id: item.expoId, day_id: item.dayId, slot_id: item.slotId, concern: item.concern, user_type: item.userType, platform_name: item.platformName, source_id: item.sourceId, ads_name: item.adsName, ads_link: item.adsLink, paid_status: item.paidStatus, paid_note: item.paidNote, remark: item.remark, state: item.state, barista_registered: item.baristaRegistered, attended: item.attended, purchased: item.purchased, purchase_amount: item.purchaseAmount, reminder_sent: item.reminderSent, attention: item.attention ?? false, attention_reason: item.attentionReason ?? "", created_at: item.createdAt }),
  sources: (item: MarketingSource) => ({ id: item.id, name: item.name, active: item.active }),
  blacklist: (item: BlacklistEntry) => ({ id: item.id, customer_name: item.customerName, original_phone: item.originalPhone, normalized_phone: item.normalizedPhone, reason: item.reason, date_added: item.dateAdded, related_expo_id: item.relatedExpoId || null, remark: item.remark, active: item.active }),
  marketing: (item: MarketingSnapshot) => ({ id: item.id, expo_id: item.expoId, as_of_date: item.asOfDate, ads_spend: item.adsSpend, forecast_sales: item.forecastSales, sales: item.sales, updated_at: item.updatedAt }),
  packages: (item: ExpoPackage) => ({ id: item.id, expo_id: item.expoId, name: item.name, price: item.price, currency: item.currency, description: item.description, voucher_amount: item.voucherAmount, voucher_quantity: item.voucherQuantity, voucher_note: item.voucherNote, image_path: item.imagePath, sort_order: item.sortOrder, active: item.active, copied_from_package_id: item.copiedFromPackageId || null, created_by: item.createdBy, updated_by: item.updatedBy, created_at: item.createdAt, updated_at: item.updatedAt }),
  auditLogs: (item: AuditLog) => ({ id: item.id, entity: item.entity, record_id: item.recordId, action: item.action, summary: item.summary, actor_id: item.actorId ?? null, actor_name: item.actorName ?? null, actor_email: item.actorEmail ?? null, created_at: item.createdAt }),
};

type Collection = keyof typeof tables;
const SOURCE_ORDER = ["FB PM", "FB Ads", "IG Ads", "IG PM", "WA Ads", "Community"];

export async function loadRemoteData(): Promise<AppData | null> {
  const entries = await Promise.all((Object.keys(tables) as Collection[]).map(async (key) => {
    const { data, error } = await supabase.from(tables[key]).select("*");
    if (error) throw error;
    return [key, data ?? []] as const;
  }));
  const rows = Object.fromEntries(entries) as Record<Collection, Record<string, unknown>[]>;
  if (!rows.expos.length) return null;
  return {
    expos: rows.expos.map((row) => ({ id: String(row.id), name: String(row.name), location: String(row.location), startDate: String(row.start_date), endDate: String(row.end_date), openingTime: String(row.opening_time).slice(0, 5) })),
    days: rows.days.map((row) => ({ id: String(row.id), expoId: String(row.expo_id), date: String(row.date), sortOrder: Number(row.sort_order) })),
    slots: rows.slots.map((row) => ({ id: String(row.id), dayId: String(row.day_id), label: String(row.label), startTime: String(row.start_time).slice(0, 5), endTime: String(row.end_time).slice(0, 5), sortOrder: Number(row.sort_order), active: Boolean(row.active) })),
    customers: rows.customers.map((row) => ({ id: String(row.id), name: String(row.name), gender: String(row.gender) as Customer["gender"], originalPhone: String(row.original_phone), normalizedPhone: String(row.normalized_phone), createdAt: String(row.created_at) })),
    appointments: rows.appointments.map((row) => ({ id: String(row.id), customerId: String(row.customer_id), expoId: String(row.expo_id), dayId: String(row.day_id), slotId: String(row.slot_id), concern: String(row.concern ?? ""), userType: String(row.user_type) as Appointment["userType"], platformName: String(row.platform_name ?? ""), sourceId: String(row.source_id), adsName: String(row.ads_name ?? ""), adsLink: String(row.ads_link ?? ""), paidStatus: String(row.paid_status) as Appointment["paidStatus"], paidNote: String(row.paid_note ?? ""), remark: String(row.remark ?? ""), state: String(row.state) as Appointment["state"], baristaRegistered: Boolean(row.barista_registered), attended: Boolean(row.attended), purchased: Boolean(row.purchased), purchaseAmount: Number(row.purchase_amount ?? 0), reminderSent: Boolean(row.reminder_sent), attention: Boolean(row.attention), attentionReason: String(row.attention_reason ?? ""), createdAt: String(row.created_at) })),
    sources: rows.sources.map((row) => ({ id: String(row.id), name: String(row.name), active: Boolean(row.active) })).sort((left, right) => {
      const leftIndex = SOURCE_ORDER.indexOf(left.name);
      const rightIndex = SOURCE_ORDER.indexOf(right.name);
      return (leftIndex < 0 ? SOURCE_ORDER.length : leftIndex) - (rightIndex < 0 ? SOURCE_ORDER.length : rightIndex);
    }),
    blacklist: rows.blacklist.map((row) => ({ id: String(row.id), customerName: String(row.customer_name), originalPhone: String(row.original_phone), normalizedPhone: String(row.normalized_phone), reason: String(row.reason), dateAdded: String(row.date_added), relatedExpoId: row.related_expo_id ? String(row.related_expo_id) : "", remark: String(row.remark ?? ""), active: Boolean(row.active) })),
    marketing: rows.marketing.map((row) => ({ id: String(row.id), expoId: String(row.expo_id), asOfDate: String(row.as_of_date), adsSpend: Number(row.ads_spend), forecastSales: Number(row.forecast_sales ?? 0), sales: Number(row.sales), updatedAt: String(row.updated_at) })),
    packages: rows.packages.map(mapPackageRow),
    auditLogs: rows.auditLogs.map((row) => ({ id: String(row.id), entity: String(row.entity), recordId: String(row.record_id), action: String(row.action), summary: String(row.summary), actorId: row.actor_id ? String(row.actor_id) : undefined, actorName: row.actor_name ? String(row.actor_name) : undefined, actorEmail: row.actor_email ? String(row.actor_email) : undefined, createdAt: String(row.created_at) })),
  };
}

export function mapPackageRow(row: Record<string, unknown>): ExpoPackage {
  return {
    id: String(row.id), expoId: String(row.expo_id), name: String(row.name), price: Number(row.price), currency: "MYR",
    description: String(row.description ?? ""), voucherAmount: row.voucher_amount == null ? null : Number(row.voucher_amount),
    voucherQuantity: row.voucher_quantity == null ? null : Number(row.voucher_quantity), voucherNote: String(row.voucher_note ?? ""),
    imagePath: String(row.image_path), sortOrder: Number(row.sort_order), active: Boolean(row.active),
    copiedFromPackageId: row.copied_from_package_id ? String(row.copied_from_package_id) : "",
    createdBy: String(row.created_by ?? ""), updatedBy: String(row.updated_by ?? ""), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

export async function upsertRemote<K extends Collection>(collection: K, items: AppData[K] extends Array<infer T> ? T[] : never) {
  if (!items.length) return;
  const rows = items.map((item) => rowMappers[collection](item as never));
  const { error } = await supabase.from(tables[collection]).upsert(rows);
  if (error) throw error;
}

export async function deleteRemote(collection: Collection, id: string) {
  const { error } = await supabase.from(tables[collection]).delete().eq("id", id);
  if (error) throw error;
}
