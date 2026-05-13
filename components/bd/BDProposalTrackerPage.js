"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { bdFetch, statusClass } from "./api";
import { BD_STATUS_OPTIONS } from "./options";

function readTrackerStateFromUrl() {
  const defaults = {
    currentPage: 1,
    titleQuery: "",
    clientQuery: "",
    picQuery: "",
    refQuery: "",
    statusFilter: "",
    deadlineSort: "desc",
    refNoSort: "",
  };

  if (typeof window === "undefined") return defaults;

  const params = new URLSearchParams(window.location.search);
  const pageParam = parseInt(params.get("page") || "1", 10);
  const deadlineSort = params.get("deadlineSort");
  const refNoSort = params.get("refNoSort");

  return {
    currentPage: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
    titleQuery: params.get("title") || "",
    clientQuery: params.get("client") || "",
    picQuery: params.get("pic") || "",
    refQuery: params.get("ref") || "",
    statusFilter: params.get("status") || "",
    deadlineSort: deadlineSort === "asc" ? "asc" : "desc",
    refNoSort: refNoSort === "asc" || refNoSort === "desc" ? refNoSort : "",
  };
}

function buildTrackerQuery(state) {
  const params = new URLSearchParams();

  if (state.currentPage > 1) params.set("page", String(state.currentPage));
  if (state.titleQuery) params.set("title", state.titleQuery);
  if (state.clientQuery) params.set("client", state.clientQuery);
  if (state.picQuery) params.set("pic", state.picQuery);
  if (state.refQuery) params.set("ref", state.refQuery);
  if (state.statusFilter) params.set("status", state.statusFilter);
  if (state.deadlineSort && state.deadlineSort !== "desc") params.set("deadlineSort", state.deadlineSort);
  if (state.refNoSort) params.set("refNoSort", state.refNoSort);

  return params.toString();
}

const TRACKER_STATE_KEY = "bd:proposalTrackerState";

function readTrackerStateFromSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TRACKER_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      currentPage: Number.isFinite(Number(parsed?.currentPage)) && Number(parsed.currentPage) > 0 ? Number(parsed.currentPage) : 1,
      titleQuery: String(parsed?.titleQuery || ""),
      clientQuery: String(parsed?.clientQuery || ""),
      picQuery: String(parsed?.picQuery || ""),
      refQuery: String(parsed?.refQuery || ""),
      statusFilter: String(parsed?.statusFilter || ""),
      deadlineSort: parsed?.deadlineSort === "asc" ? "asc" : "desc",
      refNoSort: parsed?.refNoSort === "asc" || parsed?.refNoSort === "desc" ? parsed.refNoSort : "",
    };
  } catch {
    return null;
  }
}

function saveTrackerStateToSession(state) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TRACKER_STATE_KEY, JSON.stringify(state));
  } catch {}
}

