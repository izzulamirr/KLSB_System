"use client";

import React, { useEffect, useMemo, useState } from "react";
import firebaseApp from "../firebase";
import { getAuth } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { withBasePath } from "../lib/apiPath";
import { fetchWithAuth } from "../lib/fetchWithAuth";

// Table styling mirrored from the PO Database table (components/ManpowerTable.js)
// so both pages read as one system. Keep these in sync if that table changes.
const TH_CLASS =
  "text-left px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-600 font-semibold text-[11px] uppercase tracking-[0.1em] first:rounded-tl-xl last:rounded-tr-xl";
const TD_CLASS = "px-4 py-3 align-top text-[13px] leading-5 text-slate-700 dark:text-slate-300";
const rowClass = (i) =>
  `border-t border-slate-200/90 dark:border-slate-700/60 ${
    i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/45 dark:bg-slate-800/40"
  } hover:bg-[#eef4fd] dark:hover:bg-slate-800 transition-colors`;

// Dates in this component are stored as plain "YYYY-MM-DD" strings; parsing
// them with `new Date(str)` reads them as UTC midnight, which shifts the
// local year/month near midnight for timezones behind UTC. Parse the
// year/month directly from the string instead.
function parseDateOnlyParts(value) {
  const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function statusBadgeLabel(status) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Submitted";
}

function statusBadgeClass(status) {
  if (status === "approved") return "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400";
  if (status === "rejected") return "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400";
  return "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400";
}

// What KLSB pays the personnel for the hours worked — separate from (and not
// shown on) the Invoicing page, which is what we charge the client.
function computeKlsbCost(normalHours, otHours, record) {
  const normalRate = Number(record?.KLSB_RATE_NORMAL) || 0;
  const otRate = Number(record?.KLSB_RATE_OT) || 0;
  return (Number(normalHours) || 0) * normalRate + (Number(otHours) || 0) * otRate;
}

function formatKlsbCost(amount) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

