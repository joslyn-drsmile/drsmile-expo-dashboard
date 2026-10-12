export type PageKey = "dashboard" | "appointments" | "customers" | "expos" | "packages" | "payments" | "blacklist" | "users";
export type Gender = "Female" | "Male" | "Other";
export type UserType = "NEW" | "VIP";
export type PaidStatus = "Paid RM1" | "Unpaid" | "Other";
export type AppointmentState = "Booked" | "Cancelled";
export type Confidence = "high" | "medium" | "unresolved";

export interface Expo {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  openingTime: string;
}

export interface ExpoDay {
  id: string;
  expoId: string;
  date: string;
  sortOrder: number;
}

export interface TimeSlot {
  id: string;
  dayId: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  gender: Gender;
  originalPhone: string;
  normalizedPhone: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  customerId: string;
  expoId: string;
  dayId: string;
  slotId: string;
  concern: string;
  userType: UserType;
  platformName: string;
  sourceId: string;
  adsName: string;
  adsLink: string;
  paidStatus: PaidStatus;
  paidNote: string;
  remark: string;
  state: AppointmentState;
  baristaRegistered: boolean;
  attended: boolean;
  purchased: boolean;
  purchaseAmount: number;
  reminderSent: boolean;
  attention?: boolean;
  attentionReason?: string;
  createdAt: string;
}

export interface MarketingSource {
  id: string;
  name: string;
  active: boolean;
}

export interface BlacklistEntry {
  id: string;
  customerName: string;
  originalPhone: string;
  normalizedPhone: string;
  reason: string;
  dateAdded: string;
  relatedExpoId: string;
  remark: string;
  active: boolean;
}

export interface MarketingSnapshot {
  id: string;
  expoId: string;
  asOfDate: string;
  adsSpend: number;
  forecastSales: number;
  sales: number;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  entity: string;
  recordId: string;
  action: string;
  summary: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  createdAt: string;
}

export interface ExpoPackage {
  id: string;
  expoId: string;
  name: string;
  price: number;
  currency: "MYR";
  description: string;
  voucherAmount: number | null;
  voucherQuantity: number | null;
  voucherNote: string;
  imagePath: string;
  sortOrder: number;
  active: boolean;
  copiedFromPackageId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackageDraft {
  expoId: string;
  name: string;
  price: number;
  description: string;
  voucherAmount: number | null;
  voucherQuantity: number | null;
  voucherNote: string;
}

export interface AppData {
  expos: Expo[];
  days: ExpoDay[];
  slots: TimeSlot[];
  customers: Customer[];
  appointments: Appointment[];
  sources: MarketingSource[];
  blacklist: BlacklistEntry[];
  marketing: MarketingSnapshot[];
  packages: ExpoPackage[];
  auditLogs: AuditLog[];
}

export interface ParsedField<T = string> {
  value: T;
  confidence: Confidence;
}

export interface SmartPasteResult {
  name: ParsedField;
  gender: ParsedField<Gender | "">;
  phone: ParsedField;
  date: ParsedField;
  time: ParsedField;
  concern: ParsedField;
  existingUser: ParsedField<boolean | null>;
}

export type Eligibility =
  | { status: "first"; label: "First appointment" }
  | { status: "registered" | "redeemed"; label: "Registered" | "Redeemed"; history: Appointment[] }
  | { status: "blacklisted"; label: "Blacklisted"; entry: BlacklistEntry; history: Appointment[] };