export default function BDProposalTrackerPage() {
  const initialState = readTrackerStateFromUrl() || readTrackerStateFromSession() || {
    currentPage: 1,
    titleQuery: "",
    clientQuery: "",
    picQuery: "",
    refQuery: "",
    statusFilter: "",
    deadlineSort: "desc",
    refNoSort: "",
  };
  const hasMountedRef = useRef(false);
  const prevTrackerQueryRef = useRef("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [titleQuery, setTitleQuery] = useState(initialState.titleQuery);
  const [clientQuery, setClientQuery] = useState(initialState.clientQuery);
  const [picQuery, setPicQuery] = useState(initialState.picQuery);
  const [refQuery, setRefQuery] = useState(initialState.refQuery);
  const [statusFilter, setStatusFilter] = useState(initialState.statusFilter);
  const [deadlineSort, setDeadlineSort] = useState(initialState.deadlineSort);
  const [refNoSort, setRefNoSort] = useState(initialState.refNoSort);
  const [currentPage, setCurrentPage] = useState(initialState.currentPage);
  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    saveTrackerStateToSession({
      currentPage,
      titleQuery,
      clientQuery,
      picQuery,
      refQuery,
      statusFilter,
      deadlineSort,
      refNoSort,
    });
  }, [currentPage, titleQuery, clientQuery, picQuery, refQuery, statusFilter, deadlineSort, refNoSort]);

  // Keep tracker state in sync with browser navigation.
  useEffect(() => {
    const handlePopState = () => {
      const nextState = readTrackerStateFromSession() || readTrackerStateFromUrl();
      setCurrentPage(nextState.currentPage);
      setTitleQuery(nextState.titleQuery);
      setClientQuery(nextState.clientQuery);
      setPicQuery(nextState.picQuery);
      setRefQuery(nextState.refQuery);
      setStatusFilter(nextState.statusFilter);
      setDeadlineSort(nextState.deadlineSort);
      setRefNoSort(nextState.refNoSort);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await bdFetch("/api/bd/proposals");
      setRows(data);
    } catch (err) {
      setError(err.message || "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id) {
    setError("");
    try {
      await bdFetch("/api/bd/proposals", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      setRows((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message || "Failed to delete proposal");
    }
  }

  function getMaturationDays(deadline, submission) {
    if (!deadline) return "-";

    let targetDate = null;
    if (typeof deadline === "string") {
      const trimmed = deadline.trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [year, month, day] = trimmed.split("-").map(Number);
        targetDate = new Date(year, month - 1, day);
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split("/").map(Number);
        targetDate = new Date(year, month - 1, day);
      } else {
        targetDate = new Date(trimmed);
      }
    } else {
      targetDate = new Date(deadline);
    }

    if (Number.isNaN(targetDate.getTime())) return "-";

    // Common date math
    const dayMs = 1000 * 60 * 60 * 24;
    const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // If maturation already passed relative to today => show 0
    if (startOfTarget <= startOfToday) return "0 days";

    // If submission provided, compute maturation days relative to submission date
    if (submission) {
      const submissionDate = parseDeadline(submission);
      if (!submissionDate) return "-";
      const startOfSubmission = new Date(submissionDate.getFullYear(), submissionDate.getMonth(), submissionDate.getDate());
      const daysBetween = Math.ceil((startOfTarget - startOfSubmission) / dayMs);
      if (daysBetween <= 0) return "0 days";
      return `${daysBetween} day${daysBetween === 1 ? "" : "s"}`;
    }

    // Fallback: compute days from today
    const daysRemaining = Math.ceil((startOfTarget - startOfToday) / dayMs);
    if (daysRemaining <= 0) return "0 days";
    return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  }

  function parseDeadline(deadline) {
    if (!deadline) return null;

    if (typeof deadline === "string") {
      const trimmed = deadline.trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [year, month, day] = trimmed.split("-").map(Number);
        return new Date(year, month - 1, day);
      }

      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split("/").map(Number);
        return new Date(year, month - 1, day);
      }

      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(deadline);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const filteredRows = useMemo(() => {
    const normalizedTitle = titleQuery.trim().toLowerCase();
    const normalizedClient = clientQuery.trim().toLowerCase();
    const normalizedPic = picQuery.trim().toLowerCase();
    const normalizedRef = refQuery.trim().toLowerCase();

    const filtered = rows.filter((item) => {
      const title = String(item.titleProjectName || "").toLowerCase();
      const client = String(item.client || "").toLowerCase();
      const pic = String(item.personInCharge || "").toLowerCase();
      const status = String(item.status || "").toUpperCase();

      const titleMatch = !normalizedTitle || title.includes(normalizedTitle);
      const clientMatch = !normalizedClient || client.includes(normalizedClient);
      const picMatch = !normalizedPic || pic.includes(normalizedPic);
      const statusMatch = !statusFilter || status === statusFilter;
      const refMatch = !normalizedRef || String(item.refNo || "").toLowerCase().includes(normalizedRef);

      return titleMatch && clientMatch && picMatch && statusMatch && refMatch;
    });

    let sorted = [...filtered];

    // Apply reference number sort if selected
    if (refNoSort) {
      sorted.sort((left, right) => {
        const leftRef = String(left.refNo || "").toLowerCase();
        const rightRef = String(right.refNo || "").toLowerCase();
        const cmp = leftRef.localeCompare(rightRef, undefined, { numeric: true });
        return refNoSort === "asc" ? cmp : -cmp;
      });
    } else {
      // Apply deadline sort (default)
      sorted.sort((left, right) => {
        const leftDate = parseDeadline(left.deadline);
        const rightDate = parseDeadline(right.deadline);

        if (!leftDate && !rightDate) return 0;
        if (!leftDate) return 1;
        if (!rightDate) return -1;

        return deadlineSort === "asc" ? leftDate - rightDate : rightDate - leftDate;
      });
    }

    return sorted;
  }, [rows, titleQuery, clientQuery, picQuery, statusFilter, deadlineSort, refNoSort, refQuery]);

  const trackerQuery = useMemo(() => buildTrackerQuery({
    currentPage,
    titleQuery,
    clientQuery,
    picQuery,
    refQuery,
    statusFilter,
    deadlineSort,
    refNoSort,
  }), [currentPage, titleQuery, clientQuery, picQuery, refQuery, statusFilter, deadlineSort, refNoSort]);

  // Update URL when tracker state changes.
  useEffect(() => {
    const newUrl = `${window.location.pathname}${trackerQuery ? `?${trackerQuery}` : ""}`;
    if (!hasMountedRef.current) {
      window.history.replaceState(window.history.state, "", newUrl);
      prevTrackerQueryRef.current = trackerQuery;
      return;
    }

    if (trackerQuery === prevTrackerQueryRef.current) {
      return;
    }

    const prevPage = new URLSearchParams(prevTrackerQueryRef.current).get("page") || "1";
    const nextPage = new URLSearchParams(trackerQuery).get("page") || "1";

    if (prevPage !== nextPage) {
      window.history.pushState(window.history.state, "", newUrl);
    } else {
      window.history.replaceState(window.history.state, "", newUrl);
    }

    prevTrackerQueryRef.current = trackerQuery;
  }, [trackerQuery]);

  // Reset to page 1 when filters or sorts change
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    setCurrentPage(1);
  }, [titleQuery, clientQuery, picQuery, statusFilter, deadlineSort, refNoSort, refQuery]);

  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const paginatedRows = filteredRows.slice(startIdx, endIdx);

  return (
    <div className="relative rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Proposal Tracker</h2>
          <p className="text-sm text-slate-500 mt-1">All BD proposals in one table.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-xl border border-blue-300 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-sm text-white shadow-[0_10px_20px_rgba(37,99,235,0.28)] hover:from-blue-700 hover:to-indigo-700"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Search title</span>
          <input
            type="text"
            value={titleQuery}
            onChange={(e) => setTitleQuery(e.target.value)}
            placeholder="Type title keyword..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Filter client</span>
          <input
            type="text"
            value={clientQuery}
            onChange={(e) => setClientQuery(e.target.value)}
            placeholder="Type client keyword..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Filter PIC</span>
          <input
            type="text"
            value={picQuery}
            onChange={(e) => setPicQuery(e.target.value)}
            placeholder="Type PIC keyword..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Search Ref No</span>
          <input
            type="text"
            value={refQuery}
            onChange={(e) => setRefQuery(e.target.value)}
            placeholder="Type ref no..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Filter status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All statuses</option>
            {BD_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Deadline sort</span>
          <select
            value={deadlineSort}
            onChange={(e) => {
              setDeadlineSort(e.target.value);
              setRefNoSort("");
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="desc">Newest deadline first</option>
            <option value="asc">Oldest deadline first</option>
          </select>
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Sort by Ref No</span>
          <select
            value={refNoSort}
            onChange={(e) => setRefNoSort(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">None (deadline sort)</option>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      <Link
        href="/bd/proposals/new"
        className="fixed bottom-6 left-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 shadow-[0_12px_28px_rgba(37,99,235,0.22)] transition-all hover:-translate-y-0.5 hover:bg-blue-100 hover:text-blue-900"
        aria-label="Add proposal"
        title="Add proposal"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </Link>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-indigo-50 text-slate-500">
              <th className="px-3 py-2 text-left">Ref No</th>
              <th className="px-3 py-2 text-left">Date Received</th>
              <th className="px-3 py-2 text-left">Title / Project</th>
              <th className="px-3 py-2 text-left">Client</th>
              <th className="px-3 py-2 text-left">Deadline</th>
              <th className="px-3 py-2 text-left">Maturation Date</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">PIC</th>
              <th className="px-3 py-2 text-left"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">Loading proposals...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">No proposals found.</td>
              </tr>
            ) : (
              paginatedRows.map((item) => (
                <tr key={item.id} className="border-t border-slate-200 text-slate-700 hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2">
                    {item.googleFolderLink ? (
                      <a
                        href={/^https?:\/\//i.test(item.googleFolderLink) ? item.googleFolderLink : `https://${item.googleFolderLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-md bg-blue-100 px-2 py-0.5 font-semibold text-blue-800 underline decoration-blue-500 decoration-2 underline-offset-2 shadow-sm transition-colors hover:bg-blue-200 hover:text-blue-900"
                      >
                        {item.refNo || "-"}
                      </a>
                    ) : (
                      item.refNo || "-"
                    )}
                  </td>
                  <td className="px-3 py-2">{item.dateReceived || "-"}</td>
                  <td className="px-3 py-2 max-w-[280px] truncate" title={item.titleProjectName || ""}>{item.titleProjectName || "-"}</td>
                  <td className="px-3 py-2">{item.client || "-"}</td>
                  <td className="px-3 py-2">{item.deadline || "-"}</td>
                  <td className="px-3 py-2">{getMaturationDays(item.maturityOnDate, item.submissionDate)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(item.status)}`}>
                      {item.status || "PENDING"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{item.personInCharge || "-"}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/bd/proposals/${item.id}/edit?returnTo=${encodeURIComponent(`/bd/proposals${trackerQuery ? `?${trackerQuery}` : ""}`)}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900"
                      aria-label={`Edit proposal ${item.refNo || item.id}`}
                      title="Edit proposal"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredRows.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Showing <span className="font-medium">{startIdx + 1}</span> to{" "}
            <span className="font-medium">{Math.min(endIdx, filteredRows.length)}</span> of{" "}
            <span className="font-medium">{filteredRows.length}</span> proposals
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? "bg-[#0f3d7a] text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
