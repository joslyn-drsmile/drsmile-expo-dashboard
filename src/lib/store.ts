"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoData } from "./demo-data";
import { deleteRemote, loadRemoteData, upsertRemote } from "./remote-data";
import { createPackageRemote, duplicatePackageRemote, reorderPackagesRemote, setPackageActiveRemote, updatePackageRemote } from "./package-data";
import type { AppData, Appointment, BlacklistEntry, Eligibility, Expo, MarketingSnapshot, PackageDraft } from "./types";
import { dateRange, displayPhone, normalizePhone, uid } from "./utils";

const STORAGE_KEY = "drsmile-expo-dashboard-v8";
export type MorningSlotStart = "10:00" | "11:00" | "12:00";

function slotLinesForMorning(start: MorningSlotStart) {
  return [
    `${start}-${start === "12:00" ? "15:00" : "13:00"}`,
    ...(start === "12:00" ? [] : ["13:00-15:00"]),
    "15:00-17:00",
    "17:00-19:00",
    "19:00-22:00",
  ];
}

export interface NewAppointmentInput {
  name: string;
  gender: "Female" | "Male" | "Other";
  phone: string;
  expoId: string;
  dayId: string;
  slotId: string;
  concern: string;
  userType: Appointment["userType"];
  platformName: string;
  sourceId: string;
  adsName: string;
  adsLink: string;
  paidStatus: Appointment["paidStatus"];
  paidNote: string;
  purchaseAmount: number;
  remark: string;
}

export interface AuditActor {
  id: string;
  name: string;
  email: string;
}

const appointmentFieldLabels: Partial<Record<keyof Appointment, string>> = {
  platformName: "Platform name",
  adsName: "Ads name",
  remark: "Remark",
  baristaRegistered: "Barista",
  attended: "Attended",
  purchased: "Purchased",
  purchaseAmount: "Purchase amount",
  reminderSent: "Reminder",
  attention: "Attention",
  attentionReason: "Attention reason",
};

function auditValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value ?? "").trim();
  return text || "Empty";
}

function cloneDemo() {
  return JSON.parse(JSON.stringify(demoData)) as AppData;
}

function mergeLatestDemo(saved: AppData): AppData {
  const latest = cloneDemo();
  const mergeById = <T extends { id: string }>(current: T[] = [], incoming: T[] = []) => {
    const ids = new Set(current.map((item) => item.id));
    return [...current, ...incoming.filter((item) => !ids.has(item.id))];
  };
  const slots = mergeById(saved.slots, latest.slots);
  const invalidSlotIds = new Set(slots.filter((slot) => slot.startTime >= slot.endTime).map((slot) => slot.id));
  const validSlots = slots.filter((slot) => !invalidSlotIds.has(slot.id));
  const appointments = mergeById(saved.appointments, latest.appointments).map((appointment) => {
    if (!invalidSlotIds.has(appointment.slotId)) return appointment;
    const invalid = slots.find((slot) => slot.id === appointment.slotId);
    const replacement = validSlots.find((slot) => slot.dayId === invalid?.dayId && slot.startTime === "11:00" && slot.endTime === invalid?.endTime);
    return replacement ? { ...appointment, slotId: replacement.id } : appointment;
  });
  return {
    expos: mergeById(saved.expos, latest.expos),
    days: mergeById(saved.days, latest.days),
    slots: validSlots,
    customers: mergeById(saved.customers, latest.customers),
    appointments,
    sources: mergeById(saved.sources, latest.sources),
    blacklist: mergeById(saved.blacklist, latest.blacklist),
    marketing: mergeById(saved.marketing, latest.marketing),
    packages: mergeById(saved.packages ?? [], latest.packages),
    auditLogs: mergeById(saved.auditLogs, latest.auditLogs),
  };
}

