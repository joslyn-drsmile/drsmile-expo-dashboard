import { addDays, format, isAfter, isBefore, isEqual, parseISO } from "date-fns";
import type { Appointment, AppData, Expo, TimeSlot } from "./types";

export function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizePhone(input: string): string {
  let digits = input.trim().replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0060")) digits = digits.slice(2);
  if (digits.startsWith("01")) digits = `60${digits.slice(1)}`;
  if (/^60\d{9,10}$/.test(digits)) return digits;
  if (/^\d{8,15}$/.test(digits)) return digits;
  return "";
}

export function displayPhone(phone: string) {
  if (/^60\d{9,10}$/.test(phone)) return `+${phone}`;
  return phone;
}

export function dateRange(start: string, end: string) {
  const dates: string[] = [];
  let cursor = parseISO(start);
  const last = parseISO(end);
  while (isBefore(cursor, last) || isEqual(cursor, last)) {
    dates.push(format(cursor, "yyyy-MM-dd"));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function formatDate(date: string, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: style === "long" ? "long" : "short",
    ...(style === "long" ? { weekday: "short" as const } : {}),
  }).format(new Date(`${date}T00:00:00+08:00`));
}

export function expoStatus(expo: Expo, now = new Date()) {
  const current = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  if (current < expo.startDate) return "Upcoming" as const;
  if (current > expo.endDate) return "Ended" as const;
  return "Ongoing" as const;
}

export function appointmentPhase(appointment: Appointment, slot: TimeSlot | undefined, data: AppData, now = new Date()) {
  if (appointment.state === "Cancelled") return "Cancelled" as const;
  if (appointment.purchased) return "Purchased" as const;
  if (appointment.attended) return "Attended" as const;
  const day = data.days.find((item) => item.id === appointment.dayId);
  if (!day || !slot) return "Pending" as const;
  const end = new Date(`${day.date}T${slot.endTime}:00+08:00`);
  return isAfter(now, end) ? ("No show" as const) : ("Pending" as const);
}

export function sourceName(data: AppData, sourceId: string) {
  return data.sources.find((source) => source.id === sourceId)?.name ?? "Other";
}

export function customerFor(data: AppData, appointment: Appointment) {
  return data.customers.find((customer) => customer.id === appointment.customerId);
}

export function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function percent(numerator: number, denominator: number) {
  if (!denominator) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

