"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, Copy, ExternalLink, Link2, LockKeyhole, Plus, ReceiptText, RefreshCw, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "./dashboard";

type PaymentResult = { paymentId: string; paymentLink: string; amountFormatted: string; expiryTimeFormatted: string; outletName: string };
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "DISABLED";
type TrackedPayment = {
  paymentId: string; paymentLink: string; amount: number; currency: string; orderId: string;
  outletName: string; status: PaymentStatus; transactionId: string; expiryTimeFormatted: string;
  createdByName: string; createdAt: string; statusUpdatedAt: string;
};

export function PaymentMethods() {
  const [amount, setAmount] = useState("");
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [payments, setPayments] = useState<TrackedPayment[]>([]);
  const [historyBusy, setHistoryBusy] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [syncWarning, setSyncWarning] = useState("");
  const [historyCopied, setHistoryCopied] = useState("");

  const loadPayments = useCallback(async () => {
    setHistoryBusy(true); setHistoryError(""); setSyncWarning("");
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (sessionError || !token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch("/api/atome/payment-links", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = await response.json().catch(() => null) as { payments?: TrackedPayment[]; syncWarning?: string; error?: string } | null;
      if (!response.ok || !body?.payments) throw new Error(body?.error || "Unable to load payment link status.");
      setPayments(body.payments); setSyncWarning(body.syncWarning || "");
    } catch (reason) {
      setHistoryError(reason instanceof Error ? reason.message : "Unable to load payment link status.");
    } finally { setHistoryBusy(false); }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void loadPayments(); });
    return () => window.cancelAnimationFrame(frame);
  }, [loadPayments]);

  async function generate() {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 10) return setError("Enter an amount of at least RM10.");
    setBusy(true); setError(""); setCopied(false);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (sessionError || !token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch("/api/atome/payment-links", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: numericAmount, orderId: orderId.trim() || undefined }),
      });
      const body = await response.json().catch(() => null) as { payment?: PaymentResult; error?: string } | null;
      if (!response.ok || !body?.payment) throw new Error(body?.error || "Unable to create payment link.");
      setResult(body.payment);
      void loadPayments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create payment link.");
    } finally { setBusy(false); }
  }

  async function copyLink() {
    if (!result) return;
    const message = `Pay ${result.amountFormatted} using Atome to ${result.outletName} by clicking on\n${result.paymentLink}`;
    await navigator.clipboard.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function createAnother() {
    setAmount(""); setOrderId(""); setResult(null); setError(""); setCopied(false);
  }

  async function copyTracked(payment: TrackedPayment) {
    if (!payment.paymentLink) return;
    await navigator.clipboard.writeText(`Pay ${payment.amount.toFixed(2)} MYR using Atome to ${payment.outletName} by clicking on\n${payment.paymentLink}`);
    setHistoryCopied(payment.paymentId);
    window.setTimeout(() => setHistoryCopied(""), 1800);
  }

  return <>
    <PageHeader eyebrow="Payments" title="Payment Method" subtitle="Create a secure customer payment link without leaving the dashboard." />
    <section className="payment-method-layout">
      <article className="panel payment-provider-card">
        <div className="payment-provider-head">
          <div className="atome-mark" role="img" aria-label="Atome" />
          <div><span className="payment-status"><i /> Connected</span><h2>Atome Payment Link</h2><p>DRSMILE WHITENING</p></div>
          <ShieldCheck className="payment-shield" />
        </div>
        <div className="payment-provider-facts">
          <span><WalletCards /><small>Currency</small><strong>MYR</strong></span>
          <span><ReceiptText /><small>Minimum</small><strong>RM10</strong></span>
          <span><Clock3 /><small>Valid for</small><strong>12 hours</strong></span>
        </div>
        <div className="payment-security-note"><LockKeyhole /><span><strong>Secure team access</strong><small>Atome credentials stay on the server and are never shown in this browser.</small></span></div>
      </article>

      <article className="panel payment-create-card">
        {!result ? <>
          <div className="payment-card-title"><span><Sparkles /></span><div><h2>Create payment link</h2><p>Enter the customer&apos;s payment amount. The link is ready to send immediately.</p></div></div>
          <div className="payment-form">
            <label className="payment-amount-field"><span>Payment amount</span><div><b>RM</b><input inputMode="decimal" autoFocus value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" onKeyDown={(event) => { if (event.key === "Enter") void generate(); }} /></div><small>Minimum RM10</small></label>
            <label><span>Order ID <i>Optional</i></span><div className="payment-input"><Link2 /><input value={orderId} onChange={(event) => setOrderId(event.target.value)} maxLength={100} placeholder="e.g. RSVP-1026-001" /></div><small>Use your invoice or appointment reference for easier tracking.</small></label>
          </div>
          {error && <div className="payment-error">{error}</div>}
          <button className="button primary payment-generate" disabled={busy} onClick={() => void generate()}>{busy ? <><span className="payment-spinner" /> Creating secure link…</> : <><Link2 /> Generate Atome link</>}</button>
        </> : <div className="payment-success">
          <span className="payment-success-icon"><Check /></span><span className="payment-success-kicker">Payment link ready</span>
          <h2>{result.amountFormatted}</h2><p>{result.outletName} · Expires {result.expiryTimeFormatted}</p>
          <div className="payment-share-copy"><p>Pay {result.amountFormatted} using Atome to {result.outletName} by clicking on</p><div className="payment-link-box"><Link2 /><span>{result.paymentLink}</span></div></div>
          <div className="payment-success-actions">
            <button className="button primary" onClick={() => void copyLink()}>{copied ? <><Check /> Message copied</> : <><Copy /> Copy payment message</>}</button>
            <a className="button secondary" href={result.paymentLink} target="_blank" rel="noreferrer"><ExternalLink /> Open link</a>
          </div>
          <button className="payment-another" onClick={createAnother}><Plus /> Create another payment link</button>
          <small className="payment-reference">Atome reference: {result.paymentId}</small>
        </div>}
      </article>
    </section>
    <section className="panel payment-history-card">
      <div className="payment-history-head"><div><span className="eyebrow">Dashboard links only</span><h2>Atome link status</h2><p>Only payment links created by your team from this Dashboard are tracked here.</p></div><button className="button secondary" disabled={historyBusy} onClick={() => void loadPayments()}><RefreshCw className={historyBusy ? "spinning" : ""} /> Refresh status</button></div>
      {syncWarning && <div className="payment-sync-warning">{syncWarning}</div>}
      {historyError ? <div className="payment-error">{historyError}</div> : historyBusy && !payments.length ? <div className="payment-history-empty"><span className="payment-spinner dark" /> Checking Atome status…</div> : !payments.length ? <div className="payment-history-empty">No Dashboard payment links yet.</div> : <div className="payment-history-list">
        <div className="payment-history-labels"><span>Amount</span><span>Order ID</span><span>Created by</span><span>Status</span><span>Link</span></div>
        {payments.map((payment) => <article className="payment-history-row" key={payment.paymentId}>
          <div data-label="Amount"><strong>{payment.amount.toFixed(2)} {payment.currency}</strong><small>{payment.paymentId}</small></div>
          <div data-label="Order ID"><span>{payment.orderId || "—"}</span></div>
          <div data-label="Created by"><span>{payment.createdByName || "Dashboard team"}</span><small>{new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(payment.createdAt))}</small></div>
          <div data-label="Status"><span className={`atome-status-badge ${payment.status.toLowerCase()}`}><i /> {payment.status.charAt(0) + payment.status.slice(1).toLowerCase()}</span><small>Checked {new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(payment.statusUpdatedAt))}</small></div>
          <div className="payment-history-actions" data-label="Link"><button disabled={!payment.paymentLink} onClick={() => void copyTracked(payment)}>{historyCopied === payment.paymentId ? <Check /> : <Copy />}<span>{historyCopied === payment.paymentId ? "Copied" : "Copy"}</span></button>{payment.paymentLink && <a href={payment.paymentLink} target="_blank" rel="noreferrer" aria-label="Open Atome payment link"><ExternalLink /></a>}</div>
        </article>)}
      </div>}
    </section>
  </>;
}
