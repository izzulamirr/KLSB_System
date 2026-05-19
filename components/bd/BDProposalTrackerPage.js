
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { bdFetch, statusClass } from "./api";
import { BD_STATUS_OPTIONS } from "./options";
import { formatPicString } from "../../lib/picEmailMap";
const EDIT_RETURN_URL_KEY = "bd:editReturnUrl";
const TRACKER_PAGE_KEY = "bd:proposalTrackerPage";
const TRACKER_STATE_KEY = "bd:proposalTrackerState";

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
    scopeQuery: "",
    maturationSort: "",
  };

  if (typeof window === "undefined") return defaults;

  const params = new URLSearchParams(window.location.search);
  const pageParam = parseInt(params.get("page") || "1", 10);
  const deadlineSort = params.get("deadlineSort");
  const refNoSort = params.get("refNoSort");
  const scopeQuery = params.get("scope") || "";
  const maturationSort = params.get("maturationSort") || "";

  return {
    currentPage: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
    titleQuery: params.get("title") || "",
    clientQuery: params.get("client") || "",
    picQuery: params.get("pic") || "",
    refQuery: params.get("ref") || "",
    statusFilter: params.get("status") || "",
    deadlineSort: deadlineSort === "asc" ? "asc" : "desc",
    refNoSort: refNoSort === "asc" || refNoSort === "desc" ? refNoSort : "",
    scopeQuery,
    maturationSort,
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
  if (state.scopeQuery) params.set("scope", state.scopeQuery);
  if (state.maturationSort) params.set("maturationSort", state.maturationSort);

  return params.toString();
}

function getInitialTrackerState() {
  const defaults = {
    currentPage: 1,
    titleQuery: "",
    clientQuery: "",
    picQuery: "",
    refQuery: "",
    statusFilter: "",
    deadlineSort: "desc",
    refNoSort: "",
    scopeQuery: "",
    maturationSort: "",
  };

  if (typeof window === "undefined") return defaults;

  const urlState = readTrackerStateFromUrl();
  const persistedPage = Number(window.sessionStorage.getItem(TRACKER_PAGE_KEY) || "1");
  const persistedStateText = window.sessionStorage.getItem(TRACKER_STATE_KEY);
  const hasReturnMarker = Boolean(window.sessionStorage.getItem(EDIT_RETURN_URL_KEY));

  let persistedState = null;
  if (persistedStateText) {
    try {
      persistedState = JSON.parse(persistedStateText);
    } catch {
      persistedState = null;
    }
  }

  if (hasReturnMarker && persistedState) {
    return {
      ...urlState,
      ...persistedState,
      currentPage: Number.isFinite(Number(persistedState.currentPage)) ? Number(persistedState.currentPage) : persistedPage,
    };
  }

  if (hasReturnMarker && (!urlState.currentPage || urlState.currentPage === 1) && persistedPage > 1) {
    return { ...urlState, currentPage: persistedPage };
  }

  return urlState;
}

