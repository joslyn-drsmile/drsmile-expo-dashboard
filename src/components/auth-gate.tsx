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

  if (checking) return <div className="auth-loading">Opening your secure workspace…</div>;
  if (session) return <AppShell userEmail={session.user.email ?? "Team member"} />;

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
