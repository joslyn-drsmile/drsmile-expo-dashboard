"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setChecking(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setHasAccess(false);
      setAccessChecking(false);
      return;
    }
    let active = true;
    setAccessChecking(true);
    supabase.rpc("expo_has_access").then(({ data, error }) => {
      if (!active) return;
      setHasAccess(!error && data === true);
      setAccessChecking(false);
    });
    return () => { active = false; };
  }, [session]);

  async function submit(mode: "signin" | "signup") {
    if (!email.trim() || password.length < 6) {
      setMessage("Enter your email and a password with at least 6 characters.");
      return;
    }
    setBusy(true);
    setMessage("");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("Account created. Check your email to confirm, then sign in.");
  }

  if (checking || accessChecking) return <div className="auth-loading">Opening your secure workspace…</div>;
  if (session && hasAccess) return <AppShell userEmail={session.user.email ?? "Team member"} />;
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
      <label><span>Password</span><div><LockKeyhole /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete="current-password" onKeyDown={(event) => { if (event.key === "Enter") void submit("signin"); }} /></div></label>
      {message && <div className="auth-message">{message}</div>}
      <button className="button primary auth-primary" disabled={busy} onClick={() => void submit("signin")}>{busy ? "Please wait…" : "Sign in"}</button>
      <button className="auth-create" disabled={busy} onClick={() => void submit("signup")}>Create first team account</button>
      <small>Customer information is protected by account access and database security rules.</small>
    </section>
  </main>;
}
