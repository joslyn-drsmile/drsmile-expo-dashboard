import type { AppData } from "./types";
import { appointmentPhase, sourceName } from "./utils";

export function dashboardMetrics(data: AppData, expoId: string, from?: string, to?: string) {
  const inRange = data.appointments.filter((appointment) => {
    if (appointment.expoId !== expoId || appointment.state !== "Booked") return false;
    const date = data.days.find((day) => day.id === appointment.dayId)?.date ?? "";
    return (!from || date >= from) && (!to || date <= to);
  });
  const phases = inRange.map((appointment) => appointmentPhase(appointment, data.slots.find((slot) => slot.id === appointment.slotId), data));
  const attended = inRange.filter((item) => item.attended).length;
  const purchased = inRange.filter((item) => item.purchased).length;
  const noShow = phases.filter((phase) => phase === "No show").length;
  const pending = phases.filter((phase) => phase === "Pending").length;
  const freebieOnly = inRange.filter((item) => item.attended && !item.purchased).length;
  const snapshot = [...data.marketing]
    .filter((item) => item.expoId === expoId && (!to || item.asOfDate <= to))
    .sort((a, b) => b.asOfDate.localeCompare(a.asOfDate))[0];
  const adsSpend = snapshot?.adsSpend ?? 0;
  const sales = snapshot?.sales ?? 0;

  const bySource = data.sources.map((source) => {
    const rows = inRange.filter((item) => item.sourceId === source.id);
    const sourceAttended = rows.filter((item) => item.attended).length;
    const sourcePurchased = rows.filter((item) => item.purchased).length;
    return { source: source.name, rsvp: rows.length, attended: sourceAttended, purchase: sourcePurchased, conversion: sourceAttended ? Math.round((sourcePurchased / sourceAttended) * 100) : 0 };
  }).filter((item) => item.rsvp > 0);

  const byDay = data.days.filter((day) => day.expoId === expoId).map((day) => ({
    date: day.date.slice(5).replace("-", "/"),
    RSVP: inRange.filter((item) => item.dayId === day.id).length,
    Attended: inRange.filter((item) => item.dayId === day.id && item.attended).length,
  }));

  const bySlot = data.slots.filter((slot) => data.days.find((day) => day.id === slot.dayId)?.expoId === expoId).reduce<Record<string, { name: string; RSVP: number; Purchase: number }>>((result, slot) => {
    const key = slot.label;
    result[key] ??= { name: key, RSVP: 0, Purchase: 0 };
    result[key].RSVP += inRange.filter((item) => item.slotId === slot.id).length;
    result[key].Purchase += inRange.filter((item) => item.slotId === slot.id && item.purchased).length;
    return result;
  }, {});

  const sourceTotals = inRange.reduce<Record<string, number>>((result, item) => {
    const name = sourceName(data, item.sourceId);
    result[name] = (result[name] ?? 0) + 1;
    return result;
  }, {});

  return {
    rsvp: inRange.length,
    attended,
    purchased,
    noShow,
    pending,
    freebieOnly,
    adsSpend,
    sales,
    costPerAppointment: inRange.length ? adsSpend / inRange.length : null,
    aov: purchased ? sales / purchased : null,
    roas: adsSpend ? sales / adsSpend : null,
    conversion: attended ? purchased / attended : null,
    bySource,
    byDay,
    bySlot: Object.values(bySlot),
    sourceTotals,
    newCount: inRange.filter((item) => item.userType === "NEW").length,
    vipCount: inRange.filter((item) => item.userType === "VIP").length,
  };
}
