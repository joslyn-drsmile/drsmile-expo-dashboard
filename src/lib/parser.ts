import type { Gender, SmartPasteResult } from "./types";
import { normalizePhone } from "./utils";

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

function parseDate(raw: string) {
  const match = raw.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (!match) return "";
  const [, day, month, suppliedYear] = match;
  const currentYear = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kuala_Lumpur", year: "numeric" }).format(new Date());
  const year = suppliedYear ? (suppliedYear.length === 2 ? `20${suppliedYear}` : suppliedYear) : currentYear;
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${date}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(year) || parsed.getMonth() + 1 !== Number(month) || parsed.getDate() !== Number(day) ? "" : date;
}

export function parseSmartPaste(raw: string): SmartPasteResult {
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

  return {
    name: { value: name, confidence: name ? "high" : "unresolved" },
    gender: { value: gender, confidence: gender ? "high" : "unresolved" },
    phone: { value: phone, confidence: normalized ? (labelledPhone ? "high" : "medium") : "unresolved" },
    date: { value: parseDate(dateRaw), confidence: parseDate(dateRaw) ? "high" : "unresolved" },
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
      return { platform: "IG" as const, source: paid ? "IG Ads" : /\/(p|reel)\//.test(url.pathname) ? "IG Post" : "", confidence: paid || /\/(p|reel)\//.test(url.pathname) ? "high" as const : "medium" as const };
    }
    if (host.includes("facebook.com") || host === "fb.me") {
      return { platform: "FB" as const, source: paid ? "FB Ads" : /(posts|permalink|reel|videos)/.test(url.pathname) ? "FB Post" : "", confidence: paid || /(posts|permalink|reel|videos)/.test(url.pathname) ? "high" as const : "medium" as const };
    }
  } catch {}
  return { platform: "" as const, source: "Other", confidence: "medium" as const };
}
