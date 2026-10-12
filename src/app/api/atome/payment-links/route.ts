import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAtomePaymentLink, fetchAtomePaymentLinkDetails } from "@/lib/atome-server";

export const runtime = "nodejs";

const requestSchema = z.object({
  amount: z.number().finite().min(10, "Atome payment amount must be at least RM10.").max(100_000),
  orderId: z.string().trim().max(100).optional(),
});

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zdgkaablciltvvatfrju.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_Wj2kdAEPeKRKlx-fCMmL4Q_aTkbcvsH";
  return { url, key };
}

function paymentRecord(row: Record<string, unknown>) {
  return {
    paymentId: String(row.payment_id), paymentLink: String(row.payment_link ?? ""),
    amount: Number(row.amount ?? 0), currency: String(row.currency ?? "MYR"),
    orderId: String(row.order_id ?? ""), outletName: String(row.outlet_name ?? "DRSMILE WHITENING"),
    status: String(row.status ?? "PENDING"), transactionId: String(row.transaction_id ?? ""),
    expiryTimeFormatted: String(row.expiry_time_formatted ?? ""), createdByName: String(row.created_by_name ?? ""),
    createdAt: String(row.created_at), statusUpdatedAt: String(row.status_updated_at),
  };
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  try {
    const { url, key } = getSupabaseConfig();
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    const user = userData.user;
    if (userError || !user?.email) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

    const email = user.email.toLowerCase();
    const { data: allowed, error: accessError } = await client.from("expo_allowed_users")
      .select("display_name, active").eq("email", email).eq("active", true).maybeSingle();
    if (accessError || !allowed) return NextResponse.json({ error: "This account is not approved for payment links." }, { status: 403 });

    const { data: auditRows } = await client.from("expo_audit_logs")
      .select("record_id, actor_name, actor_email, created_at")
      .eq("entity", "atome_payment_link").eq("action", "create").order("created_at", { ascending: false }).limit(100);
    const { data: currentRows, error: readError } = await client.from("expo_atome_payment_links")
      .select("*").order("created_at", { ascending: false }).limit(100);
    if (readError) throw new Error("Unable to load tracked Atome links.");

    const existingIds = new Set((currentRows ?? []).map((row) => String(row.payment_id)));
    const missing = (auditRows ?? []).filter((row) => !existingIds.has(String(row.record_id)));
    if (missing.length) {
      await client.from("expo_atome_payment_links").insert(missing.map((row) => ({
        payment_id: String(row.record_id), created_by: user.id,
        created_by_name: String(row.actor_name || allowed.display_name || email.split("@")[0]),
        created_by_email: String(row.actor_email || email), created_at: String(row.created_at),
      })));
    }

    const { data: loadedRows, error: reloadError } = await client.from("expo_atome_payment_links")
      .select("*").order("created_at", { ascending: false }).limit(100);
    if (reloadError) throw new Error("Unable to load tracked Atome links.");
    let rows = loadedRows;

    let syncWarning = "";
    const refreshIds = (rows ?? []).filter((row) => row.status === "PENDING" || !row.payment_link).slice(0, 40).map((row) => String(row.payment_id));
    if (refreshIds.length) {
      try {
        const details = await fetchAtomePaymentLinkDetails(refreshIds);
        for (const detail of details) {
          const { error: updateError } = await client.from("expo_atome_payment_links").update({
            payment_link: detail.paymentLink, amount: detail.amount, order_id: detail.orderId,
            outlet_name: detail.outletName, status: detail.status, transaction_id: detail.transactionId,
            expiry_time_formatted: detail.expiryTimeFormatted, status_updated_at: new Date().toISOString(),
          }).eq("payment_id", detail.paymentId);
          if (updateError) throw updateError;
        }
        const refreshed = await client.from("expo_atome_payment_links").select("*").order("created_at", { ascending: false }).limit(100);
        if (!refreshed.error) rows = refreshed.data;
      } catch (syncError) {
        console.error("Atome status sync failed", syncError instanceof Error ? syncError.message : syncError);
        syncWarning = "Saved links are shown, but Atome status could not be refreshed right now.";
      }
    }
    return NextResponse.json({ payments: (rows ?? []).map((row) => paymentRecord(row)), syncWarning });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Atome payment links.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  try {
    const { url, key } = getSupabaseConfig();
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    const user = userData.user;
    if (userError || !user?.email) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });

    const email = user.email.toLowerCase();
    const { data: allowed, error: accessError } = await client.from("expo_allowed_users")
      .select("display_name, active").eq("email", email).eq("active", true).maybeSingle();
    if (accessError || !allowed) return NextResponse.json({ error: "This account is not approved for payment links." }, { status: 403 });

    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Enter a valid payment amount." }, { status: 400 });

    const orderId = parsed.data.orderId || undefined;
    const payment = await createAtomePaymentLink(parsed.data.amount, orderId);
    const { error: trackingError } = await client.from("expo_atome_payment_links").insert({
      payment_id: payment.paymentId, payment_link: payment.paymentLink, amount: parsed.data.amount,
      currency: "MYR", order_id: orderId ?? "", outlet_name: payment.outletName, status: "PENDING",
      expiry_time_formatted: payment.expiryTimeFormatted, created_by: user.id,
      created_by_name: String(allowed.display_name || email.split("@")[0]), created_by_email: email,
    });
    if (trackingError) throw new Error("Atome created the link, but the Dashboard could not save its tracking record. Please refresh and try again.");
    const summary = `Created Atome payment link ${payment.amountFormatted}${orderId ? ` · Order ID ${orderId}` : ""}`;
    const { error: auditError } = await client.from("expo_audit_logs").insert({
      id: `audit-atome-${crypto.randomUUID()}`,
      entity: "atome_payment_link", record_id: payment.paymentId, action: "create", summary,
      actor_id: user.id, actor_name: String(allowed.display_name || email.split("@")[0]), actor_email: email,
      created_at: new Date().toISOString(),
    });
    if (auditError) console.error("Atome payment link audit failed", auditError.code);
    return NextResponse.json({ payment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create an Atome payment link.";
    console.error("Atome payment link request failed", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
