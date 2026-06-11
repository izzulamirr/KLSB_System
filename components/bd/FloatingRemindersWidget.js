"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase";
import { withBasePath } from "../../lib/apiPath";
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

export default function FloatingRemindersWidget() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAvailable(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const idToken = await user.getIdToken();
        const response = await fetch(withBasePath("/api/bd/proposals"), {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!response.ok) {
          setAvailable(false);
          setLoading(false);
          return;
        }

        const data = await response.json();
        setRows(Array.isArray(data) ? data : []);
        setAvailable(true);
      } catch {
        setAvailable(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

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
          personInCharge: formatPicString(row.personInCharge) || "-",
          picEmails: getPicEmails(row.personInCharge),
        });
      }
    }

    return items.sort((a, b) => {
      if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
      return a.dueDate - b.dueDate;
    });
  }, [rows]);

  if (!available) return null;

  const preview = reminders.slice(0, 5);

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="relative grid h-12 w-12 place-items-center rounded-full border border-indigo-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_14px_26px_rgba(37,99,235,0.32)]"
          aria-label="Open reminders"
          title="Reminders"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
            <path d="M9 17a3 3 0 0 0 6 0" />
          </svg>

          <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full border border-white bg-rose-500 px-1 text-center text-[11px] font-semibold leading-5 text-white">
            {reminders.length}
          </span>
        </button>
      ) : (
        <div className="w-[360px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h4 className="text-sm font-semibold text-slate-800">Reminders</h4>
            <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-slate-700">
              Close
            </button>
          </div>

          <div className="max-h-80 overflow-auto px-4 py-3 space-y-2">
            {loading ? (
              <p className="text-sm text-slate-500">Loading reminders...</p>
            ) : preview.length === 0 ? (
              <p className="text-sm text-slate-500">No reminders in next 7 days.</p>
            ) : (
              preview.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        item.type === "Submission" ? "bg-blue-100 text-blue-700" : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-xs font-medium text-slate-600">{item.daysLeft === 0 ? "Today" : `${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"}`}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800 truncate" title={item.title}>
                    <HighlightNumbers text={item.refNo} /> - {item.title}
                  </p>
                  <p className="text-xs text-slate-500">Due: {formatDisplayDate(item.dueDate)}</p>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-200 px-4 py-2">
            <Link href="/bd" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              View full reminder list in dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
