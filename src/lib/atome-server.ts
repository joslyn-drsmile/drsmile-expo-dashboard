import "server-only";

const ATOME_BASE_URL = "https://portal.atome.my/api/v2";
const REQUEST_TIMEOUT_MS = 15_000;

type AtomeEnvelope<T> = { code?: string; message?: string; data?: T };

export type AtomePaymentLink = {
  paymentId: string;
  paymentLink: string;
  amountFormatted: string;
  expiryTimeFormatted: string;
  outletName: string;
};

export type AtomePaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "DISABLED";

export type AtomePaymentLinkDetail = AtomePaymentLink & {
  amount: number;
  status: AtomePaymentStatus;
  orderId: string;
  transactionId: string;
};

function requiredEnv(name: "ATOME_MERCHANT_USERNAME" | "ATOME_MERCHANT_PASSWORD" | "ATOME_OUTLET_ID") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Atome Payment Link is not configured yet.");
  return value;
}

async function readEnvelope<T>(response: Response): Promise<AtomeEnvelope<T>> {
  const body = await response.json().catch(() => null) as AtomeEnvelope<T> | null;
  if (!response.ok || !body || (body.code && body.code !== "SUCCESS")) {
    throw new Error(body?.message || "Atome could not complete this request.");
  }
  return body;
}

async function login() {
  const response = await fetch(`${ATOME_BASE_URL}/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "accept-language": "en" },
    body: JSON.stringify({
      username: requiredEnv("ATOME_MERCHANT_USERNAME"),
      password: requiredEnv("ATOME_MERCHANT_PASSWORD"),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  await readEnvelope(response);
  const cookies = response.headers.getSetCookie();
  if (!cookies.length) throw new Error("Atome sign-in did not return a secure session.");
  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

async function request<T>(path: string, cookie: string, init?: RequestInit) {
  const response = await fetch(`${ATOME_BASE_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en",
      cookie,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readEnvelope<T>(response);
}

export async function createAtomePaymentLink(amount: number, orderId?: string): Promise<AtomePaymentLink> {
  const outletId = requiredEnv("ATOME_OUTLET_ID");
  const cookie = await login();
  const expiry = await request<number | { expirationTime?: number; expiryTime?: number }>(
    `/payment/settings/${encodeURIComponent(outletId)}/current-expire-time`, cookie,
  );
  const rawExpiry = expiry.data;
  const expirationTime = typeof rawExpiry === "number" ? rawExpiry : rawExpiry?.expirationTime ?? rawExpiry?.expiryTime;
  if (!expirationTime || !Number.isFinite(expirationTime)) throw new Error("Atome did not return a valid link expiry time.");

  const result = await request<Partial<AtomePaymentLink> & { paymentUrl?: string }>("/payment", cookie, {
    method: "POST",
    body: JSON.stringify({ outletId, amount, expirationTime, currency: "MYR", ...(orderId ? { ecomOrderId: orderId } : {}) }),
  });
  const data = result.data;
  const paymentLink = data?.paymentLink || data?.paymentUrl;
  if (!data?.paymentId || !paymentLink) throw new Error("Atome created the request but did not return a payment link.");
  return {
    paymentId: data.paymentId,
    paymentLink,
    amountFormatted: data.amountFormatted || `RM ${amount.toFixed(2)}`,
    expiryTimeFormatted: data.expiryTimeFormatted || "12 hours",
    outletName: data.outletName || "DRSMILE WHITENING",
  };
}

function numericAmount(value: unknown, formatted: unknown) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  const parsed = Number(String(formatted ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function paymentStatus(value: unknown): AtomePaymentStatus {
  const status = String(value ?? "").toUpperCase();
  if (status === "PAID" || status === "FAILED" || status === "EXPIRED" || status === "DISABLED") return status;
  return "PENDING";
}

export async function fetchAtomePaymentLinkDetails(paymentIds: string[]): Promise<AtomePaymentLinkDetail[]> {
  if (!paymentIds.length) return [];
  const cookie = await login();
  const details: AtomePaymentLinkDetail[] = [];
  for (let offset = 0; offset < paymentIds.length; offset += 8) {
    const batch = paymentIds.slice(offset, offset + 8);
    const settled = await Promise.allSettled(batch.map(async (paymentId) => {
      const result = await request<Record<string, unknown>>(`/payment/${encodeURIComponent(paymentId)}`, cookie, { method: "POST" });
      const data = result.data ?? {};
      const amount = numericAmount(data.amount, data.amountFormatted);
      return {
        paymentId: String(data.paymentId || paymentId),
        paymentLink: String(data.paymentLink || data.paymentUrl || ""),
        amount,
        amountFormatted: String(data.amountFormatted || `${amount.toFixed(2)} MYR`),
        expiryTimeFormatted: String(data.expiryTimeFormatted || ""),
        outletName: String(data.outletName || "DRSMILE WHITENING"),
        status: paymentStatus(data.status),
        orderId: String(data.ecomOrderId || ""),
        transactionId: String(data.transactionId || ""),
      } satisfies AtomePaymentLinkDetail;
    }));
    details.push(...settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
  }
  if (!details.length) throw new Error("Atome did not return payment link status.");
  return details;
}
