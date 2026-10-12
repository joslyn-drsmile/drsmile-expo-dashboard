"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Mail, Plus, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "./dashboard";

type TeamRole = "admin" | "customer_service" | "after_sales" | "marketer" | "staff";
type TeamUser = { email: string; displayName: string; role: TeamRole; active: boolean; accountCreated: boolean; lastSignInAt: string | null };

const roleLabels: Record<TeamRole, string> = {
  admin: "Admin",
  customer_service: "Customer Service",
  after_sales: "After Sales",
  marketer: "Marketer",
  staff: "Staff",
};

export function UserManagement() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<TeamRole>("customer_service");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: requestError } = await supabase.functions.invoke("expo-admin-users", { body: { action: "list" } });
    if (requestError || data?.error) setError(data?.error ?? requestError?.message ?? "Unable to load users.");
    else setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const activeCount = useMemo(() => users.filter((user) => user.active).length, [users]);

  async function createUser() {
    setError("");
    setMessage("");
    if (!displayName.trim() || !email.trim() || password.length < 8) {
      setError("Name, email and a password with at least 8 characters are required.");
      return;
    }
    setSaving(true);
    const { data, error: requestError } = await supabase.functions.invoke("expo-admin-users", {
      body: { action: "create", displayName: displayName.trim(), email: email.trim().toLowerCase(), password, role },
    });
    setSaving(false);
    if (requestError || data?.error) {
      setError(data?.error ?? requestError?.message ?? "Unable to create this user.");
      return;
    }
    setDisplayName("");
    setEmail("");
    setPassword("");
    setRole("customer_service");
    setMessage("User created. They can sign in immediately with the email and password you set.");
    await loadUsers();
  }

  return <>
    <PageHeader eyebrow="Admin control" title="Users" subtitle="Create secure team logins and see who can access the Expo workspace." actions={<button className="button secondary" onClick={() => void loadUsers()} disabled={loading}><RefreshCw /> Refresh</button>} />
    <section className="user-summary">
      <article><div className="summary-icon blue"><UserRound /></div><div><strong>{users.length}</strong><span>Team accounts</span></div></article>
      <article><div className="summary-icon green"><ShieldCheck /></div><div><strong>{activeCount}</strong><span>Active access</span></div></article>
      <p><KeyRound /> Only the administrator can create accounts. Passwords are sent securely to Supabase and are never shown again or stored in this dashboard.</p>
    </section>
    <div className="user-layout">
      <section className="panel user-create-card">
        <div className="panel-heading"><div><h2>Create user</h2><p>Set the employee&apos;s first login details.</p></div><Plus /></div>
        <div className="form-stack">
          <label className="field"><span>Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="e.g. Corrine" /></label>
          <label className="field"><span>Email</span><div className="input-with-icon"><Mail /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></div></label>
          <label className="field"><span>Password <small>Minimum 8 characters</small></span><div className="input-with-icon"><KeyRound /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Create a secure password" /></div></label>
          <label className="field"><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as TeamRole)}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success"><CheckCircle2 /> {message}</div>}
          <button className="button primary full-button" disabled={saving} onClick={() => void createUser()}>{saving ? "Creating…" : "Create user & password"}</button>
        </div>
      </section>
      <section className="panel user-list-card">
        <div className="panel-heading"><div><h2>Team access</h2><p>Approved users in the shared database.</p></div></div>
        {loading ? <div className="empty-state"><RefreshCw /><h3>Loading users…</h3></div> : <div className="user-list">{users.map((user) => <article key={user.email}>
          <div className="avatar user-avatar">{user.displayName.split(" ").map((part) => part[0]).slice(0, 2).join("") || "U"}</div>
          <div><strong>{user.displayName || user.email}</strong><span>{user.email}</span></div>
          <div><span className="role-pill">{roleLabels[user.role] ?? user.role}</span><small>{user.accountCreated ? "Login ready" : "Pending account"}</small></div>
          <span className={`status-badge ${user.active ? "ongoing" : "inactive"}`}>{user.active ? "Active" : "Inactive"}</span>
        </article>)}{!users.length && <div className="empty-state"><UserRound /><h3>No users found</h3></div>}</div>}
      </section>
    </div>
  </>;
}
