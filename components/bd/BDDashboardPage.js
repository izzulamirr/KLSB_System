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

function getMaturationDays(maturityOnDate) {
  const targetDate = parseDateInput(maturityOnDate);
  if (!targetDate) return "-";

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const daysRemaining = Math.ceil((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) return "0 days";
  return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function CircularProgress({ percentage, label, color, count, total }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-slate-900">{percentage.toFixed(1)}%</p>
          <p className="text-xs text-slate-500">{count}/{total}</p>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-700">{label}</p>
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

  const latest = useMemo(() => {
    return [...rows].slice(0, 5);
  }, [rows]);

  const reminders = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayMs = 1000 * 60 * 60 * 24;
    const items = [];

    for (const row of rows) {
      const targets = [
        { type: "Submission", dateValue: row.submissionDate },
        { type: "Maturation", dateValue: row.maturityOnDate },
      ];

      for (const target of targets) {
        const targetDate = parseDateInput(target.dateValue);
        if (!targetDate) continue;

        const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const daysLeft = Math.ceil((targetDay - startOfToday) / dayMs);
        if (daysLeft < 0 || daysLeft > 7) continue;

        items.push({
          id: `${row.id}-${target.type}`,
          type: target.type,
          daysLeft,
          dueDate: targetDay,
          refNo: row.refNo || "-",
          title: row.titleProjectName || "-",
          client: row.client || "-",
        });
      }
    }

    return items.sort((a, b) => {
      if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
      return a.dueDate - b.dueDate;
    });
  }, [rows]);

  const reminderStats = useMemo(() => {
    const submission = reminders.filter((item) => item.type === "Submission").length;
    const maturation = reminders.filter((item) => item.type === "Maturation").length;
    return { submission, maturation };
  }, [reminders]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-7 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.24)]">
        <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-slate-200/90 mt-1">Business Development proposal summary.</p>
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

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 p-8 shadow-[0_12px_24px_rgba(16,185,129,0.08)] flex justify-center">
          <CircularProgress
            percentage={stats.total > 0 ? (stats.won / stats.total) * 100 : 0}
            label="Win Rate"
            color="#10b981"
            count={stats.won}
            total={stats.total}
          />
        </div>
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-white to-rose-50/50 p-8 shadow-[0_12px_24px_rgba(244,63,94,0.08)] flex justify-center">
          <CircularProgress
            percentage={stats.total > 0 ? (stats.lost / stats.total) * 100 : 0}
            label="Loss Rate"
            color="#f43f5e"
            count={stats.lost}
            total={stats.total}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800">Reminders</h3>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">Submission: {reminderStats.submission}</span>
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">Maturation: {reminderStats.maturation}</span>
          </div>
        </div>

        {reminders.length === 0 ? (
          <div className="py-6 text-sm text-slate-500 text-center">No reminders in the next 7 days.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-indigo-50 text-slate-500">
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Ref No</th>
                  <th className="text-left px-3 py-2">Title</th>
                  <th className="text-left px-3 py-2">Client</th>
                  <th className="text-left px-3 py-2">Due Date</th>
                  <th className="text-left px-3 py-2">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-3 py-2 text-slate-700">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.type === "Submission"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{item.refNo}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[320px] truncate" title={item.title}>{item.title}</td>
                    <td className="px-3 py-2 text-slate-700">{item.client}</td>
                    <td className="px-3 py-2 text-slate-700">{formatDisplayDate(item.dueDate)}</td>
                    <td className="px-3 py-2 text-slate-700 font-medium">{item.daysLeft === 0 ? "Today" : `${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                <th className="text-left px-3 py-2">Maturation Days</th>
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
                    <td className="px-3 py-2 text-slate-700">{getMaturationDays(item.maturityOnDate)}</td>
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
