"use client";

import { useEffect, useMemo, useState } from "react";
import { bdFetch } from "./api";

export default function BDScopeBreakdownPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setError("");
      setLoading(true);
      try {
        const data = await bdFetch("/api/bd/proposals");
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Failed to load scope breakdown");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const distribution = useMemo(() => {
    const grouped = rows.reduce((acc, row) => {
      const scope = String(row.scopeBusiness || "Unspecified").trim() || "Unspecified";
      acc[scope] = (acc[scope] || 0) + 1;
      return acc;
    }, {});

    const sorted = Object.entries(grouped)
      .map(([scope, count]) => ({ scope, count }))
      .sort((a, b) => b.count - a.count);

    const total = rows.length;
    return sorted.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  }, [rows]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-7 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.24)]">
        <h1 className="text-3xl font-semibold text-white">Summary</h1>
        <p className="text-sm text-slate-200/90 mt-1">Proposal distribution by scope.</p>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">{error}</section>
      )}

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800">Business Scope Summary</h3>
          <span className="text-xs text-slate-500">{rows.length} total</span>
        </div>

        {loading ? (
          <div className="py-6 text-sm text-slate-500 text-center">Loading scope data...</div>
        ) : distribution.length === 0 ? (
          <div className="py-6 text-sm text-slate-500 text-center">No scope data yet.</div>
        ) : (
          <div className="space-y-4">
            {distribution.map((item) => (
              <div key={item.scope} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm text-slate-700">
                  <span className="font-medium">{item.scope}</span>
                  <span className="text-slate-500">{item.count} ({item.percentage}%)</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
