"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AppShell } from "./app-shell";

export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [accessChecking, setAccessChecking] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const sessionUserIdRef = useRef<string | null>(null);
  const sessionUserId = session?.user.id ?? null;
  const sessionAccessToken = session?.access_token ?? null;

  useEffect(() => {
    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      const userChanged = sessionUserIdRef.current !== nextUserId;
      sessionUserIdRef.current = nextUserId;
      setSession(nextSession);
      if (userChanged) {
        setAccessChecking(Boolean(nextSession));
        if (!nextSession) setHasAccess(false);
      }
      setChecking(false);
    };
    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionUserId || !sessionAccessToken) return;
    let active = true;
    supabase.rpc("expo_has_access").then(async ({ data, error }) => {
      if (!active) return;
      let access = data;
      let accessError = error;
      if (accessError) {
        // A tab returning from the background can briefly hold an expired token.
        // Refresh it and retry without treating a temporary token error as access denial.
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!active) return;
        if (!refreshError) {
          const retry = await supabase.rpc("expo_has_access");
          if (!active) return;
          access = retry.data;
          accessError = retry.error;
        }
      }
      setHasAccess(!accessError && access === true);
      setAccessChecking(false);
    });
    return () => { active = false; };
  }, [sessionUserId, sessionAccessToken]);

  async function submit() {
    if (!email.trim() || password.length < 8) {
      setMessage("Enter your email and a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    setMessage("");
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
  }

  if (checking || accessChecking) return <div className="auth-loading">Opening your secure workspace…</div>;
  if (session && hasAccess) return <AppShell userId={session.user.id} userEmail={session.user.email ?? "Team member"} />;
  if (session) return <main className="auth-screen">
    <section className="auth-card">
      <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/drsmile-logo.jpeg`} alt="DRSMILE" width={170} height={99} priority />
      <span className="auth-kicker"><ShieldCheck /> Team access required</span>
      <h1>Account not approved</h1>
      <p>{session.user.email} is signed in, but it is not on the DRSMILE Expo team list.</p>
      <button className="button primary auth-primary" onClick={() => void supabase.auth.signOut()}>Use another account</button>
      <small>Ask the dashboard owner to add this email before signing in again.</small>
    </section>
  </main>;

  return <main className="auth-screen">
    <section className="auth-card">
      <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/drsmile-logo.jpeg`} alt="DRSMILE" width={170} height={99} priority />
      <span className="auth-kicker"><ShieldCheck /> Secure team workspace</span>
      <h1>Expo Dashboard</h1>
      <p>Sign in to view appointments and update the shared customer database.</p>
      <label><span>Email</span><div><Mail /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@drsmile.com" autoComplete="email" /></div></label>
      <label><span>Password</span><div><LockKeyhole /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete="current-password" onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} /></div></label>
      {message && <div className="auth-message">{message}</div>}
      <button className="button primary auth-primary" disabled={busy} onClick={() => void submit()}>{busy ? "Please wait…" : "Sign in"}</button>
      <p className="auth-help">Need an account? Ask the dashboard administrator to create one for you.</p>
      <small>Customer information is protected by account access and database security rules.</small>
    </section>
  </main>;
}