export function getEligibility(data: AppData, phone: string): Eligibility {
  const normalized = normalizePhone(phone);
  if (!normalized) return { status: "first", label: "First appointment" };
  const history = data.appointments.filter((appointment) => {
    const customer = data.customers.find((item) => item.id === appointment.customerId);
    return customer?.normalizedPhone === normalized;
  });
  const entry = data.blacklist.find((item) => item.active && item.normalizedPhone === normalized);
  if (entry) return { status: "blacklisted", label: "Blacklisted", entry, history };
  if (history.length) {
    return history.some((item) => item.attended)
      ? { status: "redeemed", label: "Redeemed", history }
      : { status: "registered", label: "Registered", history };
  }
  return { status: "first", label: "First appointment" };
}

export function useDashboardStore(actor: AuditActor) {
  const [data, setData] = useState<AppData>(cloneDemo);
  const [hydrated, setHydrated] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<"loading" | "synced" | "error">("loading");
  const previousData = useRef<AppData | null>(null);

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const remote = await loadRemoteData();
        if (!remote) throw new Error("The cloud database is empty. Automatic browser imports are disabled.");
        const next = remote;
        previousData.current = next;
        setData(next);
        setCloudStatus("synced");
      } catch (error) {
        console.error("Cloud data could not be loaded", error);
        try {
          const saved = window.localStorage.getItem(STORAGE_KEY);
          if (saved) setData(mergeLatestDemo(JSON.parse(saved)));
        } catch {}
        setCloudStatus("error");
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  useEffect(() => {
    if (!hydrated || cloudStatus === "loading") return;
    const before = previousData.current;
    if (!before) return;
    const timer = window.setTimeout(async () => {
      try {
        const collections = (Object.keys(data) as Array<keyof AppData>).filter((collection) => collection !== "packages");
        for (const collection of collections) {
          if (JSON.stringify(before[collection]) === JSON.stringify(data[collection])) continue;
          const oldItems = before[collection] as Array<{ id: string }>;
          const oldById = new Map(oldItems.map((item) => [item.id, item]));
          const oldIds = new Set(oldItems.map((item) => item.id));
          const currentItems = data[collection] as Array<{ id: string }>;
          const currentIds = new Set(currentItems.map((item) => item.id));
          const changedItems = currentItems.filter((item) => JSON.stringify(oldById.get(item.id)) !== JSON.stringify(item));
          await upsertRemote(collection, changedItems as never);
          for (const id of oldIds) if (!currentIds.has(id)) await deleteRemote(collection, id);
        }
        previousData.current = data;
        setCloudStatus("synced");
      } catch (error) {
        console.error("Cloud sync failed", error);
        setCloudStatus("error");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [cloudStatus, data, hydrated]);

  const audit = useCallback((entity: string, recordId: string, action: string, summary: string) => ({
    id: uid("audit"), entity, recordId, action, summary,
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    createdAt: new Date().toISOString(),
  }), [actor.email, actor.id, actor.name]);

  const toggleAppointment = useCallback((id: string, field: "baristaRegistered" | "attended" | "purchased" | "reminderSent") => {
    setData((current) => {
      const target = current.appointments.find((item) => item.id === id);
      if (!target) return current;
      if (target.purchaseAmount > 0 && ((field === "purchased" && target.purchased) || (field === "attended" && target.attended))) return current;
      const nextValue = !target[field];
      const appointments = current.appointments.map((item) => item.id === id ? {
        ...item,
        [field]: nextValue,
        ...(field === "purchased" && nextValue ? { attended: true } : {}),
      } : item);
      const customer = current.customers.find((item) => item.id === target.customerId);
      const fieldLabel = appointmentFieldLabels[field] ?? field;
      return { ...current, appointments, auditLogs: [audit("appointment", id, "update", `${fieldLabel} set to ${auditValue(nextValue)} for ${customer?.name ?? "customer"}`), ...current.auditLogs] };
    });
  }, [audit]);

  const updateAppointment = useCallback((id: string, patch: Partial<Appointment>) => {
    setData((current) => {
      const target = current.appointments.find((item) => item.id === id);
      if (!target) return current;
      const changed = Object.entries(patch).filter(([key, value]) => target[key as keyof Appointment] !== value);
      if (!changed.length) return current;
      const customer = current.customers.find((item) => item.id === target.customerId);
      const changeSummary = changed.map(([key, value]) => {
        const typedKey = key as keyof Appointment;
        return `${appointmentFieldLabels[typedKey] ?? key}: ${auditValue(target[typedKey])} → ${auditValue(value)}`;
      }).join("; ");
      const positivePurchaseAmount = patch.purchaseAmount !== undefined && patch.purchaseAmount > 0;
      const effectivePatch = positivePurchaseAmount ? { ...patch, purchased: true, attended: true } : patch;
      return {
        ...current,
        appointments: current.appointments.map((item) => item.id === id ? { ...item, ...effectivePatch } : item),
        auditLogs: [audit("appointment", id, "update", `${changeSummary} · ${customer?.name ?? "customer"}`), ...current.auditLogs],
      };
    });
  }, [audit]);

  const updateAppointmentDetails = useCallback((id: string, input: NewAppointmentInput) => {
    const normalizedPhone = normalizePhone(input.phone);
    if (!normalizedPhone) return { ok: false, error: "Enter a valid phone number." };
    const currentAppointment = data.appointments.find((item) => item.id === id);
    if (!currentAppointment) return { ok: false, error: "Appointment not found." };
    const duplicateCustomer = data.customers.find((item) => item.normalizedPhone === normalizedPhone && item.id !== currentAppointment.customerId);
    if (duplicateCustomer) return { ok: false, error: "This phone number belongs to another customer record." };
    setData((current) => ({
      ...current,
      customers: current.customers.map((customer) => customer.id === currentAppointment.customerId ? {
        ...customer, name: input.name.trim(), gender: input.gender, originalPhone: displayPhone(normalizedPhone), normalizedPhone,
      } : customer),
      appointments: current.appointments.map((appointment) => appointment.id === id ? {
        ...appointment,
        expoId: input.expoId, dayId: input.dayId, slotId: input.slotId, concern: input.concern,
        userType: input.userType, platformName: input.platformName, sourceId: input.sourceId,
        adsName: input.adsName, adsLink: input.adsLink, paidStatus: input.paidStatus,
        paidNote: input.paidNote, purchaseAmount: input.purchaseAmount, remark: input.remark,
        ...(input.purchaseAmount > 0 ? { purchased: true, attended: true } : {}),
      } : appointment),
      auditLogs: [audit("appointment", id, "update", `Edited appointment for ${input.name.trim()}`), ...current.auditLogs],
    }));
    return { ok: true };
  }, [audit, data.appointments, data.customers]);

  const deleteAppointment = useCallback((id: string) => {
    setData((current) => {
      const appointment = current.appointments.find((item) => item.id === id);
      if (!appointment) return current;
      const customer = current.customers.find((item) => item.id === appointment.customerId);
      return {
        ...current,
        appointments: current.appointments.filter((item) => item.id !== id),
        auditLogs: [audit("appointment", id, "delete", `Deleted appointment for ${customer?.name ?? "customer"}`), ...current.auditLogs],
      };
    });
  }, [audit]);

  const createAppointment = useCallback((input: NewAppointmentInput) => {
    const normalizedPhone = normalizePhone(input.phone);
    if (!normalizedPhone) return { ok: false, error: "Enter a valid phone number." };
    const eligibility = getEligibility(data, input.phone);
    if (eligibility.status !== "first") return { ok: false, error: `${eligibility.label}: this phone cannot be registered again.` };
    const customerId = uid("customer");
    const appointmentId = uid("appointment");
    const now = new Date().toISOString();
    setData((current) => ({
      ...current,
      customers: [...current.customers, { id: customerId, name: input.name.trim(), gender: input.gender, originalPhone: displayPhone(normalizedPhone), normalizedPhone, createdAt: now }],
      appointments: [...current.appointments, {
        id: appointmentId,
        customerId,
        expoId: input.expoId,
        dayId: input.dayId,
        slotId: input.slotId,
        concern: input.concern,
        userType: input.userType,
        platformName: input.platformName,
        sourceId: input.sourceId,
        adsName: input.adsName,
        adsLink: input.adsLink,
        paidStatus: input.paidStatus,
        paidNote: input.paidNote,
        remark: input.remark,
        state: "Booked",
        baristaRegistered: false,
        attended: input.purchaseAmount > 0,
        purchased: input.purchaseAmount > 0,
        purchaseAmount: input.purchaseAmount,
        reminderSent: false,
        createdAt: now,
      }],
      auditLogs: [audit("appointment", appointmentId, "create", `Appointment created for ${input.name}`), ...current.auditLogs],
    }));
    return { ok: true };
  }, [audit, data]);

  const saveMarketing = useCallback((snapshot: Omit<MarketingSnapshot, "id" | "updatedAt">) => {
    setData((current) => {
      const existing = current.marketing.find((item) => item.expoId === snapshot.expoId && item.asOfDate === snapshot.asOfDate);
      const marketing = existing
        ? current.marketing.map((item) => item.id === existing.id ? { ...item, ...snapshot, updatedAt: new Date().toISOString() } : item)
        : [...current.marketing, { ...snapshot, id: uid("marketing"), updatedAt: new Date().toISOString() }];
      return { ...current, marketing, auditLogs: [audit("marketing", existing?.id ?? snapshot.expoId, existing ? "update" : "create", "Marketing UTD figures saved"), ...current.auditLogs] };
    });
  }, [audit]);

  const saveExpo = useCallback((expo: Omit<Expo, "id"> & { id?: string }, morningStart: MorningSlotStart = "10:00") => {
    setData((current) => {
      if (expo.id) {
        const dates = dateRange(expo.startDate, expo.endDate);
        const expoDays = current.days.filter((day) => day.expoId === expo.id).sort((a, b) => a.sortOrder - b.sortOrder);
        const days = current.days.map((day) => {
          if (day.expoId !== expo.id) return day;
          const index = expoDays.findIndex((item) => item.id === day.id);
          return dates[index] ? { ...day, date: dates[index], sortOrder: index } : day;
        });
        const extraDays = dates.slice(expoDays.length).map((date, offset) => ({ id: uid("day"), expoId: expo.id!, date, sortOrder: expoDays.length + offset }));
        const extraSlots = extraDays.flatMap((day) => slotLinesForMorning(morningStart).map((line, index) => {
          const [startTime, endTime] = line.split("-").map((part) => part.trim());
          return { id: uid("slot"), dayId: day.id, label: formatSlotLabel(startTime, endTime), startTime, endTime, sortOrder: index, active: true };
        }));
        return {
          ...current,
          expos: current.expos.map((item) => item.id === expo.id ? { id: expo.id!, name: expo.name, location: expo.location, startDate: expo.startDate, endDate: expo.endDate, openingTime: expo.openingTime } : item),
          days: [...days, ...extraDays],
          slots: [...current.slots, ...extraSlots],
          auditLogs: [audit("expo", expo.id, "update", `Updated ${expo.name}`), ...current.auditLogs],
        };
      }
      const expoId = uid("expo");
      const newDays = dateRange(expo.startDate, expo.endDate).map((date, index) => ({ id: uid("day"), expoId, date, sortOrder: index }));
      const newSlots = newDays.flatMap((day) => slotLinesForMorning(morningStart).map((line, index) => {
        const [startTime, endTime] = line.split("-").map((part) => part.trim());
        return { id: uid("slot"), dayId: day.id, label: formatSlotLabel(startTime, endTime), startTime, endTime, sortOrder: index, active: true };
      }));
      return {
        ...current,
        expos: [...current.expos, { id: expoId, name: expo.name, location: expo.location, startDate: expo.startDate, endDate: expo.endDate, openingTime: expo.openingTime }],
        days: [...current.days, ...newDays],
        slots: [...current.slots, ...newSlots],
        auditLogs: [audit("expo", expoId, "create", `Created ${expo.name}`), ...current.auditLogs],
      };
    });
  }, [audit]);

  const applySlotTemplate = useCallback((expoId: string, morningStart: MorningSlotStart) => {
    const dayIds = new Set(data.days.filter((day) => day.expoId === expoId).map((day) => day.id));
    const desiredLines = slotLinesForMorning(morningStart);
    const desiredKeys = new Set(desiredLines);
    const obsoleteWithAppointments = data.slots.find((slot) => dayIds.has(slot.dayId) && slot.active && !desiredKeys.has(`${slot.startTime}-${slot.endTime}`) && data.appointments.some((appointment) => appointment.slotId === slot.id));
    if (obsoleteWithAppointments) {
      const day = data.days.find((item) => item.id === obsoleteWithAppointments.dayId);
      return { ok: false, error: `${day ? formatDateForError(day.date) : "A date"} has appointments in ${obsoleteWithAppointments.label}. Move those appointments before replacing all time slots.` };
    }

    setData((current) => {
      const targetDays = current.days.filter((day) => day.expoId === expoId);
      const targetDayIds = new Set(targetDays.map((day) => day.id));
      const removableIds = new Set(current.slots.filter((slot) => targetDayIds.has(slot.dayId) && slot.active && !desiredKeys.has(`${slot.startTime}-${slot.endTime}`)).map((slot) => slot.id));
      let slots = current.slots.filter((slot) => !removableIds.has(slot.id));

      for (const day of targetDays) {
        for (const [index, line] of desiredLines.entries()) {
          const [startTime, endTime] = line.split("-");
          const existing = slots.find((slot) => slot.dayId === day.id && slot.startTime === startTime && slot.endTime === endTime);
          if (existing) {
            slots = slots.map((slot) => slot.id === existing.id ? { ...slot, label: formatSlotLabel(startTime, endTime), sortOrder: index, active: true } : slot);
          } else {
            slots.push({ id: uid("slot"), dayId: day.id, label: formatSlotLabel(startTime, endTime), startTime, endTime, sortOrder: index, active: true });
          }
        }
      }

      const expo = current.expos.find((item) => item.id === expoId);
      return { ...current, slots, auditLogs: [audit("time_slot", expoId, "bulk_update", `Applied ${formatSlotLabel(morningStart, morningStart === "12:00" ? "15:00" : "13:00")} template to all dates for ${expo?.name ?? "Expo"}`), ...current.auditLogs] };
    });
    return { ok: true };
  }, [audit, data.appointments, data.days, data.slots]);

  const addTimeSlot = useCallback((dayId: string, startTime: string, endTime: string) => {
    if (!dayId || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
      return { ok: false, error: "Choose a valid start and end time." };
    }
    const duplicate = data.slots.some((slot) => slot.dayId === dayId && slot.startTime === startTime && slot.endTime === endTime && slot.active);
    if (duplicate) return { ok: false, error: "This time slot already exists for the selected date." };
    const id = uid("slot");
    setData((current) => {
      const newSlot = { id, dayId, label: formatSlotLabel(startTime, endTime), startTime, endTime, sortOrder: 0, active: true };
      const slots = [...current.slots, newSlot];
      const orderedIds = slots.filter((slot) => slot.dayId === dayId && slot.active).sort((a, b) => a.startTime.localeCompare(b.startTime)).map((slot) => slot.id);
      return {
        ...current,
        slots: slots.map((slot) => slot.dayId === dayId ? { ...slot, sortOrder: orderedIds.indexOf(slot.id) } : slot),
        auditLogs: [audit("time_slot", id, "create", `Added ${newSlot.label}`), ...current.auditLogs],
      };
    });
    return { ok: true };
  }, [audit, data.slots]);

  const deleteTimeSlot = useCallback((id: string) => {
    if (data.appointments.some((appointment) => appointment.slotId === id)) {
      return { ok: false, error: "This time slot has appointments and cannot be deleted." };
    }
    setData((current) => ({
      ...current,
      slots: current.slots.filter((slot) => slot.id !== id),
      auditLogs: [audit("time_slot", id, "delete", "Deleted unused time slot"), ...current.auditLogs],
    }));
    return { ok: true };
  }, [audit, data.appointments]);

  const addBlacklist = useCallback((entry: Omit<BlacklistEntry, "id" | "normalizedPhone" | "active">) => {
    const normalizedPhone = normalizePhone(entry.originalPhone);
    if (!normalizedPhone) return { ok: false, error: "Enter a valid phone number." };
    const existing = data.blacklist.find((item) => item.normalizedPhone === normalizedPhone);
    if (existing?.active) return { ok: false, error: "This phone number is already on the blacklist." };
    if (existing) return { ok: false, error: "This phone has an inactive blacklist record. Reactivate it instead." };
    setData((current) => ({
      ...current,
      blacklist: [...current.blacklist, { ...entry, originalPhone: displayPhone(normalizedPhone), id: uid("blacklist"), normalizedPhone, active: true }],
      auditLogs: [audit("blacklist", normalizedPhone, "create", `Blacklisted ${entry.customerName}`), ...current.auditLogs],
    }));
    return { ok: true };
  }, [audit, data.blacklist]);

  const toggleBlacklist = useCallback((id: string) => {
    setData((current) => ({
      ...current,
      blacklist: current.blacklist.map((item) => item.id === id ? { ...item, active: !item.active } : item),
      auditLogs: [audit("blacklist", id, "update", "Blacklist status changed"), ...current.auditLogs],
    }));
  }, [audit]);

  const addSource = useCallback((name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return "";
    const existing = data.sources.find((item) => item.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing.id;
    const id = uid("source");
    setData((current) => ({
      ...current,
      sources: [...current.sources, { id, name: cleanName, active: true }],
      auditLogs: [audit("source", id, "create", `Added source ${cleanName}`), ...current.auditLogs],
    }));
    return id;
  }, [audit, data.sources]);

  const createPackage = useCallback(async (draft: PackageDraft, image: File | null) => {
    const expo = data.expos.find((item) => item.id === draft.expoId);
    try {
      const sortOrder = data.packages.filter((item) => item.expoId === draft.expoId).reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
      const log = audit("package", "pending", "create", `Created ${draft.name.trim() || "Untitled package"} for ${expo?.name ?? "Expo"}`);
      const item = await createPackageRemote(draft, image, sortOrder, log);
      setData((current) => ({ ...current, packages: [...current.packages, item], auditLogs: [{ ...log, recordId: item.id }, ...current.auditLogs] }));
      setCloudStatus("synced");
      return { ok: true };
    } catch (error) {
      console.error("Package creation failed", error);
      setCloudStatus("error");
      return { ok: false, error: error instanceof Error ? error.message : "Unable to create package." };
    }
  }, [audit, data.expos, data.packages]);

  const updatePackage = useCallback(async (id: string, draft: PackageDraft, image: File | null) => {
    const current = data.packages.find((item) => item.id === id);
    if (!current) return { ok: false, error: "Package not found." };
    const expo = data.expos.find((item) => item.id === draft.expoId);
    try {
      const log = audit("package", id, "update", `Updated ${draft.name.trim() || "Untitled package"} for ${expo?.name ?? "Expo"}`);
      const item = await updatePackageRemote(current, draft, image, log);
      setData((state) => ({ ...state, packages: state.packages.map((entry) => entry.id === id ? item : entry), auditLogs: [log, ...state.auditLogs] }));
      setCloudStatus("synced");
      return { ok: true };
    } catch (error) {
      console.error("Package update failed", error);
      setCloudStatus("error");
      return { ok: false, error: error instanceof Error ? error.message : "Unable to update package." };
    }
  }, [audit, data.expos, data.packages]);

  const duplicatePackage = useCallback(async (id: string, targetExpoId: string) => {
    const current = data.packages.find((item) => item.id === id);
    if (!current) return { ok: false, error: "Package not found." };
    const expo = data.expos.find((item) => item.id === targetExpoId);
    try {
      const sortOrder = data.packages.filter((item) => item.expoId === targetExpoId).reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
      const log = audit("package", "pending", "duplicate", `Copied ${current.name} to ${expo?.name ?? "Expo"}`);
      const item = await duplicatePackageRemote(current, targetExpoId, sortOrder, log);
      setData((state) => ({ ...state, packages: [...state.packages, item], auditLogs: [{ ...log, recordId: item.id }, ...state.auditLogs] }));
      setCloudStatus("synced");
      return { ok: true };
    } catch (error) {
      console.error("Package duplication failed", error);
      setCloudStatus("error");
      return { ok: false, error: error instanceof Error ? error.message : "Unable to duplicate package." };
    }
  }, [audit, data.expos, data.packages]);

  const setPackageActive = useCallback(async (id: string, active: boolean) => {
    const current = data.packages.find((item) => item.id === id);
    if (!current) return { ok: false, error: "Package not found." };
    try {
      const action = active ? "restore" : "archive";
      const log = audit("package", id, action, `${active ? "Restored" : "Archived"} ${current.name}`);
      const item = await setPackageActiveRemote(id, active, log);
      setData((state) => ({ ...state, packages: state.packages.map((entry) => entry.id === id ? item : entry), auditLogs: [log, ...state.auditLogs] }));
      setCloudStatus("synced");
      return { ok: true };
    } catch (error) {
      console.error("Package status update failed", error);
      setCloudStatus("error");
      return { ok: false, error: error instanceof Error ? error.message : "Unable to update package." };
    }
  }, [audit, data.packages]);

  const reorderPackages = useCallback(async (expoId: string, orderedIds: string[]) => {
    try {
      await reorderPackagesRemote(orderedIds);
      setData((state) => ({ ...state, packages: state.packages.map((item) => item.expoId === expoId && orderedIds.includes(item.id) ? { ...item, sortOrder: orderedIds.indexOf(item.id) } : item) }));
      setCloudStatus("synced");
      return { ok: true };
    } catch (error) {
      console.error("Package reorder failed", error);
      setCloudStatus("error");
      return { ok: false, error: error instanceof Error ? error.message : "Unable to reorder packages." };
    }
  }, []);

  const resetDemo = useCallback(() => setData(cloneDemo()), []);

  return useMemo(() => ({ data, hydrated, cloudStatus, toggleAppointment, updateAppointment, updateAppointmentDetails, deleteAppointment, createAppointment, saveMarketing, saveExpo, applySlotTemplate, addTimeSlot, deleteTimeSlot, addBlacklist, toggleBlacklist, addSource, createPackage, updatePackage, duplicatePackage, setPackageActive, reorderPackages, resetDemo }), [data, hydrated, cloudStatus, toggleAppointment, updateAppointment, updateAppointmentDetails, deleteAppointment, createAppointment, saveMarketing, saveExpo, applySlotTemplate, addTimeSlot, deleteTimeSlot, addBlacklist, toggleBlacklist, addSource, createPackage, updatePackage, duplicatePackage, setPackageActive, reorderPackages, resetDemo]);
}

function formatDateForError(date: string) {
  return new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short" }).format(new Date(`${date}T00:00:00+08:00`));
}

function formatSlotLabel(start: string, end: string) {
  const formatTime = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    const h = hour % 12 || 12;
    return `${h}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${hour >= 12 ? "PM" : "AM"}`;
  };
  return `${formatTime(start)} – ${formatTime(end)}`;
}