export default function BDProposalTrackerPage() {
  const initialState = getInitialTrackerState();
  const hasHydratedRef = useRef(false);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reminderNotice, setReminderNotice] = useState(null);
  const noticeTimerRef = useRef(null);
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [reminderTypeById, setReminderTypeById] = useState({});
  const [openReminderMenuId, setOpenReminderMenuId] = useState(null);
  const [reminderMenuOpenUp, setReminderMenuOpenUp] = useState(false);
  const [reminderMenuStyle, setReminderMenuStyle] = useState(null);
  const [titleQuery, setTitleQuery] = useState(initialState.titleQuery);
  const [clientQuery, setClientQuery] = useState(initialState.clientQuery);
  const [picQuery, setPicQuery] = useState(initialState.picQuery);
  const [refQuery, setRefQuery] = useState(initialState.refQuery);
  const [statusFilter, setStatusFilter] = useState(initialState.statusFilter);
  const [deadlineSort, setDeadlineSort] = useState(initialState.deadlineSort);
  const [refNoSort, setRefNoSort] = useState(initialState.refNoSort);
  const [scopeQuery, setScopeQuery] = useState(initialState.scopeQuery);
  const [maturationSort, setMaturationSort] = useState(initialState.maturationSort);
  const [currentPage, setCurrentPage] = useState(initialState.currentPage);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const ITEMS_PER_PAGE = 15;
  const syncingUrlStateRef = useRef(false);

  function applyUrlState(nextState) {
    syncingUrlStateRef.current = true;
    setCurrentPage(nextState.currentPage);
    setTitleQuery(nextState.titleQuery);
    setClientQuery(nextState.clientQuery);
    setPicQuery(nextState.picQuery);
    setRefQuery(nextState.refQuery);
    setStatusFilter(nextState.statusFilter);
    setDeadlineSort(nextState.deadlineSort);
    setRefNoSort(nextState.refNoSort);
    setScopeQuery(nextState.scopeQuery || "");
    setMaturationSort(nextState.maturationSort || "");
  }

  function saveTrackerState(nextState) {
    if (typeof window === "undefined") return;

    window.sessionStorage.setItem(TRACKER_STATE_KEY, JSON.stringify(nextState));
    window.sessionStorage.setItem(TRACKER_PAGE_KEY, String(nextState.currentPage));
  }

  function buildTrackerPath(nextState) {
    const query = buildTrackerQuery(nextState);
    return `/bd/proposals${query ? `?${query}` : ""}`;
  }

  function getCurrentTrackerState(overrides = {}) {
    return {
      currentPage,
      titleQuery,
      clientQuery,
      picQuery,
      refQuery,
      statusFilter,
      deadlineSort,
      refNoSort,
      scopeQuery,
      maturationSort,
      ...overrides,
    };
  }

  useEffect(() => {
    hasHydratedRef.current = true;
  }, []);

  // Clear any pending notice timer when component unmounts
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        load();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

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

  function getDaysUntil(dateValue) {
    const targetDate = parseDeadline(dateValue);
    if (!targetDate) return null;

    const dayMs = 1000 * 60 * 60 * 24;
    const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return Math.max(0, Math.ceil((startOfTarget - startOfToday) / dayMs));
  }

  async function sendManualReminder(item, reminderType = "deadline") {
    const normalizedReminderType = reminderType === "maturation" ? "maturation" : "deadline";
    const dueDate = normalizedReminderType === "maturation" ? item.maturityOnDate : item.deadline;
    const reminderLabel = normalizedReminderType === "maturation" ? "maturation date" : "deadline";

    if (!dueDate) {
      setReminderNotice({
        type: "error",
        message: `Ref No ${item.refNo || item.id} does not have a ${reminderLabel} to send a reminder.`,
      });
      return;
    }

    if (!item.personInCharge) {
      setReminderNotice({ type: "error", message: `Ref No ${item.refNo || item.id} does not have a PIC assigned.` });
      return;
    }

    const confirmSend = window.confirm(
      `Send a ${reminderLabel} reminder email to ${formatPicString(item.personInCharge) || "the PIC"} for Ref No ${item.refNo || item.id}?`
    );

    if (!confirmSend) return;

    const daysLeft = getDaysUntil(dueDate);

    try {
      setSendingReminderId(item.id);
      setReminderNotice(null);

      await bdFetch("/api/bd/send-reminder", {
        method: "POST",
        body: JSON.stringify({
          proposalId: item.id,
          proposalRefNo: item.refNo,
          proposalTitle: item.titleProjectName,
          personInCharge: item.personInCharge,
          reminderType: normalizedReminderType,
          dueDate,
          daysLeft: daysLeft ?? 0,
          proposal: item,
        }),
      });

      // Format message: capitalize sentence and title-case PIC name
      const picText = formatPicString(item.personInCharge) || "the PIC";
      const titlePic = picText
        .split(/\s+/)
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(" ");
      const rawMessage = `${reminderLabel} reminder sent to ${titlePic} for Ref No ${item.refNo || item.id}.`;
      const message = rawMessage.charAt(0).toUpperCase() + rawMessage.slice(1);

      // show success notice and auto-hide after 2 seconds
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
      setReminderNotice({ type: "success", message });
      noticeTimerRef.current = setTimeout(() => {
        setReminderNotice(null);
        noticeTimerRef.current = null;
      }, 2000);
    } catch (err) {
      setReminderNotice({
        type: "error",
        message: err.message || "Failed to send reminder.",
      });
    } finally {
      setSendingReminderId(null);
    }
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "-";
    const n = Number(String(value).replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(n)) return String(value);
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  const scopeOptions = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => {
      const s = String(r.scopeBusiness || "").trim() || "Unspecified";
      set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedTitle = titleQuery.trim().toLowerCase();
    const normalizedClient = clientQuery.trim().toLowerCase();
    const normalizedPic = picQuery.trim().toLowerCase();
    const normalizedRef = refQuery.trim().toLowerCase();
    const normalizedScope = scopeQuery.trim().toLowerCase();

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
      const scope = String(item.scopeBusiness || "").toLowerCase();
      const scopeMatch = !normalizedScope || scope.includes(normalizedScope);

      return titleMatch && clientMatch && picMatch && statusMatch && refMatch && scopeMatch;
    });

    let sorted = [...filtered];

    // Apply maturation sort if selected (higher priority)
    if (maturationSort) {
      const DAY_MS = 1000 * 60 * 60 * 24;
      const daysUntil = (dateStr) => {
        const d = parseDeadline(dateStr);
        if (!d) return Infinity; // missing/invalid -> far
        const startOfD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diff = Math.ceil((startOfD - startOfToday) / DAY_MS);
        // treat past/today as 0 so they appear as nearest
        return diff <= 0 ? 0 : diff;
      };

      sorted.sort((left, right) => {
        const ld = daysUntil(left.maturityOnDate);
        const rd = daysUntil(right.maturityOnDate);
        if (ld === rd) return 0;
        return maturationSort === "asc" ? ld - rd : rd - ld;
      });
    } else if (refNoSort) {
      sorted.sort((left, right) => {
        const leftRef = String(left.refNo || "").toLowerCase();
        const rightRef = String(right.refNo || "").toLowerCase();
        const cmp = leftRef.localeCompare(rightRef, undefined, { numeric: true });
        return refNoSort === "asc" ? cmp : -cmp;
      });
    } else {
      // Apply deadline sort by distance from today (nearest/farthest)
      const DAY_MS = 1000 * 60 * 60 * 24;
      const startOfToday = new Date();
      const today = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate());

      const daysFromToday = (dateStr) => {
        const d = parseDeadline(dateStr);
        if (!d) return Infinity;
        const startOfD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return Math.abs(Math.round((startOfD - today) / DAY_MS));
      };

      sorted.sort((left, right) => {
        const leftDistance = daysFromToday(left.deadline);
        const rightDistance = daysFromToday(right.deadline);

        if (leftDistance === rightDistance) return 0;
        if (!Number.isFinite(leftDistance)) return 1;
        if (!Number.isFinite(rightDistance)) return -1;

        return deadlineSort === "asc" ? leftDistance - rightDistance : rightDistance - leftDistance;
      });
    }

    return sorted;
  }, [rows, titleQuery, clientQuery, picQuery, statusFilter, deadlineSort, refNoSort, refQuery, scopeQuery, maturationSort]);

  const trackerQuery = useMemo(() => buildTrackerQuery({
    currentPage,
    titleQuery,
    clientQuery,
    picQuery,
    refQuery,
    statusFilter,
    deadlineSort,
    refNoSort,
    scopeQuery,
    maturationSort,
  }), [currentPage, titleQuery, clientQuery, picQuery, refQuery, statusFilter, deadlineSort, refNoSort, scopeQuery, maturationSort]);

  // Update URL when tracker state changes.
  useEffect(() => {
    if (!hasHydratedRef.current) return;

    const newUrl = `${window.location.pathname}${trackerQuery ? `?${trackerQuery}` : ""}`;
    window.history.replaceState(window.history.state, "", newUrl);
  }, [trackerQuery]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    if (typeof window !== "undefined") {
      saveTrackerState({
        currentPage,
        titleQuery,
        clientQuery,
        picQuery,
        refQuery,
        statusFilter,
        deadlineSort,
        refNoSort,
        scopeQuery,
        maturationSort,
      });
    }
  }, [currentPage, titleQuery, clientQuery, picQuery, refQuery, statusFilter, deadlineSort, refNoSort, scopeQuery, maturationSort]);

  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const paginatedRows = filteredRows.slice(startIdx, endIdx);

  useEffect(() => {
    if (!selectedProposal) return;

    function handleEsc(event) {
      if (event.key === "Escape") {
        setSelectedProposal(null);
      }
    }

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [selectedProposal]);

  const proposalDetails = selectedProposal
    ? [
        ["Ref No", selectedProposal.refNo],
        ["Date Received", selectedProposal.dateReceived],
        ["Submission Date", selectedProposal.submissionDate],
        ["Title / Project", selectedProposal.titleProjectName],
        ["Client", selectedProposal.client],
        ["Stage", selectedProposal.stage],
        ["Scope (Business)", selectedProposal.scopeBusiness],
        ["Deadline", selectedProposal.deadline],
        ["Maturity On Date", selectedProposal.maturityOnDate],
        ["Bid Validity", selectedProposal.bidValidity],
        ["Value (RM)", formatNumber(selectedProposal.valueRM)],
        ["Status", selectedProposal.status],
        ["PIC", formatPicString(selectedProposal.personInCharge)],
        ["Google Folder", selectedProposal.googleFolderLink],
        ["Remarks", selectedProposal.remarks],
      ]
    : [];

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
            onChange={(e) => {
              const nextState = getCurrentTrackerState({ titleQuery: e.target.value, currentPage: 1 });
              saveTrackerState(nextState);
              setTitleQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Type title keyword..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Filter client</span>
          <input
            type="text"
            value={clientQuery}
            onChange={(e) => {
              const nextState = getCurrentTrackerState({ clientQuery: e.target.value, currentPage: 1 });
              saveTrackerState(nextState);
              setClientQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Type client keyword..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Filter PIC</span>
          <input
            type="text"
            value={picQuery}
            onChange={(e) => {
              const nextState = getCurrentTrackerState({ picQuery: e.target.value, currentPage: 1 });
              saveTrackerState(nextState);
              setPicQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Type PIC keyword..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Search Ref No</span>
          <input
            type="text"
            value={refQuery}
            onChange={(e) => {
              const nextState = getCurrentTrackerState({ refQuery: e.target.value, currentPage: 1 });
              saveTrackerState(nextState);
              setRefQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Type ref no..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Filter status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              const nextState = getCurrentTrackerState({ statusFilter: e.target.value, currentPage: 1 });
              saveTrackerState(nextState);
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
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
              const nextState = getCurrentTrackerState({ deadlineSort: e.target.value, refNoSort: "", currentPage: 1 });
              saveTrackerState(nextState);
              setDeadlineSort(e.target.value);
              setRefNoSort("");
              setCurrentPage(1);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="asc">Nearest deadline first</option>
            <option value="desc">Farthest deadline first</option>
          </select>
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Sort by Ref No</span>
          <select
            value={refNoSort}
            onChange={(e) => {
              const nextState = getCurrentTrackerState({ refNoSort: e.target.value, currentPage: 1 });
              saveTrackerState(nextState);
              setRefNoSort(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">None (deadline sort)</option>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Filter Scope (Business)</span>
          <select
            value={scopeQuery}
            onChange={(e) => {
              const nextState = getCurrentTrackerState({ scopeQuery: e.target.value, currentPage: 1 });
              saveTrackerState(nextState);
              setScopeQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All scopes</option>
            {scopeOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium text-slate-600">Maturation sort</span>
          <select
            value={maturationSort}
            onChange={(e) => {
              const nextState = getCurrentTrackerState({ maturationSort: e.target.value, currentPage: 1 });
              saveTrackerState(nextState);
              setMaturationSort(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Default (deadline sort)</option>
            <option value="asc">Nearest maturation first</option>
            <option value="desc">Farthest maturation first</option>
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

      {reminderNotice && (
        <div
          role="status"
          aria-live={reminderNotice.type === "success" ? "polite" : "assertive"}
          className={`fixed top-4 left-4 z-50 max-w-xs rounded-2xl border px-4 py-3 text-sm shadow-lg ${
            reminderNotice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {reminderNotice.message}
        </div>
      )}

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
                <tr
                  key={item.id}
                  className="cursor-pointer border-t border-slate-200 text-slate-700 transition-colors hover:bg-slate-50/70"
                  onClick={() => setSelectedProposal(item)}
                >
                  <td className="px-3 py-2 align-middle">
                    <div className="flex min-h-8 items-center">
                      {item.googleFolderLink ? (
                        <a
                          href={/^https?:\/\//i.test(item.googleFolderLink) ? item.googleFolderLink : `https://${item.googleFolderLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex rounded-md bg-blue-100 px-2 py-0.5 font-semibold text-blue-800 underline decoration-blue-500 decoration-2 underline-offset-2 shadow-sm transition-colors hover:bg-blue-200 hover:text-blue-900"
                        >
                          {item.refNo || "-"}
                        </a>
                      ) : (
                        <span className="inline-flex rounded-md px-2 py-0.5 font-medium text-slate-700">
                          {item.refNo || "-"}
                        </span>
                      )}
                    </div>
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
                  <td className="px-3 py-2">{formatPicString(item.personInCharge) || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="relative flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Decide whether to open the menu upward if there's insufficient space below
                          try {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const spaceAbove = rect.top; // space above the button
                            const estimatedMenuHeight = 140; // px, more compact estimate
                            const margin = 8;
                            // Open upward when the menu would overflow the bottom and there's enough room above
                            const wouldOverflowBottom = rect.bottom + estimatedMenuHeight + margin > window.innerHeight;
                            const openUp = wouldOverflowBottom && spaceAbove > estimatedMenuHeight + margin;
                            setReminderMenuOpenUp(openUp);

                            // compute fixed coordinates so the menu escapes any overflowed parent
                            const menuWidth = 176; // matches w-44
                            // right-align menu with button
                            let left = rect.right - menuWidth;
                            if (left < 8) left = 8;

                            let top;
                            if (openUp) {
                              top = rect.top - estimatedMenuHeight - margin;
                              if (top < 8) top = 8;
                            } else {
                              top = rect.bottom + margin;
                              const maxTop = window.innerHeight - estimatedMenuHeight - 8;
                              if (top > maxTop) top = Math.max(8, maxTop);
                            }

                            setReminderMenuStyle({ position: "fixed", left: `${left}px`, top: `${top}px`, zIndex: 2000 });
                          } catch (err) {
                            setReminderMenuOpenUp(false);
                            setReminderMenuStyle(null);
                          }

                          setOpenReminderMenuId((current) => (current === item.id ? null : item.id));
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900"
                        aria-label={`Open reminder options for ${item.refNo || item.id}`}
                        title="Reminder options"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.172V11a6 6 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341A6 6 0 0 0 6 11v3.172c0 .538-.214 1.055-.595 1.433L4 17h5" />
                          <path d="M9 17a3 3 0 0 0 6 0" />
                        </svg>
                      </button>

                      {openReminderMenuId === item.id && (
                        <div
                          className={`w-44 rounded-xl border border-slate-200 bg-white p-3 shadow-lg`}
                          style={reminderMenuStyle || undefined}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            Reminder type
                            <select
                              value={reminderTypeById[item.id] || "deadline"}
                              onChange={(e) => setReminderTypeById((current) => ({ ...current, [item.id]: e.target.value }))}
                              className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                              <option value="deadline">Deadline</option>
                              <option value="maturation">Maturation</option>
                            </select>
                          </label>

                          {(() => {
                            const selectedReminderType = reminderTypeById[item.id] || "deadline";
                            const reminderTargetDate = selectedReminderType === "maturation" ? item.maturityOnDate : item.deadline;
                            const reminderTitle = selectedReminderType === "maturation" ? "Send maturation reminder" : "Send deadline reminder";

                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  void sendManualReminder(item, selectedReminderType);
                                  setOpenReminderMenuId(null);
                                }}
                                disabled={sendingReminderId === item.id || !reminderTargetDate}
                                className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                                title={reminderTargetDate ? reminderTitle : "No date available for selected reminder"}
                              >
                                {sendingReminderId === item.id ? "Sending..." : "Send reminder"}
                              </button>
                            );
                          })()}
                        </div>
                      )}

                      <Link
                        href={`/bd/proposals/${item.id}/edit?returnTo=${encodeURIComponent(`/bd/proposals${trackerQuery ? `?${trackerQuery}` : ""}`)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (typeof window !== "undefined") {
                            const nextState = getCurrentTrackerState();
                            saveTrackerState(nextState);
                            window.sessionStorage.setItem(EDIT_RETURN_URL_KEY, buildTrackerPath(nextState));
                          }
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        aria-label={`Edit proposal ${item.refNo || item.id}`}
                        title="Edit proposal"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredRows.length > 0 && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Showing <span className="font-medium">{startIdx + 1}</span> to{" "}
            <span className="font-medium">{Math.min(endIdx, filteredRows.length)}</span> of{" "}
            <span className="font-medium">{filteredRows.length}</span> proposals
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextPage = Math.max(1, currentPage - 1);
                saveTrackerState(getCurrentTrackerState({ currentPage: nextPage }));
                setCurrentPage(nextPage);
              }}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => {
                    saveTrackerState(getCurrentTrackerState({ currentPage: page }));
                    setCurrentPage(page);
                  }}
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
              onClick={() => {
                const nextPage = Math.min(totalPages, currentPage + 1);
                saveTrackerState(getCurrentTrackerState({ currentPage: nextPage }));
                setCurrentPage(nextPage);
              }}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedProposal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setSelectedProposal(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Proposal Info</h3>
                <p className="mt-1 text-sm text-slate-500">View-only details for selected proposal.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProposal(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {proposalDetails.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 break-words text-sm text-slate-800">{value || "-"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
