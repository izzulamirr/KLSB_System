"use client";

import React, { useEffect, useMemo, useState } from "react";
import firebaseApp from "../firebase";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { withBasePath } from "../lib/apiPath";

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

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const [timesheetList, setTimesheetList] = useState([]);
  const [editingParentId, setEditingParentId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function refreshTimesheets() {
    const rows = await fetch(withBasePath("/api/timesheet")).then((r) => r.json());
    const arr = Array.isArray(rows) ? rows : [];
    const map = new Map();
    for (const r of arr) {
      const pid = r.parentId || r.id || `${r.staffName}-${r.date}`;
      const normalSum = Array.isArray(r.entries) ? r.entries.reduce((s, e) => s + (Number(e.normalHours) || 0), 0) : 0;
      const otSum = Array.isArray(r.entries) ? r.entries.reduce((s, e) => s + (Number(e.otHours) || 0), 0) : 0;
      if (!map.has(pid)) map.set(pid, { parentId: pid, staffName: r.staffName || "", poSoNo: r.poSoNo || "", date: r.date || "", normalHours: normalSum, otHours: otSum, totalHours: normalSum + otSum, sample: r });
      else {
        const v = map.get(pid);
        v.normalHours = (v.normalHours || 0) + normalSum;
        v.otHours = (v.otHours || 0) + otSum;
        v.totalHours = (v.normalHours || 0) + (v.otHours || 0);
        v.sample = r;
      }
    }
    setTimesheetList(Array.from(map.values()));
  }

  useEffect(() => {
    fetch(withBasePath("/api/manpower?limit=2000"))
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

  function getDayNameFromDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
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

  async function uploadFiles(files) {
    if (!files || !files.length) return [];
    setUploading(true);
    const storage = getStorage(firebaseApp);
    const uploaded = [];
    for (const f of Array.from(files)) {
      try {
        const key = `timesheet-attachments/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const ref = storageRef(storage, key);
        await uploadBytes(ref, f);
        const url = await getDownloadURL(ref);
        uploaded.push({ name: f.name, url });
      } catch (e) {
        console.error("Upload failed", e);
      }
    }
    setUploading(false);
    return uploaded;
  }

  async function handleAttachmentChange(e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    const uploaded = await uploadFiles(files);
    setAttachments((prev) => [...prev, ...uploaded]);
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
      entries,
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
        const parsedDate = new Date(firstEntryDate);
        if (!Number.isNaN(parsedDate.getTime())) {
          setYear(parsedDate.getFullYear());
          setMonthNum(parsedDate.getMonth() + 1);
        }
      }
      setEntries(
        (doc.entries || []).map((e) => ({
          date: e.date,
          day: e.day || getDayNameFromDate(e.date),
          normalHours: e.normalHours || 0,
          otHours: e.otHours || 0,
        }))
      );
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
      const payload = { id: editingParentId, entries, attachments: attachments.map((a) => a.url || a) };
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
    setEntries(buildEntriesForMonth(now.getFullYear(), now.getMonth() + 1));
    setAttachments([]);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingParentId(null);
    setMessage(null);
  }

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  return (
    <div className="max-w-6xl mx-auto p-4 relative min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-slate-500">Month</label>
            <select value={monthNum} onChange={(e) => { const m = Number(e.target.value); setMonthNum(m); setEntries(buildEntriesForMonth(year, m)); }} className="mt-1 border rounded px-3 py-2">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                <option key={m} value={m}>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">Year</label>
            <input type="number" value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); setEntries(buildEntriesForMonth(y, monthNum)); }} className="mt-1 border rounded px-3 py-2 w-28" />
          </div>
        </div>
        <div>
          <button onClick={openNewModal} className="px-4 py-2 bg-[#06184b] text-white rounded-lg shadow">+ New Timesheet</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-700">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Month</th>
                <th className="py-3 px-4">Normal Hours</th>
                <th className="py-3 px-4">OT Hours</th>
                <th className="py-3 px-4">Total Hours</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Submitted Date</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(!timesheetList || timesheetList.length === 0) ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">No timesheets found</td>
                </tr>
              ) : (
                timesheetList
                  .filter((t) => {
                    if (!t || !t.date) return true;
                    try {
                      const d = new Date(t.date);
                      return d.getFullYear() === Number(year) && (d.getMonth() + 1) === Number(monthNum);
                    } catch (e) { return true; }
                  })
                  .map((t) => {
                    const d = t.date ? new Date(t.date) : null;
                    const monthLabel = d ? `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} ${d.getFullYear()}` : "-";
                    const name = t.staffName || t.sample?.staffName || "-";
                    const normal = typeof t.normalHours === "number" ? t.normalHours.toFixed(1) : "-";
                    const ot = typeof t.otHours === "number" ? t.otHours.toFixed(1) : "-";
                    const total = (typeof t.totalHours === "number") ? t.totalHours.toFixed(1) : "-";
                    const status = t.sample?.status || "-";
                    const submitted = t.sample?.uploadedAt ? new Date(t.sample.uploadedAt).toLocaleString() : "-";
                    return (
                      <tr key={t.parentId || name || Math.random()} className="border-t">
                        <td className="py-3 px-4">{name}</td>
                        <td className="py-3 px-4">{monthLabel}</td>
                        <td className="py-3 px-4">{normal}</td>
                        <td className="py-3 px-4">{ot}</td>
                        <td className="py-3 px-4">{total}</td>
                        <td className="py-3 px-4">{status}</td>
                        <td className="py-3 px-4">{submitted}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => loadParentTimesheet(t.parentId || t.sample?.id || t.sample?._id)} className="text-sm px-2 py-1 bg-gray-100 rounded">Edit</button>
                            <button
                              onClick={() => handleDeleteTimesheet(t.parentId || t.sample?.id || t.sample?._id, name)}
                              className="inline-flex items-center justify-center rounded bg-red-50 text-red-700 p-2 hover:bg-red-100"
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

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-black opacity-40" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] z-10 flex flex-col overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-semibold text-slate-900">{editingParentId ? "Edit Timesheet" : "Create New Timesheet"}</h3>
              <button onClick={closeModal} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">Close</button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Name *</label>
                  <select value={selectedName} onChange={(e) => { setSelectedName(e.target.value); const n = nameMap[e.target.value]; if (n) { setPoSoNo(n.PO_SO_No || ""); setLocation(n.LOCATION || ""); } }} className="w-full border rounded px-3 py-2">
                    <option value="">Select name...</option>
                    {names.map((n) => (<option key={n.name} value={n.name}>{n.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">PO/SO No</label>
                  <input readOnly value={poSoNo || ""} className="w-full border rounded px-3 py-2 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Month *</label>
                  <select value={monthNum} onChange={(e) => { const m = Number(e.target.value); setMonthNum(m); setEntries(buildEntriesForMonth(year, m)); }} className="w-full border rounded px-3 py-2">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (<option key={m} value={m}>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Year *</label>
                  <input type="number" value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); setEntries(buildEntriesForMonth(y, monthNum)); }} className="w-full border rounded px-3 py-2" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Location</label>
                  <input readOnly value={location || nameMap[selectedName]?.LOCATION || nameMap[selectedName]?.location || nameMap[selectedName]?.SITE || ""} className="w-full border rounded px-3 py-2 bg-slate-50" />
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Attachments</h4>
                    <p className="text-xs text-slate-500">Optional. Attach multiple docs, PDFs, or images for this timesheet.</p>
                  </div>
                  {uploading && <span className="text-xs font-medium text-slate-500">Uploading...</span>}
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
                      <div key={`${file.url || file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                        <a href={file.url || "#"} target="_blank" rel="noreferrer" className="truncate text-[#0f3d7a] hover:underline">
                          {file.name || `Attachment ${index + 1}`}
                        </a>
                        <button type="button" onClick={() => removeAttachment(index)} className="shrink-0 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <h4 className="text-md font-semibold mb-3 text-slate-800">Daily Hours Entry - {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][monthNum-1]} {year}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border px-2 py-2 text-left">Date</th>
                        <th className="border px-2 py-2 text-left">Day</th>
                        <th className="border px-2 py-2 text-left">Normal Hours</th>
                        <th className="border px-2 py-2 text-left">OT Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => (
                        <tr key={e.date} className="hover:bg-slate-50">
                          <td className="border px-2 py-2">{e.date.split("-")[2]}</td>
                          <td className="border px-2 py-2 font-medium">{e.day === "Sat" || e.day === "Sun" ? <span className="text-red-600">{e.day}</span> : e.day}</td>
                          <td className="border px-2 py-2"><input type="number" value={e.normalHours} onChange={(evt) => updateEntry(entries.findIndex((x) => x.date === e.date), "normalHours", evt.target.value)} className="w-full border rounded px-2 py-1" min="0" step="0.5" /></td>
                          <td className="border px-2 py-2"><input type="number" value={e.otHours} onChange={(evt) => updateEntry(entries.findIndex((x) => x.date === e.date), "otHours", evt.target.value)} className="w-full border rounded px-2 py-1" min="0" step="0.5" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-blue-50 rounded">
                <div className="text-sm font-semibold">Normal: {entries.reduce((s,e)=>s+(e.normalHours||0),0).toFixed(1)} hrs</div>
                <div className="text-sm font-semibold">OT: {entries.reduce((s,e)=>s+(e.otHours||0),0).toFixed(1)} hrs</div>
              </div>

              {message && <div className={`mb-3 p-2 rounded ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{message.text}</div>}

              <div className="flex items-center justify-end gap-2">
                {editingParentId ? (
                  <>
                    <button onClick={saveEdited} disabled={submitting} className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-60">{submitting ? "Saving..." : "Save Changes"}</button>
                    <button onClick={closeModal} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={handleCreate} disabled={submitting} className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-60">{submitting ? "Creating..." : "Create"}</button>
                    <button onClick={closeModal} className="px-3 py-1 bg-gray-200 rounded">Close</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
