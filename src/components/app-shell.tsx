"use client";

import { useState } from "react";
import Image from "next/image";
import { Ban, CalendarRange, ChevronDown, Cloud, CloudOff, ContactRound, LayoutDashboard, LogOut, UsersRound } from "lucide-react";
import type { PageKey } from "@/lib/types";
import { useDashboardStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Dashboard } from "./dashboard";
import { Appointments } from "./appointments";
import { Expos } from "./expos";
import { Blacklist } from "./blacklist";
import { Customers } from "./customers";

const nav: Array<{ key: PageKey; label: string; icon: React.ReactNode }> = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
  { key: "appointments", label: "Appointments", icon: <UsersRound /> },
  { key: "customers", label: "Leads / Customers", icon: <ContactRound /> },
  { key: "expos", label: "Expos", icon: <CalendarRange /> },
  { key: "blacklist", label: "Blacklist", icon: <Ban /> },
];

const teamMembers = [
  { name: "Joslyn Oon", role: "Customer Service", initials: "JO" },
  { name: "Corrine", role: "After Sales", initials: "C" },
  { name: "Shina", role: "Admin / Customer Service", initials: "S" },
  { name: "Wen Yi", role: "Marketer", initials: "WY" },
];

export function AppShell({ userEmail }: { userEmail: string }) {
  const store = useDashboardStore();
  const [page, setPage] = useState<PageKey>("dashboard");
  const [expoId, setExpoId] = useState("expo-kl-2026-10");
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeMember, setActiveMember] = useState(teamMembers[0]);
  const logo = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/drsmile-logo.jpeg`;
  if (!store.hydrated) return <div className="loading-screen"><Image className="loading-logo" src={logo} alt="DRSMILE" width={220} height={127} priority /><span>Loading shared Expo data…</span></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><Image className="brand-logo" src={logo} alt="DRSMILE — From Yellow to Hello" width={200} height={116} priority /><span>Expo workspace</span></div>
      <nav>{nav.map((item) => <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => setPage(item.key)}>{item.icon}<span>{item.label}</span>{item.key === "appointments" && <i>{store.data.appointments.filter((row) => row.expoId === expoId && row.state === "Booked").length}</i>}</button>)}</nav>
      <div className="sidebar-foot"><div className={`local-mode ${store.cloudStatus === "error" ? "cloud-error" : ""}`}><span>{store.cloudStatus === "error" ? <CloudOff /> : <Cloud />} {store.cloudStatus === "error" ? "Sync needs attention" : "Cloud database"}</span><p>{store.cloudStatus === "error" ? "Working from this browser. Reload to retry." : "Changes are shared securely with your team."}</p></div></div>
    </aside>
    <main className="main-area">
      <div className="topbar"><div className="breadcrumbs"><span>DRSMILE</span><b>/</b><strong>{nav.find((item) => item.key === page)?.label}</strong></div><div className="profile-wrap"><button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}><span>{activeMember.initials}</span><div><strong>{activeMember.name}</strong><small>{activeMember.role}</small></div><ChevronDown /></button>{profileOpen && <div className="profile-menu team-menu"><div className="team-menu-head"><strong>Signed in</strong><p>{userEmail}</p></div>{teamMembers.map((member) => <button key={member.name} className={activeMember.name === member.name ? "active" : ""} onClick={() => { setActiveMember(member); setProfileOpen(false); }}><i>{member.initials}</i><span><strong>{member.name}</strong><small>{member.role}</small></span></button>)}<button className="signout-row" onClick={() => void supabase.auth.signOut()}><i><LogOut /></i><span><strong>Sign out</strong><small>Close this secure session</small></span></button></div>}</div></div>
      <div className="page-content">
        {page === "dashboard" && <Dashboard data={store.data} expoId={expoId} onExpoChange={setExpoId} onSaveMarketing={store.saveMarketing} />}
        {page === "appointments" && <Appointments data={store.data} expoId={expoId} onExpoChange={setExpoId} onToggle={store.toggleAppointment} onUpdate={store.updateAppointment} onUpdateDetails={store.updateAppointmentDetails} onCreate={store.createAppointment} onAddSource={store.addSource} />}
        {page === "customers" && <Customers data={store.data} />}
        {page === "expos" && <Expos data={store.data} onSave={store.saveExpo} onAddSlot={store.addTimeSlot} onDeleteSlot={store.deleteTimeSlot} />}
        {page === "blacklist" && <Blacklist data={store.data} onAdd={store.addBlacklist} onToggle={store.toggleBlacklist} />}
      </div>
    </main>
  </div>;
}
