"use client";

import { useEffect, useMemo, useState } from "react";
import { bdFetch } from "./api";
import { useRouter } from "next/navigation";
import { formatPicString } from "../../lib/picEmailMap";

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

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function normalizeStatus(status) {
  return String(status || "PENDING").trim().toUpperCase() || "PENDING";
}

// Kept in sync with BD_STATUS_OPTIONS (components/bd/options.js) — every
// status in that list should have an explicit case here instead of falling
// back to the generic slate color.
function getOutcomeColor(status) {
  if (status === "WON") return "from-emerald-500 to-lime-400";
  if (status === "LOST") return "from-rose-500 to-red-400";
  if (status === "DECLINED") return "from-slate-500 to-slate-400";
  if (status === "PENDING") return "from-indigo-500 to-indigo-400";
  if (status === "ON-GOING") return "from-blue-500 to-sky-400";
  if (status === "CANCELLED") return "from-slate-500 to-slate-400";
  return "from-slate-400 to-slate-300";
}

function getOutcomeSoftColor(status) {
  if (status === "WON") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "LOST") return "bg-rose-100 text-rose-700 border-rose-200";
  if (status === "DECLINED") return "bg-slate-100 text-slate-700 border-slate-200";
  if (status === "PENDING") return "bg-indigo-100 text-indigo-700 border-indigo-200";
  if (status === "ON-GOING") return "bg-blue-100 text-blue-700 border-blue-200";
  if (status === "CANCELLED") return "bg-slate-200 text-slate-700 border-slate-300";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function MiniMetric({ label, value, tone, note }) {
  return (
    <div
      role={"button"}
      tabIndex={0}
      className={`rounded-2xl border p-4 shadow-[0_12px_24px_rgba(15,23,42,0.08)] ${tone}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      {note ? <div className="mt-1 text-xs text-slate-500">{note}</div> : null}
    </div>
  );
}

// Accepts optional `rows`/`error` props so a parent that already fetched
// proposals (e.g. BDScopeBreakdownPage) can pass them down instead of this
// component re-fetching the same collection. Falls back to fetching its own
// data when used standalone (no `rows` prop supplied).
export default function BDSummaryOverview({ rows: rowsProp, error: errorProp } = {}) {
  const [internalRows, setInternalRows] = useState([]);
  const [internalError, setInternalError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalRows, setModalRows] = useState([]);
  const router = useRouter();

  const hasRowsProp = rowsProp !== undefined;
  const rows = hasRowsProp ? rowsProp : internalRows;
  const error = hasRowsProp ? errorProp || "" : internalError;

  useEffect(() => {
    if (hasRowsProp) return;

    async function load() {
      setInternalError("");
      try {
        const data = await bdFetch("/api/bd/proposals");
        setInternalRows(Array.isArray(data) ? data : []);
      } catch (err) {
        setInternalError(err.message || "Failed to load summary");
      }
    }

    load();
  }, [hasRowsProp]);

  const analytics = useMemo(() => {
    const total = rows.length;
    const statusOrder = ["WON", "LOST", "DECLINED", "ON-GOING", "SUBMITTED", "PENDING"];
    const statusLabels = {
      WON: "Won",
      LOST: "Lost",
      DECLINED: "Declined",
      "ON-GOING": "Submitted",
      SUBMITTED: "Submitted",
      PENDING: "Pending",
    };

    const counts = {
      WON: 0,
      LOST: 0,
      DECLINED: 0,
      "ON-GOING": 0,
      SUBMITTED: 0,
      PENDING: 0,
      OTHER: 0,
    };
    const valueByStatus = {
      WON: 0,
      LOST: 0,
      DECLINED: 0,
      "ON-GOING": 0,
      SUBMITTED: 0,
      PENDING: 0,
      OTHER: 0,
    };
    const onTimeByStatus = {
      WON: { onTime: 0, late: 0 },
      LOST: { onTime: 0, late: 0 },
      DECLINED: { onTime: 0, late: 0 },
      "ON-GOING": { onTime: 0, late: 0 },
      SUBMITTED: { onTime: 0, late: 0 },
      PENDING: { onTime: 0, late: 0 },
      OTHER: { onTime: 0, late: 0 },
    };
    const scopeCounts = {};

    let submitted = 0;
    let onTime = 0;
    let late = 0;

    for (const row of rows) {
      const status = normalizeStatus(row.status);
      const submissionDate = parseDateInput(row.submissionDate);
      const deadlineDate = parseDateInput(row.deadline || row.maturityOnDate);
      const value = Number(row.valueRM || 0);
      const scope = String(row.scopeBusiness || "Unspecified").trim() || "Unspecified";

      if (status in counts) counts[status] += 1;
      else counts.OTHER += 1;

      if (!Number.isNaN(value)) {
        if (status in valueByStatus) valueByStatus[status] += value;
        else valueByStatus.OTHER += value;
      }

      if (status === "ON-GOING") submitted += 1;

      scopeCounts[scope] = (scopeCounts[scope] || 0) + 1;

      if (submissionDate && deadlineDate) {
        const submittedDay = new Date(submissionDate.getFullYear(), submissionDate.getMonth(), submissionDate.getDate());
        const deadlineDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
        const isOnTime = submittedDay <= deadlineDay;

        if (isOnTime) onTime += 1;
        else late += 1;

        const bucket = onTimeByStatus[status] || onTimeByStatus.OTHER;
        if (isOnTime) bucket.onTime += 1;
        else bucket.late += 1;
      }
    }

    const unsubmitted = total - submitted;
    const pendingCount = counts.PENDING || 0;
    const onTimeStatus = {
      onTime,
      late,
      notSubmitted: unsubmitted,
      total: total || 1,
    };

    const outcomeSegments = statusOrder
      .filter((status) => status !== "ON-GOING") // Filter out ON-GOING as we use SUBMITTED for pie chart
      .map((status) => {
        if (status === "SUBMITTED") {
          return {
            status,
            label: statusLabels[status],
            count: submitted > 0 ? submitted : counts[status],
            value: valueByStatus[status],
          };
        }
        return {
          status,
          label: statusLabels[status],
          count: counts[status],
          value: valueByStatus[status],
        };
      })
      .filter((item) => item.count > 0);

    // Ensure SUBMITTED always appears if there are submitted proposals
    if (submitted > 0 && !outcomeSegments.find((item) => item.status === "SUBMITTED")) {
      outcomeSegments.push({
        status: "SUBMITTED",
        label: "Submitted",
        count: submitted,
        value: 0,
      });
    }

    const valueSegments = statusOrder
      .filter((status) => status !== "ON-GOING" && status !== "PENDING") // Exclude ON-GOING and PENDING from value profile
      .map((status) => ({
        status,
        label: statusLabels[status],
        value: valueByStatus[status],
      }))
      .filter((item) => item.value > 0 || ["WON", "LOST", "DECLINED"].includes(item.status));

    const scopeSegments = Object.entries(scopeCounts)
      .map(([scope, count]) => ({ scope, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const onTimeSegments = [
      { label: "On-Time", value: onTimeStatus.onTime, tone: "bg-blue-500" },
      { label: "Late", value: onTimeStatus.late, tone: "bg-rose-500" },
      { label: "Not Submitted", value: onTimeStatus.notSubmitted, tone: "bg-amber-400" },
    ].filter((item) => item.value > 0);

    const totalValue = valueSegments.reduce((sum, item) => sum + item.value, 0);
    const totalOnTimeEligible = onTime + late;

    return {
      total,
      submitted,
      unsubmitted,
      pending: pendingCount,
      counts,
      outcomeSegments,
      valueSegments,
      scopeSegments,
      onTimeStatus,
      onTimeSegments,
      totalValue,
      totalOnTimeEligible,
      onTimeByStatus,
      statusOrder,
      statusLabels,
    };
  }, [rows]);

  const outcomeGradient = useMemo(() => {
    if (!analytics.outcomeSegments.length) return "conic-gradient(#cbd5e1 0deg 360deg)";

    let cursor = 0;
    const stops = analytics.outcomeSegments
      .map((segment) => {
        const angle = (segment.count / analytics.total) * 360;
        const start = cursor;
        cursor += angle;
        const end = cursor;
        const colorMap = {
          WON: "#22c55e",
          LOST: "#ef4444",
          DECLINED: "#64748b",
          SUBMITTED: "#f59e0b",
          PENDING: "#6366f1",
        };
        return `${colorMap[segment.status] || "#94a3b8"} ${start}deg ${end}deg`;
      })
      .join(", ");

    return `conic-gradient(${stops})`;
  }, [analytics.outcomeSegments, analytics.total]);

  const onTimeGradient = useMemo(() => {
    if (!analytics.onTimeSegments.length) return "conic-gradient(#cbd5e1 0deg 360deg)";

    let cursor = 0;
    const total = analytics.onTimeStatus.total || 1;
    const colorMap = {
      "On-Time": "#3b82f6",
      Late: "#ef4444",
      "Not Submitted": "#f59e0b",
    };

    const stops = analytics.onTimeSegments
      .map((segment) => {
        const angle = (segment.value / total) * 360;
        const start = cursor;
        cursor += angle;
        const end = cursor;
        return `${colorMap[segment.label] || "#94a3b8"} ${start}deg ${end}deg`;
      })
      .join(", ");

    return `conic-gradient(${stops})`;
  }, [analytics.onTimeSegments, analytics.onTimeStatus.total]);

  const maxValue = Math.max(1, ...analytics.valueSegments.map((item) => item.value));
  const maxScope = Math.max(1, ...analytics.scopeSegments.map((item) => item.count));

  function openModalFor(key) {
    let list = [];
    let title = "";
    const norm = (r) => normalizeStatus(r.status);

    if (key === "pending") {
      title = "Pending proposals";
      list = rows.filter((r) => normalizeStatus(r.status) === "PENDING");
    } else if (key === "unsubmitted") {
      title = "Unsubmitted proposals";
      list = rows.filter((r) => normalizeStatus(r.status) !== "ON-GOING");
    } else if (key === "won") {
      title = "Won proposals";
      list = rows.filter((r) => normalizeStatus(r.status) === "WON");
    } else if (key === "lost") {
      title = "Lost proposals";
      list = rows.filter((r) => normalizeStatus(r.status) === "LOST");
    } else if (key === "declined") {
      title = "Declined proposals";
      list = rows.filter((r) => normalizeStatus(r.status) === "DECLINED");
    } else if (key === "submitted") {
      title = "Submitted proposals";
      list = rows.filter((r) => normalizeStatus(r.status) === "ON-GOING");
    }

    setModalTitle(title);
    setModalRows(Array.isArray(list) ? list : []);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalRows([]);
    setModalTitle("");
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-6 shadow-[0_20px_44px_rgba(15,23,42,0.24)] sm:px-7">
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
              BD Analytics
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Proposal dashboard</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              A compact view of proposal outcomes, values, timing, and scope distribution.
            </p>
          </div>
        </div>

        {/* moved metric cards out of hero to sit below the hero */}
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">{error}</section>
      )}

      {/* Mini metrics placed outside the dark hero to occupy unused blank space */}
      <section className="mt-8 mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div onClick={() => {}}>
          <MiniMetric label="Total submissions" value={analytics.total} tone="bg-cyan-50/95 border-cyan-200" note="All proposal records" />
        </div>
        <div role="button" tabIndex={0} onClick={() => openModalFor("unsubmitted")}> 
          <MiniMetric label="Unsubmitted" value={analytics.unsubmitted} tone="bg-slate-50/95 border-slate-200" note="Not marked as submitted" />
        </div>
        <div role="button" tabIndex={0} onClick={() => openModalFor("pending")}> 
          <MiniMetric label="Pending" value={analytics.pending} tone="bg-indigo-50/95 border-indigo-200" note="Pending status proposals" />
        </div>
        <div role="button" tabIndex={0} onClick={() => openModalFor("won")}> 
          <MiniMetric label="Won" value={analytics.counts.WON} tone="bg-emerald-50/95 border-emerald-200" note="Successful proposals" />
        </div>
        <div role="button" tabIndex={0} onClick={() => openModalFor("lost")}> 
          <MiniMetric label="Lost" value={analytics.counts.LOST} tone="bg-rose-50/95 border-rose-200" note="Unsuccessful proposals" />
        </div>

        <div role="button" tabIndex={0} onClick={() => openModalFor("declined")}> 
          <MiniMetric label="Declined" value={analytics.counts.DECLINED} tone="bg-violet-50/95 border-violet-200" note="Closed out early" />
        </div>
        <div role="button" tabIndex={0} onClick={() => openModalFor("submitted")}> 
          <MiniMetric label="Submitted" value={analytics.submitted} tone="bg-amber-50/95 border-amber-200" note="Already submitted" />
        </div>
        <div>
          <MiniMetric label="On-time rate" value={`${analytics.totalOnTimeEligible > 0 ? Math.round((analytics.onTimeStatus.onTime / analytics.totalOnTimeEligible) * 100) : 0}%`} tone="bg-blue-50/95 border-blue-200" note={`${analytics.onTimeStatus.onTime}/${analytics.totalOnTimeEligible} eligible`} />
        </div>
        {/* Total value card removed as requested */}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Proposal mix</div>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Proposal Outcome Distribution</h3>
            </div>
            <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">{analytics.total} total</div>
          </div>

          <div className="mt-5 flex items-center gap-6">
            <div className="relative h-48 w-48 shrink-0">
              <div className="absolute inset-0 rounded-full" style={{ background: outcomeGradient }} />
              <div className="absolute inset-[22%] rounded-full border border-slate-100 bg-white shadow-inner">
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total</div>
                  <div className="mt-1 text-3xl font-semibold text-slate-900">{analytics.total}</div>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              {analytics.outcomeSegments.map((item) => (
                <div key={item.status} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full bg-gradient-to-r ${getOutcomeColor(item.status)}`} />
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  </div>
                  <div className="text-right text-sm font-semibold text-slate-900">{item.count}</div>
                </div>
              ))}
              {!analytics.outcomeSegments.find((item) => item.status === "SUBMITTED") && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full bg-gradient-to-r ${getOutcomeColor("SUBMITTED")}`} />
                    <span className="text-sm font-medium text-slate-700">Submitted</span>
                  </div>
                  <div className="text-right text-sm font-semibold text-slate-900">{analytics.submitted}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Value profile</div>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">Total Value (RM)</h3>
          </div>

          <div className="mt-5 space-y-4">
            {analytics.valueSegments.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">No value data yet.</div>
            ) : (
              analytics.valueSegments.map((item) => (
                <div key={item.status}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                    <span>{item.label}</span>
                    <span>{formatCurrency(item.value)}</span>
                  </div>
                  <div className="h-9 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1">
                    <div
                      className={`h-full rounded-xl bg-gradient-to-r ${getOutcomeColor(item.status)} shadow-[0_10px_20px_rgba(59,130,246,0.18)]`}
                      style={{ width: `${(item.value / maxValue) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Delivery timing</div>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">On-Time Status</h3>
            </div>
            <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">{analytics.totalOnTimeEligible} evaluated</div>
          </div>

          <div className="mt-5 flex items-center gap-5">
            <div className="relative h-48 w-48 shrink-0">
              <div className="absolute inset-0 rounded-full" style={{ background: onTimeGradient }} />
              <div className="absolute inset-[18%] rounded-full border border-white bg-white shadow-inner">
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">On-time</div>
                  <div className="mt-1 text-3xl font-semibold text-slate-900">{analytics.onTimeStatus.onTime}</div>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              {analytics.onTimeSegments.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${item.tone}`} />
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status timing</div>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">On-Time status with Outcome</h3>
          </div>

          <div className="mt-5 space-y-4">
            {analytics.statusOrder.filter((status) => status !== "SUBMITTED" && status !== "PENDING").map((status) => {
              const bucket = analytics.onTimeByStatus[status];
              const total = bucket.onTime + bucket.late;
              const onTimeWidth = total > 0 ? (bucket.onTime / total) * 100 : 0;
              const lateWidth = total > 0 ? (bucket.late / total) * 100 : 0;

              return (
                <div key={status}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                    <span>{analytics.statusLabels[status]}</span>
                    <span>{bucket.late} late, {bucket.onTime} on time</span>
                  </div>
                  <div className="h-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1">
                    <div className="flex h-full overflow-hidden rounded-xl">
                      <div
                        className="bg-blue-500 text-[10px] font-semibold text-white"
                        style={{ width: `${onTimeWidth}%` }}
                      >
                        {bucket.onTime > 0 ? <div className="flex h-full items-center justify-center">{bucket.onTime}</div> : null}
                      </div>
                      <div
                        className="bg-rose-500 text-[10px] font-semibold text-white"
                        style={{ width: `${lateWidth}%` }}
                      >
                        {bucket.late > 0 ? <div className="flex h-full items-center justify-center">{bucket.late}</div> : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Participants by Scope section removed as requested */}
      </section>

      {/* Modal for list view */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6">
          <div className="w-full max-w-6xl rounded-3xl overflow-hidden bg-transparent shadow-xl">
            <div className="relative">
              <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 p-6 text-white">
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Scope detail</div>
                <h2 className="mt-2 text-2xl font-semibold">{modalTitle}</h2>
                <div className="mt-1 text-sm text-indigo-100">{modalRows.length} proposals in this list.</div>
              </div>
              <button onClick={closeModal} className="absolute right-4 top-4 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm text-white">Close</button>
            </div>

            <div className="bg-white p-6">
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                <div className="overflow-auto max-h-[60vh]">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th className="px-4 py-3">Ref No</th>
                        <th className="px-4 py-3">Title / Project</th>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3">PIC</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalRows.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No proposals</td></tr>
                      ) : (
                        modalRows.map((r) => (
                          <tr
                            key={r.id}
                            className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                            onClick={() => router.push(`/bd/proposals/${r.id}/edit`)}
                          >
                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{r.refNo || "-"}</td>
                            <td className="px-4 py-3 text-slate-700 max-w-[480px] truncate" title={r.titleProjectName || ""}>{r.titleProjectName || "-"}</td>
                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{r.client || "-"}</td>
                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatPicString(r.personInCharge) || "-"}</td>
                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{normalizeStatus(r.status)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}