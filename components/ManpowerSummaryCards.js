"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "../lib/apiPath";
import { effectiveStatusColor } from "../lib/manpowerStatus";

function buildSummary(rows) {
  const total = rows.length;
  const statusCounts = rows.reduce(
    (acc, row) => {
      const status = String(effectiveStatusColor(row)).toLowerCase();
      if (status.includes("active") || status.includes("ongoing")) acc.active += 1;
      else if (status.includes("pending")) acc.pending += 1;
      else if (status.includes("completed") || status.includes("terminated")) acc.closed += 1;
      return acc;
    },
    { active: 0, pending: 0, closed: 0 }
  );

  return { total, ...statusCounts };
}

function buildSummaryUrl({ poFilter, companyFilter }) {
  const params = new URLSearchParams({ summary: "1" });
  if (poFilter) params.set("po", String(poFilter));
  if (companyFilter) params.set("location", String(companyFilter));
  return withBasePath(`/api/manpower?${params.toString()}`);
}

export default function ManpowerSummaryCards({ poFilter = null, companyFilter = null, initialRows = [] }) {
  const [summary, setSummary] = useState(() => buildSummary(Array.isArray(initialRows) ? initialRows : []));

  const refreshSummary = useCallback(async () => {
    try {
      const res = await fetch(buildSummaryUrl({ poFilter, companyFilter }), { cache: "no-store" });
      if (!res.ok) throw new Error(`Summary request failed: ${res.status}`);
      const json = await res.json().catch(() => ({}));
      setSummary({
        total: Number(json?.total || 0),
        active: Number(json?.active || 0),
        pending: Number(json?.pending || 0),
        closed: Number(json?.closed || 0),
      });
    } catch (error) {
      console.error("Failed to load manpower summary:", error);
    }
  }, [poFilter, companyFilter]);

  useEffect(() => {
    refreshSummary();

    const handleRefresh = () => refreshSummary();
    const interval = setInterval(refreshSummary, 10000);

    window.addEventListener("manpower-summary-refresh", handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("manpower-summary-refresh", handleRefresh);
    };
  }, [refreshSummary]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Staff</div>
        <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.total}</div>
      </div>
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 px-4 py-3 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Active</div>
        <div className="mt-1 text-2xl font-semibold text-emerald-800 dark:text-emerald-300">{summary.active}</div>
      </div>
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 px-4 py-3 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400">Pending</div>
        <div className="mt-1 text-2xl font-semibold text-amber-800 dark:text-amber-300">{summary.pending}</div>
      </div>
      <div className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-3 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Closed</div>
        <div className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">{summary.closed}</div>
      </div>
    </div>
  );
}