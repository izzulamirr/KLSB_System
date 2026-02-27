"use client";

import { useEffect, useMemo, useState } from "react";
import { bdFetch, formatCurrency } from "./api";

function Donut({ label, count, colorClass }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-sm font-semibold text-slate-600 mb-3 tracking-wide">{label}</p>
      <div className={`h-32 w-32 rounded-full border-[7px] border-slate-200 ${colorClass} grid place-items-center bg-white shadow-inner`}>
        <span className="text-4xl font-semibold text-slate-800">{count}</span>
      </div>
    </div>
  );
}

export default function BDDashboardPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setError("");
      setLoading(true);
      try {
        const data = await bdFetch("/api/bd/proposals");
        setRows(data);
      } catch (err) {
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const won = rows.filter((row) => String(row.status || "").toUpperCase() === "WON").length;
    const lost = rows.filter((row) => String(row.status || "").toUpperCase() === "LOST").length;
    const pending = rows.filter((row) => String(row.status || "").toUpperCase() === "PENDING").length;
    const value = rows.reduce((sum, row) => sum + Number(row.valueRM || 0), 0);
    return { total, won, lost, pending, value };
  }, [rows]);

  const latest = useMemo(() => {
    return [...rows].slice(0, 8);
  }, [rows]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 px-7 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.30)]">
        <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
        <p className="text-3xl font-semibold text-white">Dashboard</p>
        <p className="text-sm text-blue-100/90 mt-1">Business Development proposal summary.</p>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">{error}</section>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-100/70 p-5 shadow-[0_14px_28px_rgba(59,130,246,0.14)]">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Proposals</p>
          <p className="text-3xl font-semibold text-slate-900 mt-2">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-100/70 p-5 shadow-[0_14px_28px_rgba(245,158,11,0.14)]">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Pending</p>
          <p className="text-3xl font-semibold text-amber-600 mt-2">{stats.pending}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-100/70 p-5 shadow-[0_14px_28px_rgba(16,185,129,0.14)]">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Won</p>
          <p className="text-3xl font-semibold text-emerald-600 mt-2">{stats.won}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-100/70 p-5 shadow-[0_14px_28px_rgba(139,92,246,0.14)]">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Value</p>
          <p className="text-lg font-semibold text-slate-900 mt-2">{formatCurrency(stats.value)}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Proposal Status Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Donut label="PENDING" count={stats.pending} colorClass="border-t-amber-500 border-r-amber-500" />
          <Donut label="WON" count={stats.won} colorClass="border-t-emerald-500 border-r-emerald-500" />
          <Donut label="LOST" count={stats.lost} colorClass="border-t-rose-500 border-r-rose-500" />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800">Latest Proposals</h3>
          {loading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-blue-50 text-slate-500">
                <th className="text-left px-3 py-2">Ref No</th>
                <th className="text-left px-3 py-2">Title</th>
                <th className="text-left px-3 py-2">Client</th>
                <th className="text-left px-3 py-2">Value</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && latest.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">No proposal data yet.</td>
                </tr>
              ) : (
                latest.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-3 py-2 text-slate-700">{item.refNo || "-"}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[300px] truncate" title={item.titleProjectName || ""}>{item.titleProjectName || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{item.client || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{formatCurrency(item.valueRM)}</td>
                    <td className="px-3 py-2 text-slate-700">{item.status || "PENDING"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
