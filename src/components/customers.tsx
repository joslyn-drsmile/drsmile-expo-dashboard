"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Search, ShoppingBag, UserRoundSearch, UsersRound, X } from "lucide-react";
import type { AppData } from "@/lib/types";
import { displayPhone, formatDate, sourceBadgeTone, sourceName } from "@/lib/utils";
import { PageHeader } from "./dashboard";

export function Customers({ data }: { data: AppData }) {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase().replace(/[\s()+-]/g, "");
    return data.customers.map((customer) => {
      const appointments = data.appointments
        .filter((item) => item.customerId === customer.id)
        .sort((a, b) => (data.days.find((day) => day.id === b.dayId)?.date ?? "").localeCompare(data.days.find((day) => day.id === a.dayId)?.date ?? ""));
      return { customer, appointment: appointments[0] };
    }).filter(({ customer }) => {
      if (!needle) return true;
      return customer.name.toLowerCase().includes(needle)
        || customer.originalPhone.toLowerCase().replace(/[\s()+-]/g, "").includes(needle)
        || customer.normalizedPhone.includes(needle);
    });
  }, [data, search]);

  const attendedCustomers = data.customers.filter((customer) => data.appointments.some((item) => item.customerId === customer.id && item.attended)).length;
  const purchasedCustomers = data.customers.filter((customer) => data.appointments.some((item) => item.customerId === customer.id && item.purchased)).length;

  return <>
    <PageHeader eyebrow="Customer database" title="Leads / Customers" subtitle="Search every customer across all Expos by name or phone number." />
    <div className="customer-summary">
      <article><div className="summary-icon blue"><UsersRound /></div><div><strong>{data.customers.length}</strong><span>Total customers</span></div></article>
      <article><div className="summary-icon blue"><CheckCircle2 /></div><div><strong>{attendedCustomers}</strong><span>Attended</span></div></article>
      <article><div className="summary-icon blue"><ShoppingBag /></div><div><strong>{purchasedCustomers}</strong><span>Purchased</span></div></article>
    </div>
    <section className="panel customer-panel">
      <div className="customer-toolbar"><div className="search-box"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by customer name or phone number" />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X /></button>}</div><span>{rows.length} customers</span></div>
      {rows.length ? <div className="table-wrap customer-table-wrap"><table className="customer-table"><thead><tr><th>Customer</th><th>Platform Name</th><th>Phone</th><th>Registered Expo</th><th>Attendance Date</th><th>User</th><th>Source</th><th>Attended</th><th>Purchased</th></tr></thead><tbody>{rows.map(({ customer, appointment }) => {
        const expo = data.expos.find((item) => item.id === appointment?.expoId);
        const day = data.days.find((item) => item.id === appointment?.dayId);
        const source = appointment ? sourceName(data, appointment.sourceId) : "";
        return <tr key={customer.id}><td><div className="customer-name"><i>{customer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</i><div><strong>{customer.name}</strong><span>{customer.gender}</span></div></div></td><td>{appointment?.platformName || "—"}</td><td><a href={`tel:+${customer.normalizedPhone}`}>{displayPhone(customer.normalizedPhone)}</a></td><td>{expo?.name ?? "—"}</td><td>{day ? formatDate(day.date) : "—"}</td><td>{appointment ? <span className={`client-badge ${appointment.userType.toLowerCase()}`}>{appointment.userType}</span> : "—"}</td><td>{appointment ? <span className={`source-badge ${sourceBadgeTone(source)}`}>{source}</span> : "—"}</td><td>{appointment?.attended ? <CheckCircle2 className="yes-icon" /> : "—"}</td><td>{appointment?.purchased ? <CheckCircle2 className="yes-icon" /> : "—"}</td></tr>;
      })}</tbody></table></div> : <div className="empty-state"><UserRoundSearch /><h3>No customer found</h3><p>Try another name or phone number.</p></div>}
    </section>
  </>;
}
