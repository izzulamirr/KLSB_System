"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bdFetch, statusClass } from "./api";
import { formatPicString, getPicEmails } from "../../lib/picEmailMap";
import HighlightNumbers from "../HighlightNumbers";

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

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function BDDashboardPage() {
  const router = useRouter();
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
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const reminders = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayMs = 1000 * 60 * 60 * 24;
    const items = [];

    for (const row of rows) {
      // Outcome is already known once a proposal is Won/Lost — nothing left to remind about.
      const status = String(row.status || "").trim().toUpperCase();
      if (status === "WON" || status === "LOST") continue;

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
          proposalId: row.id,
          type: target.type,
          daysLeft,
          dueDate: targetDay,
          refNo: row.refNo || "-",
          title: row.titleProjectName || "-",
          client: row.client || "-",
          personInCharge: formatPicString(row.personInCharge) || "-",
          picEmails: getPicEmails(row.personInCharge),
          googleFolderLink: row.googleFolderLink || "",
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

  const latest = useMemo(() => [...rows].slice(0, 5), [rows]);

  return (
    <div className="space-y-6">
      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">{error}</section>
      )}

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
                  <th className="text-left px-3 py-2">PIC</th>
                  <th className="text-left px-3 py-2">Due Date</th>
                  <th className="text-left px-3 py-2">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-t border-slate-200 transition-colors hover:bg-slate-50"
                    onClick={() => router.push(`/bd/proposals/${item.proposalId}/edit`)}
                  >
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
                    <td className="px-3 py-2 text-slate-700">
                      {item.googleFolderLink ? (
                        <a
                          href={/^https?:\/\//i.test(item.googleFolderLink) ? item.googleFolderLink : `https://${item.googleFolderLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex rounded-md bg-blue-100 px-2 py-0.5 font-semibold text-blue-800 underline decoration-blue-500 decoration-2 underline-offset-2 shadow-sm transition-colors hover:bg-blue-200 hover:text-blue-900"
                        >
                          <HighlightNumbers text={item.refNo || "-"} />
                        </a>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-slate-700">
                          <HighlightNumbers text={item.refNo || "-"} />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700 max-w-[320px] truncate" title={item.title}>
                      {item.title}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{item.client}</td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{item.personInCharge}</td>
                    <td className="px-3 py-2 text-slate-700">{formatDisplayDate(item.dueDate)}</td>
                    <td className="px-3 py-2 text-slate-700 font-medium">
                      {item.daysLeft === 0 ? "Today" : `${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"}`}
                    </td>
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
                <th className="text-left px-3 py-2">PIC</th>
                <th className="text-left px-3 py-2">Maturation Days</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && latest.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No proposal data yet.
                  </td>
                </tr>
              ) : (
                latest.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200">
                    <td className="px-3 py-2 text-slate-700">
                      {item.googleFolderLink ? (
                        <a
                          href={/^https?:\/\//i.test(item.googleFolderLink) ? item.googleFolderLink : `https://${item.googleFolderLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-md bg-blue-100 px-2 py-0.5 font-semibold text-blue-800 underline decoration-blue-500 decoration-2 underline-offset-2 shadow-sm transition-colors hover:bg-blue-200 hover:text-blue-900"
                        >
                          <HighlightNumbers text={item.refNo || "-"} />
                        </a>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-slate-700">
                          <HighlightNumbers text={item.refNo || "-"} />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700 max-w-[300px] truncate" title={item.titleProjectName || ""}>
                      {item.titleProjectName || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{item.client || "-"}</td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{formatPicString(item.personInCharge) || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {(() => {
                        const targetDate = parseDateInput(item.maturityOnDate);
                        const submissionDate = parseDateInput(item.submissionDate);
                        if (!targetDate) return "-";
                        const dayMs = 1000 * 60 * 60 * 24;
                        const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
                        const today = new Date();
                        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

                        // If maturity already passed relative to today => show 0
                        if (startOfTarget <= startOfToday) return "0 days";

                        if (submissionDate) {
                          const startOfSubmission = new Date(submissionDate.getFullYear(), submissionDate.getMonth(), submissionDate.getDate());
                          const daysBetween = Math.ceil((startOfTarget - startOfSubmission) / dayMs);
                          return daysBetween <= 0 ? "0 days" : `${daysBetween} day${daysBetween === 1 ? "" : "s"}`;
                        }

                        const daysRemaining = Math.ceil((startOfTarget - startOfToday) / dayMs);
                        return daysRemaining <= 0 ? "0 days" : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
                      })()}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(item.status)}`}>
                        {item.status || "PENDING"}
                      </span>
                    </td>
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
