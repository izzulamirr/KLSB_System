"use client";

import { useEffect, useMemo, useState } from "react";
import { bdFetch } from "./api";

function parseDateInput(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split("/").map(Number);
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function BDSummaryOverview() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setError("");
      try {
        const data = await bdFetch("/api/bd/proposals");
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Failed to load summary");
      }
    }

    load();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const won = rows.filter((row) => String(row.status || "").toUpperCase() === "WON").length;
    const lost = rows.filter((row) => String(row.status || "").toUpperCase() === "LOST").length;
    const pending = rows.filter((row) => String(row.status || "").toUpperCase() === "PENDING").length;

    let eligible = 0;
    let onTime = 0;
    for (const row of rows) {
      if (!row.submitted) continue;
      const submissionDate = parseDateInput(row.submissionDate);
      const deadlineDate = parseDateInput(row.deadline);
      if (!submissionDate || !deadlineDate) continue;

      eligible += 1;

      const submittedDay = new Date(submissionDate.getFullYear(), submissionDate.getMonth(), submissionDate.getDate());
      const deadlineDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
      if (submittedDay <= deadlineDay) {
        onTime += 1;
      }
    }

    const onTimePct = eligible > 0 ? (onTime / eligible) * 100 : 0;
    return { total, won, lost, pending, onTime, eligible, onTimePct };
  }, [rows]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-7 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.24)]">
        <h1 className="text-3xl font-semibold text-white">Analytics</h1>
        <p className="text-sm text-slate-200/90 mt-1">Business Development proposal analytics.</p>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">{error}</section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-100/70 p-5 shadow-[0_12px_24px_rgba(59,130,246,0.12)]">
          <p className="text-sm text-slate-500">Total Proposals</p>
          <p className="text-3xl font-semibold text-slate-900 mt-2">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-100/70 p-5 shadow-[0_12px_24px_rgba(245,158,11,0.12)]">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="text-3xl font-semibold text-amber-600 mt-2">{stats.pending}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-100/70 p-5 shadow-[0_12px_24px_rgba(16,185,129,0.12)]">
          <p className="text-sm text-slate-500">Won</p>
          <p className="text-3xl font-semibold text-emerald-600 mt-2">{stats.won}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-white to-rose-100/70 p-5 shadow-[0_12px_24px_rgba(244,63,94,0.12)]">
          <p className="text-sm text-slate-500">Lost</p>
          <p className="text-3xl font-semibold text-rose-600 mt-2">{stats.lost}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-100/70 p-5 shadow-[0_12px_24px_rgba(99,102,241,0.12)]">
          <p className="text-sm text-slate-500">On-Time Submission</p>
          <p className="text-3xl font-semibold text-indigo-600 mt-2">{stats.onTimePct.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-slate-500">{stats.onTime}/{stats.eligible} eligible proposals</p>
        </div>
      </section>

    </div>
  );
}