export default function TimesheetMonthlyManualClient() {
  const now = new Date();
  const initialYear = now.getFullYear();
  const initialMonth = now.getMonth() + 1;

  const [names, setNames] = useState([]);
  const [selectedName, setSelectedName] = useState("");
  const [poSoNo, setPoSoNo] = useState("");
  const [location, setLocation] = useState("");

  const [year, setYear] = useState(initialYear);
  const [monthNum, setMonthNum] = useState(initialMonth);
  const [entries, setEntries] = useState(() => buildEntriesForMonth(initialYear, initialMonth));

  // How hours are being captured for this timesheet: one row per day,
  // one row per week, or one row per project ("project" mode covers both
  // a single monthly total and a breakdown across multiple projects).
  const [entryMode, setEntryMode] = useState("daily");
  const [weeklyEntries, setWeeklyEntries] = useState(() => buildWeeksForMonth(initialYear, initialMonth));
  const [projectEntries, setProjectEntries] = useState(() => [buildEmptyProjectRow()]);

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const [timesheetList, setTimesheetList] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [reportYear, setReportYear] = useState(initialYear);
  const [reportMonth, setReportMonth] = useState(initialMonth);
  const [editingParentId, setEditingParentId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewParentId, setReviewParentId] = useState(null);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function refreshTimesheets() {
    const rows = await fetch(withBasePath("/api/timesheet")).then((r) => r.json());
    const arr = Array.isArray(rows) ? rows : [];
    const map = new Map();
    for (const r of arr) {
      const pid = r.parentId || r.id || `${r.staffName}-${r.date}`;
      // Each `r` here is already one flattened entry (one day/week/project row)
      // from the GET handler, not a parent doc with a nested `entries` array.
      const normalSum = Number(r.normalHours) || 0;
      const otSum = Number(r.otHours) || 0;
      if (!map.has(pid)) map.set(pid, { parentId: pid, staffName: r.staffName || "", poSoNo: r.poSoNo || "", location: r.location || "", date: r.date || "", normalHours: normalSum, otHours: otSum, totalHours: normalSum + otSum, sample: r });
      else {
        const v = map.get(pid);
        v.normalHours = (v.normalHours || 0) + normalSum;
        v.otHours = (v.otHours || 0) + otSum;
        v.totalHours = (v.normalHours || 0) + (v.otHours || 0);
        v.location = v.location || r.location || "";
        v.sample = r;
      }
    }
    setTimesheetList(Array.from(map.values()));
  }

  useEffect(() => {
    fetchWithAuth("/api/manpower?limit=2000")
      .then((r) => r.json())
      .then((rows) => {
        const arr = Array.isArray(rows) ? rows : [];
        const seen = new Set();
        const list = [];
        for (const r of arr) {
          const n = (r.STAFF_NAME || r.STAFF || r.name || "").toString().trim();
          if (!n) continue;
          if (seen.has(n)) continue;
          seen.add(n);
          list.push({ name: n, record: r });
        }
        setNames(list);
      })
      .catch(() => setNames([]));

    refreshTimesheets().catch(() => setTimesheetList([]));
  }, []);

  const nameMap = useMemo(() => {
    const m = {};
    for (const item of names) m[item.name] = item.record;
    return m;
  }, [names]);

  const clientOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    for (const row of timesheetList) {
      const client = (row.location || row.sample?.location || "").toString().trim();
      if (!client || seen.has(client)) continue;
      seen.add(client);
      options.push(client);
    }
    return options.sort((a, b) => a.localeCompare(b));
  }, [timesheetList]);

  const monthlyReportingRows = useMemo(() => {
    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const bucket = {
      monthIndex: Number(reportMonth),
      month: monthLabels[Number(reportMonth) - 1] || "-",
      year: Number(reportYear),
      timesheets: 0,
      normalHours: 0,
      otHours: 0,
      totalHours: 0,
      klsbCost: 0,
    };

    for (const row of timesheetList) {
      const dateValue = row?.date;
      if (!dateValue) continue;

      const parts = parseDateOnlyParts(dateValue);
      if (!parts) continue;
      if (parts.year !== Number(reportYear) || parts.month !== Number(reportMonth)) continue;

      const locationValue = (row.location || row.sample?.location || "").toString().trim();
      if (selectedClient && locationValue !== selectedClient) continue;

      bucket.timesheets += 1;
      bucket.normalHours += Number(row.normalHours) || 0;
      bucket.otHours += Number(row.otHours) || 0;
      bucket.totalHours += Number(row.totalHours) || (Number(row.normalHours) || 0) + (Number(row.otHours) || 0);
      bucket.klsbCost += computeKlsbCost(row.normalHours, row.otHours, nameMap[row.staffName || row.sample?.staffName]);
    }

    return [bucket];
  }, [reportMonth, reportYear, selectedClient, timesheetList, nameMap]);

  const monthlyReportingTotals = useMemo(() => {
    return monthlyReportingRows.reduce(
      (acc, row) => {
        acc.timesheets += row.timesheets;
        acc.normalHours += row.normalHours;
        acc.otHours += row.otHours;
        acc.totalHours += row.totalHours;
        acc.klsbCost += row.klsbCost;
        return acc;
      },
      { timesheets: 0, normalHours: 0, otHours: 0, totalHours: 0, klsbCost: 0 }
    );
  }, [monthlyReportingRows]);

  useEffect(() => {
    if (!selectedName) {
      setPoSoNo("");
      setLocation("");
      return;
    }
    const r = nameMap[selectedName];
    if (r) {
      setPoSoNo(r.PO_SO_No || r.PO || r.PO_SO || "");
      setLocation(r.LOCATION || r.SITE || r.location || "");
    } else {
      setPoSoNo("");
      setLocation("");
    }
  }, [selectedName, nameMap]);

  useEffect(() => {
    setEntries(buildEntriesForMonth(year, monthNum));
    setWeeklyEntries(buildWeeksForMonth(year, monthNum));
  }, [year, monthNum]);

  function buildEntriesForMonth(y, monthIndex) {
    const total = new Date(y, monthIndex, 0).getDate();
    const out = [];
    const monthStr = String(monthIndex).padStart(2, "0");
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let d = 1; d <= total; d++) {
      const dd = String(d).padStart(2, "0");
      const dateStr = `${y}-${monthStr}-${dd}`;
      const dayObj = new Date(y, monthIndex - 1, d);
      const dayName = dayNames[dayObj.getDay()];
      out.push({ date: dateStr, day: dayName, normalHours: 0, otHours: 0 });
    }
    return out;
  }

  function buildWeeksForMonth(y, monthIndex) {
    const totalDays = new Date(y, monthIndex, 0).getDate();
    const monthStr = String(monthIndex).padStart(2, "0");
    const weeks = [];
    let start = 1;
    let weekNum = 1;
    while (start <= totalDays) {
      const end = Math.min(start + 6, totalDays);
      weeks.push({
        weekLabel: `Week ${weekNum}`,
        weekStart: `${y}-${monthStr}-${String(start).padStart(2, "0")}`,
        weekEnd: `${y}-${monthStr}-${String(end).padStart(2, "0")}`,
        normalHours: 0,
        otHours: 0,
      });
      start = end + 1;
      weekNum += 1;
    }
    return weeks;
  }

  function buildEmptyProjectRow() {
    return { project: "", poSoNo: "", normalHours: 0, otHours: 0 };
  }

  function getDayNameFromDate(dateStr) {
    const parts = parseDateOnlyParts(dateStr);
    if (!parts) return "";
    const date = new Date(parts.year, parts.month - 1, parts.day);
    if (Number.isNaN(date.getTime())) return "";
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
  }

  function updateEntry(index, field, value) {
    setEntries((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], [field]: Number(value) || 0 };
      return next;
    });
  }

  function updateWeeklyEntry(index, field, value) {
    setWeeklyEntries((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], [field]: Number(value) || 0 };
      return next;
    });
  }

  function updateProjectEntry(index, field, value) {
    setProjectEntries((prev) => {
      const next = prev.slice();
      const parsed = field === "normalHours" || field === "otHours" ? Number(value) || 0 : value;
      next[index] = { ...next[index], [field]: parsed };
      return next;
    });
  }

  function addProjectRow() {
    setProjectEntries((prev) => [...prev, buildEmptyProjectRow()]);
  }

  function removeProjectRow(index) {
    setProjectEntries((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  // The set of rows actually being edited right now, depending on entryMode.
  function getActiveEntries() {
    if (entryMode === "weekly") return weeklyEntries;
    if (entryMode === "project") return projectEntries;
    return entries;
  }

  async function uploadFiles(files) {
    if (!files || !files.length) return { uploaded: [], failed: [] };
    setUploading(true);
    const storage = getStorage(firebaseApp);
    const uploaded = [];
    const failed = [];
    for (const f of Array.from(files)) {
      try {
        const key = `timesheet-attachments/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const ref = storageRef(storage, key);
        await uploadBytes(ref, f);
        const url = await getDownloadURL(ref);
        uploaded.push({ name: f.name, url });
      } catch (e) {
        console.error("Upload failed", e);
        failed.push({ name: f.name, error: e?.message || String(e) });
      }
    }
    setUploading(false);
    return { uploaded, failed };
  }

  async function handleAttachmentChange(e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    const { uploaded, failed } = await uploadFiles(files);
    if (uploaded.length) setAttachments((prev) => [...prev, ...uploaded]);
    if (failed.length) {
      setMessage({ type: "error", text: `Failed to upload: ${failed.map((f) => f.name).join(", ")} — ${failed[0].error}` });
    }
  }

  function removeAttachment(idx) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (!selectedName) {
      setMessage({ type: "error", text: "Please pick a name" });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const monthStr = String(monthNum).padStart(2, "0");
    const payload = {
      staffName: selectedName,
      poSoNo: poSoNo || "",
      location: location || "",
      date: `${year}-${monthStr}-01`,
      entryMode,
      entries: getActiveEntries(),
      attachments: attachments.map((a) => a.url || a),
      uploadedBy: "manual",
      uploadedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(withBasePath("/api/timesheet"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create timesheet");
      setMessage({ type: "success", text: "Timesheet created" });
      setSelectedName("");
      setPoSoNo("");
      setLocation("");
      setAttachments([]);
      await refreshTimesheets();
    } catch (e) {
      setMessage({ type: "error", text: e?.message || String(e) });
    } finally {
      setSubmitting(false);
    }
  }

  async function loadParentTimesheet(parentId) {
    try {
      const doc = await fetch(withBasePath(`/api/timesheet?id=${parentId}`)).then((r) => r.json());
      if (!doc || !doc.entries) {
        setMessage({ type: "error", text: "Unable to load timesheet entries" });
        return;
      }
      setEditingParentId(parentId);
      const firstEntryDate = doc.date || doc.entries.find((entry) => entry.date)?.date || "";
      if (firstEntryDate) {
        const parts = parseDateOnlyParts(firstEntryDate);
        if (parts) {
          setYear(parts.year);
          setMonthNum(parts.month);
        }
      }
      // "monthly" was an earlier, now-folded-in alias for "project" — normalize
      // it so timesheets created before the fold still load into the right table.
      const rawMode = doc.entryMode || "daily";
      const mode = rawMode === "monthly" ? "project" : rawMode;
      setEntryMode(mode);
      if (mode === "weekly") {
        setWeeklyEntries(
          (doc.entries || []).map((e) => ({
            weekLabel: e.weekLabel || "",
            weekStart: e.weekStart || "",
            weekEnd: e.weekEnd || "",
            normalHours: e.normalHours || 0,
            otHours: e.otHours || 0,
          }))
        );
      } else if (mode === "project") {
        setProjectEntries(
          (doc.entries || []).length
            ? doc.entries.map((e) => ({
                project: e.project || "",
                poSoNo: e.poSoNo || "",
                normalHours: e.normalHours || 0,
                otHours: e.otHours || 0,
              }))
            : [buildEmptyProjectRow()]
        );
      } else {
        setEntries(
          (doc.entries || []).map((e) => ({
            date: e.date,
            day: e.day || getDayNameFromDate(e.date),
            normalHours: e.normalHours || 0,
            otHours: e.otHours || 0,
          }))
        );
      }
      setSelectedName(doc.staffName || "");
      setPoSoNo(doc.poSoNo || "");
      setLocation(doc.location || nameMap[doc.staffName]?.LOCATION || nameMap[doc.staffName]?.location || nameMap[doc.staffName]?.SITE || "");
      setAttachments((doc.attachments || []).map((u, i) => ({ name: `file-${i + 1}`, url: u })));
      setModalOpen(true);
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: "Failed to load timesheet" });
    }
  }

  async function saveEdited() {
    if (!editingParentId) return;
    setSubmitting(true);
    try {
      // Editing only happens after a rejection (see Actions column below), so
      // saving is always a resubmission — send it back to "submitted" and
      // clear the prior rejection so it doesn't linger in the review modal.
      const payload = { id: editingParentId, entryMode, entries: getActiveEntries(), attachments: attachments.map((a) => a.url || a), status: "submitted", rejectedBy: "", rejectedAt: "", rejectReason: "" };
      const res = await fetch(withBasePath("/api/timesheet"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      setMessage({ type: "success", text: "Timesheet updated" });
      setEditingParentId(null);
      setModalOpen(false);
      await refreshTimesheets();
    } catch (e) {
      setMessage({ type: "error", text: e?.message || String(e) });
    } finally {
      setSubmitting(false);
    }
  }

  async function openReviewModal(parentId) {
    if (!parentId) return;
    try {
      const doc = await fetch(withBasePath(`/api/timesheet?id=${parentId}`)).then((r) => r.json());
      if (!doc || doc.error) {
        setMessage({ type: "error", text: "Unable to load timesheet for review" });
        return;
      }
      setReviewParentId(parentId);
      setReviewDoc(doc);
      setRejectReason("");
      setReviewModalOpen(true);
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: "Failed to load timesheet" });
    }
  }

  function closeReviewModal() {
    setReviewModalOpen(false);
    setReviewParentId(null);
    setReviewDoc(null);
    setRejectReason("");
  }

  async function handleApprove() {
    if (!reviewParentId) return;
    setApproving(true);
    try {
      const auth = getAuth(firebaseApp);
      const approver = auth.currentUser?.email || auth.currentUser?.displayName || "unknown";
      const approvedAt = new Date().toISOString();
      const payload = { id: reviewParentId, status: "approved", approvedBy: approver, approvedAt, rejectedBy: "", rejectedAt: "", rejectReason: "" };
      const res = await fetch(withBasePath("/api/timesheet"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to approve");
      setReviewDoc((prev) => (prev ? { ...prev, status: "approved", approvedBy: approver, approvedAt, rejectedBy: "", rejectedAt: "", rejectReason: "" } : prev));
      setMessage({ type: "success", text: "Timesheet approved" });
      await refreshTimesheets();
    } catch (e) {
      setMessage({ type: "error", text: e?.message || String(e) });
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!reviewParentId) return;
    setRejecting(true);
    try {
      const auth = getAuth(firebaseApp);
      const rejecter = auth.currentUser?.email || auth.currentUser?.displayName || "unknown";
      const rejectedAt = new Date().toISOString();
      const payload = { id: reviewParentId, status: "rejected", rejectedBy: rejecter, rejectedAt, rejectReason: rejectReason || "", approvedBy: "", approvedAt: "" };
      const res = await fetch(withBasePath("/api/timesheet"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to reject");
      setReviewDoc((prev) => (prev ? { ...prev, status: "rejected", rejectedBy: rejecter, rejectedAt, rejectReason: rejectReason || "", approvedBy: "", approvedAt: "" } : prev));
      setMessage({ type: "success", text: "Timesheet rejected" });
      await refreshTimesheets();
    } catch (e) {
      setMessage({ type: "error", text: e?.message || String(e) });
    } finally {
      setRejecting(false);
    }
  }

  async function handleDeleteTimesheet(parentId, staffName) {
    if (!parentId) return;
    const confirmed = window.confirm(`Delete timesheet for ${staffName || "this employee"}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const res = await fetch(withBasePath(`/api/timesheet?id=${encodeURIComponent(parentId)}`), { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete timesheet");

      if (editingParentId === parentId) {
        closeModal();
      }

      await refreshTimesheets();
      setMessage({ type: "success", text: "Timesheet deleted" });
    } catch (e) {
      setMessage({ type: "error", text: e?.message || String(e) });
    }
  }

  function openNewModal() {
    setEditingParentId(null);
    setSelectedName("");
    setPoSoNo("");
    setLocation("");
    const now = new Date();
    setYear(now.getFullYear());
    setMonthNum(now.getMonth() + 1);
    setEntryMode("daily");
    setEntries(buildEntriesForMonth(now.getFullYear(), now.getMonth() + 1));
    setWeeklyEntries(buildWeeksForMonth(now.getFullYear(), now.getMonth() + 1));
    setProjectEntries([buildEmptyProjectRow()]);
    setAttachments([]);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingParentId(null);
    setMessage(null);
  }

  useEffect(() => {
    if (!modalOpen && !reviewModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen, reviewModalOpen]);

  return (
    <div className="max-w-6xl mx-auto p-4 relative min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400">Month</label>
            <select value={monthNum} onChange={(e) => { const m = Number(e.target.value); setMonthNum(m); setEntries(buildEntriesForMonth(year, m)); }} className="mt-1 border rounded px-3 py-2">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                <option key={m} value={m}>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400">Year</label>
            <input type="number" value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); setEntries(buildEntriesForMonth(y, monthNum)); }} className="mt-1 border rounded px-3 py-2 w-28" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400">Location</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="mt-1 border rounded px-3 py-2 min-w-44"
            >
              <option value="">All locations</option>
              {clientOptions.map((client) => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <button onClick={openNewModal} className="px-4 py-2 bg-[#06184b] text-white rounded-lg shadow">+ New Timesheet</button>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/40 ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
        <div className="overflow-auto bg-white dark:bg-slate-900">
          <table className="w-full min-w-[1100px] table-auto text-sm">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr>
                {[
                  "Name",
                  "Month",
                  "Client",
                  "Normal Hours",
                  "OT Hours",
                  "Total Hours",
                  "KLSB Cost",
                  "Status",
                  "Submitted Date",
                  "Actions",
                ].map((h) => (
                  <th key={h} className={TH_CLASS}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!timesheetList || timesheetList.length === 0) ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">No timesheets found</td>
                </tr>
              ) : (
                timesheetList
                  .filter((t) => {
                    if (!t || !t.date) return true;
                    const parts = parseDateOnlyParts(t.date);
                    if (!parts) return true;
                    const matchesDate = parts.year === Number(year) && parts.month === Number(monthNum);
                    if (!matchesDate) return false;
                    if (!selectedClient) return true;
                    const clientValue = (t.location || t.sample?.location || "").toString().trim();
                    return clientValue === selectedClient;
                  })
                  .map((t, rowIndex) => {
                    const parts = t.date ? parseDateOnlyParts(t.date) : null;
                    const monthLabel = parts ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parts.month - 1]} ${parts.year}` : "-";
                    const name = t.staffName || t.sample?.staffName || "-";
                    const client = t.location || t.sample?.location || "-";
                    const normal = typeof t.normalHours === "number" ? t.normalHours.toFixed(1) : "-";
                    const ot = typeof t.otHours === "number" ? t.otHours.toFixed(1) : "-";
                    const total = (typeof t.totalHours === "number") ? t.totalHours.toFixed(1) : "-";
                    const klsbCost = formatKlsbCost(computeKlsbCost(t.normalHours, t.otHours, nameMap[t.staffName || t.sample?.staffName]));
                    const status = t.sample?.status || "submitted";
                    const submitted = t.sample?.uploadedAt ? new Date(t.sample.uploadedAt).toLocaleString() : "-";
                    return (
                      <tr key={t.parentId || name || Math.random()} className={rowClass(rowIndex)}>
                        <td className={`${TD_CLASS} font-medium text-slate-900 dark:text-slate-100`}>{name}</td>
                        <td className={TD_CLASS}>{monthLabel}</td>
                        <td className={TD_CLASS}>{client}</td>
                        <td className={TD_CLASS}>{normal}</td>
                        <td className={TD_CLASS}>{ot}</td>
                        <td className={TD_CLASS}>{total}</td>
                        <td className={TD_CLASS}>{klsbCost}</td>
                        <td className={TD_CLASS}>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(status)}`}>
                            {statusBadgeLabel(status)}
                          </span>
                        </td>
                        <td className={TD_CLASS}>{submitted}</td>
                        <td className={TD_CLASS}>
                          <div className="flex items-center gap-2">
                            {status === "rejected" ? (
                              <button onClick={() => loadParentTimesheet(t.parentId || t.sample?.id || t.sample?._id)} className="text-sm px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded">Edit</button>
                            ) : (
                              <button onClick={() => openReviewModal(t.parentId || t.sample?.id || t.sample?._id)} className="text-sm px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded">View</button>
                            )}
                            <button
                              onClick={() => handleDeleteTimesheet(t.parentId || t.sample?.id || t.sample?._id, name)}
                              className="inline-flex items-center justify-center rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 p-2 hover:bg-red-100 dark:hover:bg-red-950/60"
                              aria-label={`Delete timesheet for ${name}`}
                              title="Delete"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-4">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Monthly Reporting</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Choose a month and year to generate a monthly timesheet report.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400">Report Month</label>
              <select
                value={reportMonth}
                onChange={(e) => setReportMonth(Number(e.target.value))}
                className="mt-1 border rounded px-3 py-2"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                  <option key={m} value={m}>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400">Report Year</label>
              <input
                type="number"
                value={reportYear}
                onChange={(e) => setReportYear(Number(e.target.value))}
                className="mt-1 border rounded px-3 py-2 w-28"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 mb-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Timesheets</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{monthlyReportingTotals.timesheets}</div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Normal Hours</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{monthlyReportingTotals.normalHours.toFixed(1)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">OT Hours</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{monthlyReportingTotals.otHours.toFixed(1)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Hours</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{monthlyReportingTotals.totalHours.toFixed(1)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">KLSB Cost</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatKlsbCost(monthlyReportingTotals.klsbCost)}</div>
          </div>
        </div>

        {/* Negative margins pull the table flush to the card edge, past the
            card's p-4, so it matches the PO Database table. */}
        <div className="-mx-4 -mb-4 mt-4 overflow-auto border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-b-lg">
          <table className="w-full table-auto text-sm">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr>
                {[
                  "Month",
                  "Year",
                  "Timesheets",
                  "Normal Hours",
                  "OT Hours",
                  "Total Hours",
                  "KLSB Cost",
                ].map((h) => (
                  <th key={h} className={TH_CLASS}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyReportingRows.map((row, i) => (
                <tr key={`${row.month}-${row.year}`} className={rowClass(i)}>
                  <td className={`${TD_CLASS} font-medium text-slate-900 dark:text-slate-100`}>{row.month}</td>
                  <td className={TD_CLASS}>{row.year}</td>
                  <td className={TD_CLASS}>{row.timesheets}</td>
                  <td className={TD_CLASS}>{row.normalHours.toFixed(1)}</td>
                  <td className={TD_CLASS}>{row.otHours.toFixed(1)}</td>
                  <td className={TD_CLASS}>{row.totalHours.toFixed(1)}</td>
                  <td className={TD_CLASS}>{formatKlsbCost(row.klsbCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-black opacity-40" onClick={closeModal} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] z-10 flex flex-col overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{editingParentId ? "Edit Timesheet" : "Create New Timesheet"}</h3>
              <button onClick={closeModal} className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium">Close</button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Name *</label>
                  <select value={selectedName} onChange={(e) => { setSelectedName(e.target.value); const n = nameMap[e.target.value]; if (n) { setPoSoNo(n.PO_SO_No || ""); setLocation(n.LOCATION || ""); } }} className="w-full border rounded px-3 py-2">
                    <option value="">Select name...</option>
                    {names.map((n) => (<option key={n.name} value={n.name}>{n.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">PO/SO No</label>
                  <input readOnly value={poSoNo || ""} className="w-full border rounded px-3 py-2 bg-slate-50 dark:bg-slate-800" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Month *</label>
                  <select value={monthNum} onChange={(e) => { const m = Number(e.target.value); setMonthNum(m); setEntries(buildEntriesForMonth(year, m)); }} className="w-full border rounded px-3 py-2">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (<option key={m} value={m}>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Year *</label>
                  <input type="number" value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); setEntries(buildEntriesForMonth(y, monthNum)); }} className="w-full border rounded px-3 py-2" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Location</label>
                  <input readOnly value={location || nameMap[selectedName]?.LOCATION || nameMap[selectedName]?.location || nameMap[selectedName]?.SITE || ""} className="w-full border rounded px-3 py-2 bg-slate-50 dark:bg-slate-800" />
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Attachments</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Optional. Attach multiple docs, PDFs, or images for this timesheet.</p>
                  </div>
                  {uploading && <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Uploading...</span>}
                </div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleAttachmentChange}
                  className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[#06184b] file:px-4 file:py-2 file:text-white hover:file:bg-[#0b256e]"
                />
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file, index) => (
                      <div key={`${file.url || file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
                        <a href={file.url || "#"} target="_blank" rel="noreferrer" className="truncate text-[#0f3d7a] hover:underline">
                          {file.name || `Attachment ${index + 1}`}
                        </a>
                        <button type="button" onClick={() => removeAttachment(index)} className="shrink-0 rounded bg-red-50 dark:bg-red-950/40 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Entry Mode</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "daily", label: "Daily" },
                    { key: "weekly", label: "Weekly" },
                    { key: "project", label: "Monthly / By Project" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setEntryMode(opt.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                        entryMode === opt.key
                          ? "bg-[#06184b] text-white border-[#06184b]"
                          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {entryMode === "daily" && (
                <div className="mb-4">
                  <h4 className="text-md font-semibold mb-3 text-slate-800 dark:text-slate-200">Daily Hours Entry - {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][monthNum-1]} {year}</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800">
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Date</th>
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Day</th>
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Normal Hours</th>
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">OT Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e) => (
                          <tr key={e.date} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2">{e.date.split("-")[2]}</td>
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2 font-medium">{e.day === "Sat" || e.day === "Sun" ? <span className="text-red-600">{e.day}</span> : e.day}</td>
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2"><input type="number" value={e.normalHours} onChange={(evt) => updateEntry(entries.findIndex((x) => x.date === e.date), "normalHours", evt.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-2 py-1" min="0" step="0.5" /></td>
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2"><input type="number" value={e.otHours} onChange={(evt) => updateEntry(entries.findIndex((x) => x.date === e.date), "otHours", evt.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-2 py-1" min="0" step="0.5" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {entryMode === "weekly" && (
                <div className="mb-4">
                  <h4 className="text-md font-semibold mb-3 text-slate-800 dark:text-slate-200">Weekly Hours Entry - {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][monthNum-1]} {year}</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800">
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Week</th>
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Date Range</th>
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Normal Hours</th>
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">OT Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyEntries.map((w, idx) => (
                          <tr key={w.weekStart} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2 font-medium">{w.weekLabel}</td>
                            <td className="border px-2 py-2 text-slate-500 dark:text-slate-400">{w.weekStart} – {w.weekEnd}</td>
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2"><input type="number" value={w.normalHours} onChange={(evt) => updateWeeklyEntry(idx, "normalHours", evt.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-2 py-1" min="0" step="0.5" /></td>
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2"><input type="number" value={w.otHours} onChange={(evt) => updateWeeklyEntry(idx, "otHours", evt.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-2 py-1" min="0" step="0.5" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {entryMode === "project" && (
                <div className="mb-4">
                  <h4 className="text-md font-semibold mb-3 text-slate-800 dark:text-slate-200">
                    Monthly / By Project Hours Entry - {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][monthNum-1]} {year}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800">
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Project</th>
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">PO/SO No</th>
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Normal Hours</th>
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">OT Hours</th>
                          <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectEntries.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2"><input type="text" value={p.project} onChange={(evt) => updateProjectEntry(idx, "project", evt.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-2 py-1" placeholder="Project name" /></td>
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2"><input type="text" value={p.poSoNo} onChange={(evt) => updateProjectEntry(idx, "poSoNo", evt.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-2 py-1" placeholder="PO/SO No" /></td>
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2"><input type="number" value={p.normalHours} onChange={(evt) => updateProjectEntry(idx, "normalHours", evt.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-2 py-1" min="0" step="0.5" /></td>
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2"><input type="number" value={p.otHours} onChange={(evt) => updateProjectEntry(idx, "otHours", evt.target.value)} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-2 py-1" min="0" step="0.5" /></td>
                            <td className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center">
                              {projectEntries.length > 1 && (
                                <button type="button" onClick={() => removeProjectRow(idx)} className="text-red-600 hover:text-red-800 text-xs font-medium">✕</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" onClick={addProjectRow} className="mt-2 text-sm text-[#06184b] font-medium underline">+ Add Project</button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded">
                <div className="text-sm font-semibold">Normal: {getActiveEntries().reduce((s,e)=>s+(Number(e.normalHours)||0),0).toFixed(1)} hrs</div>
                <div className="text-sm font-semibold">OT: {getActiveEntries().reduce((s,e)=>s+(Number(e.otHours)||0),0).toFixed(1)} hrs</div>
                <div className="text-sm font-semibold">
                  KLSB Cost: {formatKlsbCost(computeKlsbCost(
                    getActiveEntries().reduce((s,e)=>s+(Number(e.normalHours)||0),0),
                    getActiveEntries().reduce((s,e)=>s+(Number(e.otHours)||0),0),
                    nameMap[selectedName]
                  ))}
                </div>
              </div>

              {message && <div className={`mb-3 p-2 rounded ${message.type === "error" ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400" : "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400"}`}>{message.text}</div>}

              <div className="flex items-center justify-end gap-2">
                {editingParentId ? (
                  <>
                    <button onClick={saveEdited} disabled={submitting} className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-60">{submitting ? "Saving..." : "Save Changes"}</button>
                    <button onClick={closeModal} className="px-3 py-1 bg-gray-200 dark:bg-slate-700 rounded">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={handleCreate} disabled={submitting} className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-60">{submitting ? "Creating..." : "Create"}</button>
                    <button onClick={closeModal} className="px-3 py-1 bg-gray-200 dark:bg-slate-700 rounded">Close</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {reviewModalOpen && reviewDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-black opacity-40" onClick={closeReviewModal} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] z-10 flex flex-col overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Review Timesheet</h3>
              <button onClick={closeReviewModal} className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium">Close</button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Name</div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{reviewDoc.staffName || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">PO/SO No</div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{reviewDoc.poSoNo || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Client</div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{reviewDoc.location || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Month</div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {(() => {
                      const parts = parseDateOnlyParts(reviewDoc.date);
                      return parts ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parts.month - 1]} ${parts.year}` : "-";
                    })()}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(reviewDoc.status)}`}>
                  {statusBadgeLabel(reviewDoc.status)}
                </span>
                {reviewDoc.status === "approved" && (
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    by {reviewDoc.approvedBy || "-"} on {reviewDoc.approvedAt ? new Date(reviewDoc.approvedAt).toLocaleString() : "-"}
                  </span>
                )}
                {reviewDoc.status === "rejected" && (
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    by {reviewDoc.rejectedBy || "-"} on {reviewDoc.rejectedAt ? new Date(reviewDoc.rejectedAt).toLocaleString() : "-"}
                    {reviewDoc.rejectReason ? ` — "${reviewDoc.rejectReason}"` : ""}
                  </span>
                )}
              </div>

              <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Attachments</h4>
                {Array.isArray(reviewDoc.attachments) && reviewDoc.attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {reviewDoc.attachments.map((url, idx) => {
                      const isImage = /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(url);
                      return (
                        <a key={idx} href={url} target="_blank" rel="noreferrer" className="block w-28 group">
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt={`Attachment ${idx + 1}`} className="w-28 h-28 object-cover rounded border border-slate-300 dark:border-slate-600 group-hover:opacity-80" />
                          ) : (
                            <div className="w-28 h-28 flex items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 group-hover:bg-slate-100 dark:group-hover:bg-slate-700">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path d="M14 2v6h6" />
                              </svg>
                            </div>
                          )}
                          <div className="mt-1 text-xs text-center text-[#0f3d7a] truncate group-hover:underline">Attachment {idx + 1}</div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No attachments uploaded</div>
                )}
              </div>

              <div className="mb-4">
                <h4 className="text-md font-semibold mb-3 text-slate-800 dark:text-slate-200">
                  {reviewDoc.entryMode === "weekly" ? "Weekly Hours" : reviewDoc.entryMode === "project" ? "Monthly / By Project Hours" : "Daily Hours"}
                </h4>
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800">
                        {reviewDoc.entryMode === "weekly" ? (
                          <>
                            <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Week</th>
                            <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Date Range</th>
                          </>
                        ) : reviewDoc.entryMode === "project" ? (
                          <>
                            <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Project</th>
                            <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">PO/SO No</th>
                          </>
                        ) : (
                          <>
                            <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Date</th>
                            <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Day</th>
                          </>
                        )}
                        <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">Normal Hours</th>
                        <th className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-left">OT Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reviewDoc.entries || []).map((e, idx) => (
                        <tr key={idx}>
                          {reviewDoc.entryMode === "weekly" ? (
                            <>
                              <td className="border border-slate-300 dark:border-slate-700 px-2 py-2 font-medium">{e.weekLabel || `Week ${idx + 1}`}</td>
                              <td className="border px-2 py-2 text-slate-500 dark:text-slate-400">{e.weekStart} – {e.weekEnd}</td>
                            </>
                          ) : reviewDoc.entryMode === "project" ? (
                            <>
                              <td className="border border-slate-300 dark:border-slate-700 px-2 py-2">{e.project || "-"}</td>
                              <td className="border border-slate-300 dark:border-slate-700 px-2 py-2">{e.poSoNo || "-"}</td>
                            </>
                          ) : (
                            <>
                              <td className="border border-slate-300 dark:border-slate-700 px-2 py-2">{e.date}</td>
                              <td className="border border-slate-300 dark:border-slate-700 px-2 py-2 font-medium">{e.day}</td>
                            </>
                          )}
                          <td className="border border-slate-300 dark:border-slate-700 px-2 py-2">{Number(e.normalHours) || 0}</td>
                          <td className="border border-slate-300 dark:border-slate-700 px-2 py-2">{Number(e.otHours) || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded">
                <div className="text-sm font-semibold">Normal: {(Number(reviewDoc.normalHours) || 0).toFixed(1)} hrs</div>
                <div className="text-sm font-semibold">OT: {(Number(reviewDoc.otHours) || 0).toFixed(1)} hrs</div>
                <div className="text-sm font-semibold">Total: {(Number(reviewDoc.totalHours) || 0).toFixed(1)} hrs</div>
                <div className="text-sm font-semibold">
                  KLSB Cost: {formatKlsbCost(computeKlsbCost(reviewDoc.normalHours, reviewDoc.otHours, nameMap[reviewDoc.staffName]))}
                </div>
              </div>

              {(!reviewDoc.status || reviewDoc.status === "submitted") && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Rejection reason (optional)</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder="e.g. total hours don't match the attached sheet"
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              )}

              {message && <div className={`mb-3 p-2 rounded ${message.type === "error" ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400" : "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400"}`}>{message.text}</div>}

              <div className="flex items-center justify-end gap-2">
                {(!reviewDoc.status || reviewDoc.status === "submitted") && (
                  <>
                    <button onClick={handleReject} disabled={rejecting || approving} className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-60">{rejecting ? "Rejecting..." : "Reject"}</button>
                    <button onClick={handleApprove} disabled={approving || rejecting} className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-60">{approving ? "Approving..." : "Approve"}</button>
                  </>
                )}
                <button onClick={closeReviewModal} className="px-3 py-1 bg-gray-200 dark:bg-slate-700 rounded">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
