"use client";

import { useEffect, useMemo, useState } from "react";
import { bdFetch } from "./api";
import { formatPicString } from "../../lib/picEmailMap";
import BDSummaryOverview from "./BDSummaryOverview";
import { deriveProposalYear } from "./proposalFormHelpers";

export default function BDScopeBreakdownPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedScope, setSelectedScope] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState("");

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

  const yearOptions = useMemo(() => {
    const years = new Set(rows.map((row) => deriveProposalYear(row)));
    return Array.from(years).sort((a, b) => b - a);
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!selectedYear) return rows;
    return rows.filter((row) => deriveProposalYear(row) === Number(selectedYear));
  }, [rows, selectedYear]);

  const distribution = useMemo(() => {
    const grouped = filteredRows.reduce((acc, row) => {
      const scope = String(row.scopeBusiness || "Unspecified").trim() || "Unspecified";
      acc[scope] = (acc[scope] || 0) + 1;
      return acc;
    }, {});

    const sorted = Object.entries(grouped)
      .map(([scope, count]) => ({ scope, count }))
      .sort((a, b) => b.count - a.count);

    const total = filteredRows.length;
    return sorted.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  }, [filteredRows]);

  const totalWinning = useMemo(() => {
    return filteredRows.reduce((sum, r) => {
      if (!r || String((r.status || "")).toUpperCase() !== "WON") return sum;
      const val = Number(r.valueRM || 0);
      return sum + (Number.isNaN(val) ? 0 : val);
    }, 0);
  }, [filteredRows]);

  const formattedTotalWinning = useMemo(() => {
    try {
      return totalWinning.toLocaleString("en-MY", { style: "currency", currency: "MYR" });
    } catch {
      return `RM ${totalWinning}`;
    }
  }, [totalWinning]);

  const topScope = distribution[0] || null;

  useEffect(() => {
    if (!selectedScope && topScope?.scope) {
      setSelectedScope(topScope.scope);
    }
  }, [selectedScope, topScope]);

  useEffect(() => {
    if (!isModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  const selectedScopeData = useMemo(() => {
    if (!selectedScope) return null;
    return distribution.find((item) => item.scope === selectedScope) || null;
  }, [distribution, selectedScope]);

  const selectedProposals = useMemo(() => {
    if (!selectedScope) return [];
    return filteredRows.filter((row) => (String(row.scopeBusiness || "Unspecified").trim() || "Unspecified") === selectedScope);
  }, [filteredRows, selectedScope]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <label className="text-sm text-slate-700">
          <span className="mb-1 block">Year</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full min-w-[140px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All years</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      <BDSummaryOverview rows={filteredRows} error={error} />

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">{error}</section>
      )}

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Scope mix</div>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">Business Scope Summary</h3>
            <p className="mt-1 text-sm text-slate-500">A quick view of where the proposals are concentrated.</p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            {filteredRows.length} total proposals
          </div>
        </div>

        {loading ? (
          <div className="py-6 text-sm text-slate-500 text-center">Loading scope data...</div>
        ) : distribution.length === 0 ? (
          <div className="py-6 text-sm text-slate-500 text-center">No scope data yet.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {distribution.map((item) => (
              <button
                key={item.scope}
                type="button"
                onClick={() => {
                  setSelectedScope(item.scope);
                  setIsModalOpen(true);
                }}
                className={
                  "group relative overflow-hidden rounded-2xl border p-5 text-left shadow-[0_12px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 " +
                  (selectedScope === item.scope
                    ? "border-indigo-300 bg-gradient-to-br from-indigo-50 via-white to-sky-50 shadow-[0_14px_28px_rgba(79,70,229,0.12)]"
                    : "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/70")
                }
              >
                <div className="absolute right-0 top-0 h-16 w-16 translate-x-6 -translate-y-6 rounded-full bg-indigo-500/10 blur-2xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Rank {distribution.findIndex((entry) => entry.scope === item.scope) + 1}
                    </div>
                    <h4 className="mt-2 text-lg font-semibold text-slate-900">{item.scope}</h4>
                    <p className="mt-1 text-sm text-slate-500">Share of the proposal mix</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right shadow-sm">
                    <div className="text-xs text-slate-500">{item.percentage}%</div>
                    <div className="text-lg font-semibold text-slate-900">{item.count}</div>
                  </div>
                </div>
                <div className="relative mt-5 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    {item.count} proposals
                  </span>
                  <span className="font-medium text-slate-400">of {filteredRows.length} total</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {isModalOpen && selectedScopeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close proposal modal"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            onClick={() => setIsModalOpen(false)}
          />

          <section className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Scope detail</div>
                  <h3 className="mt-2 text-2xl font-semibold">{selectedScopeData.scope}</h3>
                  <p className="mt-1 text-sm text-slate-200">
                    {selectedScopeData.count} proposal{selectedScopeData.count === 1 ? "" : "s"} in this scope.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/15"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              {selectedProposals.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No proposals found for this scope.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500">
                        <th className="px-4 py-3 text-left font-medium">Ref No</th>
                        <th className="px-4 py-3 text-left font-medium">Title / Project</th>
                        <th className="px-4 py-3 text-left font-medium">Client</th>
                        <th className="px-4 py-3 text-left font-medium">PIC</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {selectedProposals.map((item) => (
                        <tr key={item.id || `${item.refNo}-${item.titleProjectName}`} className="text-slate-700">
                          <td className="px-4 py-3 whitespace-nowrap">{item.refNo || "-"}</td>
                          <td className="px-4 py-3 max-w-[360px] truncate" title={item.titleProjectName || ""}>
                            {item.titleProjectName || "-"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{item.client || "-"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatPicString(item.personInCharge) || "-"}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {item.status || "PENDING"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
