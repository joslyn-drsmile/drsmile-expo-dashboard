"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Ban, CalendarRange, ChevronDown, Cloud, CloudOff, ContactRound, LayoutDashboard, LogOut, PackageOpen, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import type { PageKey } from "@/lib/types";
import { useDashboardStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Dashboard } from "./dashboard";
import { Appointments } from "./appointments";
import { Expos } from "./expos";
import { Blacklist } from "./blacklist";
import { Customers } from "./customers";
import { UserManagement } from "./user-management";
import { Packages } from "./packages";
import { PaymentMethods } from "./payment-methods";

const nav: Array<{ key: PageKey; label: string; icon: React.ReactNode }> = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
  { key: "appointments", label: "Appointments", icon: <UsersRound /> },
  { key: "customers", label: "Leads / Customers", icon: <ContactRound /> },
  { key: "expos", label: "Expos", icon: <CalendarRange /> },
  { key: "packages", label: "Packages", icon: <PackageOpen /> },
  { key: "payments", label: "Payment Method", icon: <WalletCards /> },
  { key: "blacklist", label: "Blacklist", icon: <Ban /> },
  { key: "users", label: "Users", icon: <ShieldCheck /> },
];

const teamMembers = [
  { name: "Joslyn Oon", role: "Customer Service", initials: "JO" },
  { name: "Corrine", role: "After Sales", initials: "C" },
  { name: "Shina", role: "Admin / Customer Service", initials: "S" },
  { name: "Wen Yi", role: "Marketer", initials: "WY" },
];

export function AppShell({ userId, userEmail }: { userId: string; userEmail: string }) {
  const fallbackName = userEmail.split("@")[0] || "Team member";
  const [auditActor, setAuditActor] = useState({ id: userId, name: fallbackName, email: userEmail.toLowerCase() });
  const store = useDashboardStore(auditActor);
  const [page, setPageState] = useState<PageKey>(() => {
    if (typeof window === "undefined") return "dashboard";
    const saved = window.sessionStorage.getItem("drsmile-active-page") as PageKey | null;
    const allowed: PageKey[] = ["dashboard", "appointments", "customers", "expos", "packages", "payments", "blacklist", "users"];
    if (!saved || !allowed.includes(saved) || (saved === "users" && userEmail.toLowerCase() !== "joslyn.drsmile@gmail.com")) return "dashboard";
    return saved;
  });
  const [expoId, setExpoId] = useState("expo-kl-2026-10");
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeMember, setActiveMember] = useState(teamMembers[0]);
  const logo = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/drsmile-logo.jpeg`;
  const visibleNav = nav.filter((item) => item.key !== "users" || userEmail.toLowerCase() === "joslyn.drsmile@gmail.com");

  useEffect(() => {
    let active = true;
    supabase.from("expo_allowed_users").select("display_name, role").eq("email", userEmail.toLowerCase()).maybeSingle().then(({ data }) => {
      if (!active || !data) return;
      const name = data.display_name?.trim() || fallbackName;
      setAuditActor({ id: userId, name, email: userEmail.toLowerCase() });
      const known = teamMembers.find((member) => member.name.toLowerCase() === name.toLowerCase());
      if (known) setActiveMember(known);
      else setActiveMember({ name, role: String(data.role ?? "Team member").replaceAll("_", " "), initials: name.split(" ").map((part: string) => part[0]).slice(0, 2).join("").toUpperCase() });
    });
    return () => { active = false; };
  }, [fallbackName, userEmail, userId]);
  const setPage = (nextPage: PageKey) => {
    window.sessionStorage.setItem("drsmile-active-page", nextPage);
    setPageState(nextPage);
  };
  if (!store.hydrated) return <div className="loading-screen"><Image className="loading-logo" src={logo} alt="DRSMILE" width={220} height={127} priority /><span>Loading shared Expo data…</span></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><Image className="brand-logo" src={logo} alt="DRSMILE — From Yellow to Hello" width={200} height={116} priority /><span>Expo workspace</span></div>
      <nav>{visibleNav.map((item) => <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => setPage(item.key)}>{item.icon}<span>{item.label}</span>{item.key === "appointments" && <i>{store.data.appointments.filter((row) => row.expoId === expoId && row.state === "Booked").length}</i>}</button>)}</nav>
      <div className="sidebar-foot"><div className={`local-mode ${store.cloudStatus === "error" ? "cloud-error" : ""}`}><span>{store.cloudStatus === "error" ? <CloudOff /> : <Cloud />} {store.cloudStatus === "error" ? "Sync needs attention" : "Cloud database"}</span><p>{store.cloudStatus === "error" ? "Working from this browser. Reload to retry." : "Changes are shared securely with your team."}</p></div></div>
    </aside>
    <main className="main-area">
      <div className="topbar"><div className="breadcrumbs"><span>DRSMILE</span><b>/</b><strong>{nav.find((item) => item.key === page)?.label}</strong></div><div className="profile-wrap"><button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}><span>{activeMember.initials}</span><div><strong>{activeMember.name}</strong><small>{activeMember.role}</small></div><ChevronDown /></button>{profileOpen && <div className="profile-menu team-menu"><div className="team-menu-head"><strong>Signed in</strong><p>{userEmail}</p></div>{teamMembers.map((member) => <button key={member.name} className={activeMember.name === member.name ? "active" : ""} onClick={() => { setActiveMember(member); setProfileOpen(false); }}><i>{member.initials}</i><span><strong>{member.name}</strong><small>{member.role}</small></span></button>)}<button className="signout-row" onClick={() => void supabase.auth.signOut()}><i><LogOut /></i><span><strong>Sign out</strong><small>Close this secure session</small></span></button></div>}</div></div>
      <div className="page-content">
        {page === "dashboard" && <Dashboard data={store.data} expoId={expoId} onExpoChange={setExpoId} onOpenAppointments={(id) => { setExpoId(id); setPage("appointments"); }} onSaveMarketing={store.saveMarketing} />}
        {page === "appointments" && <Appointments data={store.data} expoId={expoId} onExpoChange={setExpoId} onToggle={store.toggleAppointment} onUpdate={store.updateAppointment} onUpdateDetails={store.updateAppointmentDetails} onDelete={store.deleteAppointment} onCreate={store.createAppointment} onAddSource={store.addSource} onAddBlacklist={store.addBlacklist} onToggleBlacklist={store.toggleBlacklist} />}
        {page === "customers" && <Customers data={store.data} />}
        {page === "expos" && <Expos data={store.data} onSave={store.saveExpo} onApplyTemplate={store.applySlotTemplate} onAddSlot={store.addTimeSlot} onDeleteSlot={store.deleteTimeSlot} onViewPackages={(id) => { setExpoId(id); setPage("packages"); }} />}
        {page === "packages" && <Packages data={store.data} expoId={expoId} onExpoChange={setExpoId} onCreate={store.createPackage} onUpdate={store.updatePackage} onDuplicate={store.duplicatePackage} onSetActive={store.setPackageActive} onReorder={store.reorderPackages} />}
        {page === "payments" && <PaymentMethods />}
        {page === "blacklist" && <Blacklist data={store.data} onAdd={store.addBlacklist} onToggle={store.toggleBlacklist} />}
        {page === "users" && <UserManagement />}
      </div>
    </main>
  </div>;
}
