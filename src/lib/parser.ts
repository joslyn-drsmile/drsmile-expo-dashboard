import type { Gender, SmartPasteResult } from "./types";
import { displayPhone, normalizePhone } from "./utils";

const aliases = {
  name: ["姓名", "名字", "name", "customer name"],
  gender: ["性别", "gender", "sex"],
  phone: ["电话号码", "电话", "手机", "phone number", "phone", "contact"],
  date: ["预约日期", "日期", "appointment date", "date"],
  time: ["预约时间", "时间", "time slot", "time"],
  concern: ["想解决什么问题", "问题", "problem", "concern", "details"],
  existingUser: ["已经是drsmile用户", "drsmile用户", "existing drsmile user", "existing user"],
};

function cleanLine(line: string) {
  return line.replace(/^\s*\d+[.)、]\s*/, "").replace(/[：]/g, ":").trim();
}

function labelledValue(lines: string[], keys: string[]) {
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const key of keys) {
      const normalized = key.toLowerCase();
      if (lower.startsWith(normalized)) {
        return line.slice(key.length).replace(/^\s*[:：-]\s*/, "").trim();
      }
    }
  }
  return "";
}

function parseGender(raw: string): Gender | "" {
  const value = raw.toLowerCase();
  if (/female|woman|女士|女性|女/.test(value)) return "Female";
  if (/male|man|先生|男性|男/.test(value)) return "Male";
  if (/other|其他/.test(value)) return "Other";
  return "";
}

function parseExisting(raw: string): boolean | null {
  const value = raw.toLowerCase();
  if (/^(是|yes|y|true|existing)/.test(value)) return true;
  if (/^(否|不是|no|n|false|new)/.test(value)) return false;
  return null;
}

function validDate(day: string, month: string, suppliedYear?: string) {
  const currentYear = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kuala_Lumpur", year: "numeric" }).format(new Date());
  const year = suppliedYear ? (suppliedYear.length === 2 ? `20${suppliedYear}` : suppliedYear) : currentYear;
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${date}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(year) || parsed.getMonth() + 1 !== Number(month) || parsed.getDate() !== Number(day) ? "" : date;
}

function nearestKnownDay(day: number, knownDates: string[]) {
  const candidates = knownDates
    .filter((date) => Number(date.slice(8, 10)) === day)
    .sort();
  if (!candidates.length) return "";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return candidates.find((date) => date >= today) ?? candidates[candidates.length - 1];
}

function parseDate(raw: string, knownDates: string[]) {
  const normalized = raw.replace(/[／]/g, "/").replace(/[．。]/g, ".");
  const iso = normalized.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return validDate(iso[3], iso[2], iso[1]);

  const chineseFull = normalized.match(/(?:(20\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)/);
  if (chineseFull) return validDate(chineseFull[3], chineseFull[2], chineseFull[1]);

  const numeric = normalized.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (numeric) {
    const exact = validDate(numeric[1], numeric[2], numeric[3]);
    if (exact && (numeric[3] || !knownDates.length || knownDates.includes(exact))) return exact;
    if (!numeric[3]) {
      const day = Number(numeric[1]);
      const month = Number(numeric[2]);
      const matchingKnown = knownDates.find((date) => Number(date.slice(5, 7)) === month && Number(date.slice(8, 10)) === day);
      if (matchingKnown) return matchingKnown;
    }
    return exact;
  }

  const dayOnly = normalized.match(/(?:^|[:：\s])(\d{1,2})\s*(?:日|号)(?:\s|$|[，,。.)）])/);
  return dayOnly ? nearestKnownDay(Number(dayOnly[1]), knownDates) : "";
}

export function parseSmartPaste(raw: string, knownDates: string[] = []): SmartPasteResult {
  const lines = raw.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const name = labelledValue(lines, aliases.name);
  const genderRaw = labelledValue(lines, aliases.gender);
  const labelledPhone = labelledValue(lines, aliases.phone);
  const fallbackPhone = raw.match(/(?:\+?60|0)1\d[\s-]?\d{3,4}[\s-]?\d{4}/)?.[0] ?? "";
  const phone = labelledPhone || fallbackPhone;
  const dateRaw = labelledValue(lines, aliases.date) || raw;
  const time = labelledValue(lines, aliases.time) || raw.match(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b/i)?.[0] || "";
  const concern = labelledValue(lines, aliases.concern);
  const existingRaw = labelledValue(lines, aliases.existingUser);
  const gender = parseGender(genderRaw);
  const existing = parseExisting(existingRaw);
  const normalized = normalizePhone(phone);

  const date = parseDate(dateRaw, knownDates);
  return {
    name: { value: name, confidence: name ? "high" : "unresolved" },
    gender: { value: gender, confidence: gender ? "high" : "unresolved" },
    phone: { value: normalized ? displayPhone(normalized) : phone, confidence: normalized ? (labelledPhone ? "high" : "medium") : "unresolved" },
    date: { value: date, confidence: date ? "high" : "unresolved" },
    time: { value: time.trim(), confidence: time ? (labelledValue(lines, aliases.time) ? "high" : "medium") : "unresolved" },
    concern: { value: concern, confidence: concern ? "high" : "unresolved" },
    existingUser: { value: existing, confidence: existing === null ? "unresolved" : "high" },
  };
}

export function detectAdsLink(raw: string) {
  if (!raw.trim()) return { platform: "" as const, source: "", confidence: "unresolved" as const };
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const paid = /utm_medium=(paid|cpc)|ad_id=|campaign_id=/i.test(url.search);
    if (host.includes("instagram.com")) {
      return { platform: "IG" as const, source: "IG Ads", confidence: paid ? "high" as const : "medium" as const };
    }
    if (host.includes("facebook.com") || host === "fb.me") {
      return { platform: "FB" as const, source: "FB Ads", confidence: paid ? "high" as const : "medium" as const };
    }
    if (host.includes("wa.me") || host.includes("whatsapp.com")) return { platform: "WhatsApp" as const, source: "WA Ads", confidence: "medium" as const };
  } catch {}
  return { platform: "" as const, source: "", confidence: "unresolved" as const };
}
