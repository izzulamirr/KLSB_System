"use client";
import { useEffect, useState, useCallback, useRef, memo } from "react";
import { getAuth } from "firebase/auth";
import MondayDateInput from "./MondayDateInput";

/**
 * Modern blue-themed manpower table
 * - Clean top toolbar with search + filters
 * - Status pills with semantic colors
 * - Sticky header, soft shadows, rounded corners
 * - Accessible focus states
 * - Safe debounced sync to /api/manpower with Firebase ID token
 * - CSV import (basic) – .csv with headers matching keys
 */

async function fetchWithAuth(url, opts = {}) {
  const auth = getAuth();
  const user = auth.currentUser;
  const headers = opts.headers || {};
  if (user) {
    const token = await user.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const STORAGE_KEY = "klsb:manpower:demo";

function emptyRow() {
  return {
    BIL: null,
    STAFF_NAME: "",
    POSITION: "",
    STATUS: "",  // Employment type: Permanent, Monthly, Hourly, etc.
    STATUS_COLOR: "Active",  // Work situation: Active, Pending, Completed, Terminated
    LOCATION: "",
    PO_SO_No: "",
    START_DATE: "",
    END_DATE: "",
    END_DATE_KLSB: "",
    EXTENSION_STATUS: "",
    PAY_TYPE: "",
    NH: "",
    OT: "",
  };
}

// Function to check if KLSB end date has been exceeded
function isEndDateExceeded(endDateKlsb) {
  if (!endDateKlsb) return false;
  try {
    const end = new Date(endDateKlsb);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
    return end < today;
  } catch (e) {
    return false;
  }
}

// Function to check if regular end date has been exceeded
function isRegularEndDateExceeded(endDate) {
  if (!endDate) return false;
  try {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end < today;
  } catch (e) {
    return false;
  }
}

// Function to determine correct status color based on dates (for pill display)
function computeStatusColorFromDates(row) {
  const klsbExpired = isEndDateExceeded(row.END_DATE_KLSB);
  const endDateExpired = isRegularEndDateExceeded(row.END_DATE);
  
  // If both dates exceeded → Terminated
  if (klsbExpired && endDateExpired) {
    return "Terminated";
  }
  // If KLSB end date exceeded but END_DATE not yet exceeded → Pending
  if (klsbExpired && !endDateExpired) {
    return "Pending";
  }
  // If END_DATE exceeded (but not KLSB) → Completed
  if (endDateExpired) {
    return "Completed";
  }
  // Default to Active if no dates exceeded
  return row.STATUS_COLOR || "Active";
}

function StatusPill({ value, onChange, displayText, colorStatus, isExpired, expiryLabel }) {
  const [editing, setEditing] = useState(false);
  const statuses = ["Active", "Pending", "Completed", "Terminated"];

  // Determine CSS class. If expired, show red/rose styling but remain editable.
  const v = String(colorStatus || "").trim().toLowerCase();
  // Base color follows the explicit status color (or STATUS fallback).
  let cls = "bg-sky-50 text-sky-800 ring-1 ring-sky-200";
  if (v === "active" || v === "ongoing") cls = "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
  else if (v === "pending") cls = "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  else if (v === "completed") cls = "bg-slate-100 text-slate-700 ring-1 ring-slate-300";
  else if (v === "terminated") cls = "bg-rose-50 text-rose-800 ring-1 ring-rose-200";

  // If the KLSB end date is exceeded, visually emphasize expiration but don't override the
  // selected color — this allows users to change a terminated row back to another status/color.
  if (isExpired) {
    cls += " ring-2 ring-rose-300/60";
  }

  if (editing) {
    return (
      <select
        className={`px-2 py-1 rounded text-xs font-medium border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white min-w-[120px]`}
        value={colorStatus || ""}
        onChange={e => {
          setEditing(false);
          if (typeof onChange === 'function') onChange(e.target.value);
        }}
        onBlur={() => setEditing(false)}
        autoFocus
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">No status</option>
        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer hover:opacity-85 transition-opacity ${cls}`}
  title={expiryLabel ? expiryLabel : (isExpired ? 'EXPIRED - Click to change' : `Status: ${colorStatus || 'Not set'} - Click to change`)}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); } }}
      role="button"
    >
      {displayText || value || (isExpired ? 'EXPIRED' : 'Not set')}

    </span>
  );
}

function Cell({ children, className = "", onClick }) {
  return (
    <td className={`px-4 py-3 align-top text-[13px] leading-5 text-slate-700 ${className}`} onClick={onClick}>{children}</td>
  );
}

function ActionIconButton({ title, onClick, children, className = "" }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      aria-label={title}
      title={title}
      className={className || "p-2 rounded-md border border-transparent hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2b57]/40 transition"}
    >
      {children}
    </button>
  );
}

function Row({ r, i, onEdit, onRemove, onSelect }) {
  // STATUS = displayed text (can be employment type OR situation)
  // STATUS_COLOR = pill color derived from STATUS
  const displayText = r.STATUS || "";
  // Compute a dynamic color based on dates when STATUS_COLOR is missing.
  // This ensures the pill reflects Pending/Terminated/Completed even before running the migration.
  const computedColor = computeStatusColorFromDates(r);
  // If a user explicitly set STATUS_COLOR, respect it. Otherwise use computedColor, otherwise fallback to STATUS text.
  const colorStatus = r.STATUS_COLOR || computedColor || r.STATUS || "";

  // Check if KLSB end date has been exceeded or regular end date
  const isKlsbExpired = isEndDateExceeded(r.END_DATE_KLSB);
  const isEndExpired = isRegularEndDateExceeded(r.END_DATE);
  const isExpired = isKlsbExpired || isEndExpired;

  // Build a clearer expiry label for the tooltip
  let expiryLabel = null;
  if (isKlsbExpired && isEndExpired) expiryLabel = 'Terminated (both KLSB and End Date exceeded) - Click to change';
  else if (isKlsbExpired) expiryLabel = 'KLSB end date exceeded - Click to change';
  else if (isEndExpired) expiryLabel = 'End date exceeded - Click to change';
  
  return (
    <tr
      onClick={() => onSelect?.(r)}
      className={`border-t border-slate-200/90 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/45"} hover:bg-[#eef4fd] transition-colors`}
    >
      <Cell className="whitespace-nowrap text-slate-800 font-medium">{r.BIL}</Cell>
      <Cell>{r.STAFF_NAME || "-"}</Cell>
      <Cell>{r.POSITION || "-"}</Cell>
      <Cell>
        <StatusPill 
          value={r.STATUS}
          displayText={displayText}
          colorStatus={colorStatus}
          isExpired={isExpired}
          expiryLabel={expiryLabel}
          onChange={async newColorStatus => {
            // Manual change: update STATUS_COLOR (work situation) and mark as manually changed
            // so batch auto-updates won't overwrite this user's choice.
            const updatedRow = { 
              ...r, 
              STATUS_COLOR: newColorStatus,
              STATUS_LOCKED: true
            };
            onEdit(i, updatedRow);
            try {
              await fetchWithAuth("/api/manpower", {
                method: "PUT",
                body: JSON.stringify(updatedRow),
              });
            } catch (err) {
              // Optionally show error
              console.error("Failed to update status color", err);
            }
          }} 
        />
      </Cell>
      <Cell>{r.LOCATION || "-"}</Cell>
      <Cell>{r.PO_SO_No || "-"}</Cell>
  <Cell>{formatDate(r.START_DATE)}</Cell>
  <Cell>{formatDate(r.END_DATE)}</Cell>
  <Cell>{formatDate(r.END_DATE_KLSB)}</Cell>
  <Cell>{r.EXTENSION_STATUS || "-"}</Cell>
      <Cell>{
        (computePayType(r) === 'M') ? 'Monthly'
        : (computePayType(r) === 'H') ? 'Hourly'
        : (computePayType(r) || '-')
      }</Cell>
      <Cell>{r.NH || "-"}</Cell>
      <Cell>{r.OT || "-"}</Cell>
      {/* Action buttons intentionally removed from rows.
          Use the detail sidebar's "Edit Record" button instead. */}
    </tr>
  );
}

const MemoRow = memo(Row);

export default function ManpowerTable({ initial = [] }) {
  const [rows, setRows] = useState(() => {
    // On initial load, ensure PAY_TYPE is set according to Rate
    return initial.map(row => ({
      ...row,
      PAY_TYPE: computePayType(row)
    }));
  });
  // Whenever rows or their Rate changes, update PAY_TYPE to match logic
  useEffect(() => {
    // Compute new PAY_TYPEs for all rows
    const computed = rows.map(row => computePayType(row));
    const current = rows.map(row => row.PAY_TYPE);
    // Only update if any PAY_TYPE is out of sync
    if (computed.some((v, i) => v !== current[i])) {
      setRows(rows => rows.map((row, i) => ({ ...row, PAY_TYPE: computed[i] })));
    }
    // eslint-disable-next-line
  }, [JSON.stringify(rows.map(r => r.Rate))]);
  const [q, setQ] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [viewMode, setViewMode] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyRow());
  const [editingIndex, setEditingIndex] = useState(-1);
  const [importing, setImporting] = useState(false);
  const [rawCsvRows, setRawCsvRows] = useState([]);
  const [showRawPreview, setShowRawPreview] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [mapping, setMapping] = useState({}); // mapping[fromHeader] = targetField
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [selectedRow, setSelectedRow] = useState(null);
  const [statusSyncing, setStatusSyncing] = useState(false);
  const [statusLastSyncedAt, setStatusLastSyncedAt] = useState(null);
  const PAGE_SIZE = pageSize;
  const fileInputRef = useRef(null);

  // Initial load
  useEffect(() => {
    (async () => {
      if (Array.isArray(initial) && initial.length) {
        setRows(sortByLocationAndPoSoNoAsc(initial));
        return;
      }

      try {
        const res = await fetchWithAuth("/api/manpower?limit=2000");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) {
            setRows(sortByLocationAndPoSoNoAsc(data));
            return;
          }
        }
        const cached = getLocal();
        if (cached?.length) setRows(sortByLocationAndPoSoNoAsc(cached));
        else setRows(sortByLocationAndPoSoNoAsc(initial));
      } catch (e) {
        const cached = getLocal();
        if (cached?.length) setRows(sortByLocationAndPoSoNoAsc(cached));
        else setRows(sortByLocationAndPoSoNoAsc(initial));
      }
    })();
  }, [initial]);

  // Local backup
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {}
  }, [rows]);

  const submitForm = useCallback(
    (e) => {
      e?.preventDefault?.();
      if (!form.STAFF_NAME || !form.BIL) {
        alert("Please provide at least BIL and STAFF NAME");
        return;
      }
  // Use selected PAY_TYPE if set, otherwise compute
  const withPayType = { ...form, PAY_TYPE: form.PAY_TYPE || computePayType(form) };
      if (editingIndex >= 0) {
        setRows((r) => {
          const cp = r.map((x) => ({ ...x }));
          const targetId = cp[editingIndex]?.id;
          cp[editingIndex] = { ...cp[editingIndex], ...withPayType };
          // fire-and-forget PUT for persisted rows
          if (targetId) {
            (async () => {
              try {
                await fetchWithAuth("/api/manpower", {
                  method: "PUT",
                  body: JSON.stringify({ id: targetId, ...withPayType }),
                });
              } catch (err) {
                console.error("Update failed", err);
                alert("Update failed: " + (err.message || err));
              }
            })();
          }
          return cp;
        });
      } else {
        (async () => {
          const auth = getAuth();
          const user = auth.currentUser;
          if (user) {
            try {
              const res = await fetchWithAuth("/api/manpower", {
                method: "POST",
                body: JSON.stringify(withPayType),
              });
              if (res.ok) {
                const json = await res.json();
                setRows((r) => sortByLocationAndPoSoNoAsc([...r, { ...withPayType, id: json.id }]));
                closeForm();
                return;
              }
            } catch (err) {
              console.error("POST error", err);
            }
          }
          // fallback local
          setRows((r) => sortByLocationAndPoSoNoAsc([...r, { ...withPayType }]));
        })();
      }
      closeForm();
    },
    [editingIndex, form]
  );

  const openAddForm = useCallback((prefill = null) => {
    const maxBIL = rows.length ? Math.max(...rows.map((x) => Number(x.BIL || 0))) : 0;
    const base = { ...emptyRow(), BIL: maxBIL + 1 };
    if (prefill) Object.assign(base, prefill);
    setForm(base);
    setEditingIndex(-1);
    setShowForm(true);
  }, [rows]);

  // Allow row update for status change without opening modal
  const openEditForm = useCallback(
    (idx, updatedRow) => {
      if (typeof updatedRow === "object" && updatedRow !== null) {
        setRows(rows => rows.map((row, i) => i === idx ? updatedRow : row));
        return;
      }
      const row = rows[idx];
      if (!row) return;
      setForm({ ...row });
      setEditingIndex(idx);
      setShowForm(true);
    },
    [rows]
  );

  const closeForm = useCallback(() => {
    setShowForm(false);
    setForm(emptyRow());
    setEditingIndex(-1);
  }, []);

  const remove = useCallback(
    async (idx) => {
      const row = rows[idx];
      if (!row?.id) {
        setRows((r) => r.filter((_, i) => i !== idx));
        return;
      }
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        alert("You must be signed in to delete records.");
        return;
      }
      // optimistic remove
      const snapshot = [...rows];
      setRows((r) => r.filter((_, i) => i !== idx));
      try {
        const res = await fetchWithAuth("/api/manpower", {
          method: "DELETE",
          body: JSON.stringify({ id: row.id }),
        });
        if (!res.ok) throw new Error((await safeJson(res))?.error || res.statusText);
      } catch (e) {
        setRows(snapshot); // restore
        alert("Delete failed: " + (e.message || e));
      }
    },
    [rows]
  );

  // Auto-update all statuses based on END_DATE and END_DATE_KLSB
  const updateAllStatuses = useCallback(async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    setStatusSyncing(true);
    try {
      const updatedRows = [];
      const changedRows = [];
      let localChanged = false;

      for (const row of rows) {
        // If the row has been manually locked by a user, skip automatic updates
        if (row.STATUS_LOCKED) {
          updatedRows.push(row);
          continue;
        }

        const newStatusColor = computeStatusColorFromDates(row);
        const currentStatusColor = row.STATUS_COLOR || "";

        // Update only STATUS_COLOR (work situation), keep STATUS (employment type) unchanged
        const updatedRow = { 
          ...row, 
          STATUS_COLOR: newStatusColor
        };
        updatedRows.push(updatedRow);

        // Only update when status color actually changed
        if (newStatusColor !== currentStatusColor) {
          localChanged = true;
          if (row.id) changedRows.push(updatedRow);
        }
      }

      if (changedRows.length && user) {
        const res = await fetchWithAuth("/api/manpower", {
          method: "PUT",
          body: JSON.stringify({ rows: changedRows }),
        });
        if (!res.ok) {
          const err = await safeJson(res);
          throw new Error(err?.error || "Bulk status update failed");
        }
      }

      if (localChanged) {
        setRows(updatedRows);
      }
      setStatusLastSyncedAt(Date.now());
    } catch (err) {
      console.error("Failed to update statuses:", err);
    } finally {
      setStatusSyncing(false);
    }
  }, [rows]);

  // Keep statuses automatically synchronized in the background.
  useEffect(() => {
    if (!rows.length) return;
    updateAllStatuses();
    const id = setInterval(() => {
      updateAllStatuses();
    }, 60000);
    return () => clearInterval(id);
  }, [rows.length, updateAllStatuses]);

  // Basic CSV import (expects headers matching keys)
  const onFileChange = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const parsed = parseCSV(text); // returns array of objects
        if (!parsed.length) throw new Error("No rows detected in CSV.");
        // Store raw parsed rows and show preview; defer actual import until user confirms
        setRawCsvRows(parsed);
        // Merge CSV headers with all table columns
        const csvHeaders = Object.keys(parsed[0] || {});
        setCsvHeaders(csvHeaders);
        setShowRawPreview(true);
      } catch (err) {
        console.error(err);
        alert("Import failed: " + (err.message || err));
      } finally {
        setImporting(false);
        e.target.value = ""; // reset input
      }
    };
    reader.readAsText(file);
  }, [rows]);

  // User confirmed import of the previously parsed raw CSV rows
  const confirmRawImport = useCallback(async () => {
    if (!rawCsvRows?.length) {
      setShowRawPreview(false);
      return;
    }
    setImporting(true);
    try {
      const maxBIL = rows.length ? Math.max(...rows.map((x) => Number(x.BIL || 0))) : 0;
      let c = 0;
      function normalizeKey(k) {
        return String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      }

  const normalized = rawCsvRows.map((p) => {
        // build a map of normalized header -> original header
        const keyMap = {};
        Object.keys(p || {}).forEach((k) => {
          keyMap[normalizeKey(k)] = k;
        });
        function getVal(...aliases) {
          for (const a of aliases) {
            const nk = normalizeKey(a);
            if (nk && keyMap[nk] != null) {
              const v = p[keyMap[nk]];
              if (v == null) continue;
              const s = String(v).trim();
              if (s !== "") return s;
            }
          }
          // last attempt: try direct keys as provided
          for (const a of aliases) {
            if (p[a] != null) {
              const s = String(p[a]).trim();
              if (s !== "") return s;
            }
          }
          return null;
        }

        function getMapped(target, ...fallbackAliases) {
          // If user provided an explicit mapping, use it first
          if (mapping && Object.keys(mapping).length) {
            const from = Object.entries(mapping).find(([, to]) => to === target)?.[0];
            if (from && p[from] != null) {
              const s = String(p[from]).trim();
              if (s !== "") return s;
            }
          }
          return getVal(...fallbackAliases);
        }

        const bilRaw = getMapped("BIL", "BIL", "bil", "Bil");
        const bilNum = bilRaw ? Number(String(bilRaw).replace(/[^0-9]/g, "")) : null;
        const bil = !Number.isNaN(bilNum) && bilNum !== 0 ? bilNum : (maxBIL + (++c));

        const out = {};
        out.BIL = bil;
        const staff = getMapped("STAFF_NAME", "STAFF_NAME", "STAFF NAME", "Name", "Staff Name");
        if (staff) out.STAFF_NAME = staff;
        const pos = getMapped("POSITION", "POSITION", "Job Title", "Role");
        if (pos) out.POSITION = pos;
        const status = getMapped("STATUS", "STATUS", "State");
        if (status) out.STATUS = status;
        const loc = getMapped("LOCATION", "LOCATION", "Location", "Office");
        if (loc) out.LOCATION = loc;
        const po = getMapped("PO_SO_No", "PO_SO_No", "PO/SO No", "PO", "PO No", "PO No.");
        if (po) out.PO_SO_No = po;
        const sd = getMapped("START_DATE", "START_DATE", "START DATE", "Start Date");
        if (sd) out.START_DATE = normalizeDate(sd);
        const ed = getMapped("END_DATE", "END_DATE", "END DATE", "End Date");
  if (ed) out.END_DATE = normalizeDate(ed);
  // Map END_DATE_KLSB from CSV if present
  const edk = getMapped("END_DATE_KLSB", "END_DATE_KLSB", "END DATE KLSB", "End Date KLSB");
  if (edk) out.END_DATE_KLSB = normalizeDate(edk);
        const ext = getMapped("EXTENSION_STATUS", "EXTENSION_STATUS", "EXTENSION STATUS", "Extension Status");
        if (ext) out.EXTENSION_STATUS = ext;
        const nh = getMapped("NH", "NH", "N/H");
        if (nh) out.NH = nh;
        const ot = getMapped("OT", "OT", "O/T");
        if (ot) out.OT = ot;
  // compute pay type based on NH/OT presence
  out.PAY_TYPE = computePayType(out);

        return out;
      });

      // Debug: show what we're about to import (first 3 rows)
      try { console.log("[Import] normalized sample:", normalized.slice(0, 3)); } catch {}

      // If nothing except BIL mapped, prompt user to map columns
      const anyData = normalized.some((r) => (
        r.STAFF_NAME || r.POSITION || r.STATUS || r.LOCATION || r.PO_SO_No || r.START_DATE || r.END_DATE || r.EXTENSION_STATUS || r.NH || r.OT
      ));
      if (!anyData) {
        alert("No CSV columns matched. Please map columns before importing.");
        if (!csvHeaders.length && rawCsvRows[0]) setCsvHeaders(Object.keys(rawCsvRows[0]));
        setShowMappingModal(true);
        setImporting(false);
        return;
      }

      const auth = getAuth();
      const user = auth.currentUser;
      const successes = [];
      const failures = [];

      if (user) {
        try {
          const res = await fetchWithAuth("/api/manpower", {
            method: "POST",
            body: JSON.stringify({ rows: normalized }),
          });

          if (!res.ok) {
            const err = await safeJson(res);
            throw new Error(err?.error || res.statusText);
          }

          const json = await res.json();
          const createdRows = Array.isArray(json?.rows) ? json.rows : [];
          successes.push(...createdRows);
          setRows((r) => sortByLocationAndPoSoNoAsc([...r, ...createdRows]));
        } catch (err) {
          console.error("Bulk import failed", err);
          failures.push(...normalized.map((row) => ({ row, error: err })));
          setRows((r) => sortByLocationAndPoSoNoAsc([...r, ...normalized]));
        }
      } else {
        // Not signed-in: keep rows locally and let background sync attempt when user signs in
  setRows((r) => sortByLocationAndPoSoNoAsc([...r, ...normalized]));
        failures.push(...normalized.map((row) => ({ row, error: new Error("Not signed in") })));
      }

      // Provide a short summary to the user
      if (successes.length && failures.length === 0) {
        alert(`Imported ${successes.length} rows`);
      } else if (successes.length) {
        alert(`Imported ${successes.length} rows; ${failures.length} failed (see console)`);
      } else {
        alert(`No rows were imported. ${failures.length} rows queued locally.`);
      }
    } catch (err) {
      console.error(err);
      alert("Import failed: " + (err.message || err));
    } finally {
      setImporting(false);
      setRawCsvRows([]);
      setShowRawPreview(false);
    }
  }, [rawCsvRows, rows]);

  // Derive unique sorted location list from all rows for the dropdown
  const projectOptions = Array.from(
    new Set(rows.map((r) => String(r?.LOCATION ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  const filtered = rows
    .filter((r) => matchFilter(r, q, nameFilter, positionFilter))
    .filter((r) => !projectFilter || String(r?.LOCATION ?? "").trim() === projectFilter);

  const statusCounters = {
    all: filtered.length,
    active: filtered.filter((r) => isRowInView(r, "active")).length,
    pending: filtered.filter((r) => isRowInView(r, "pending")).length,
    closed: filtered.filter((r) => isRowInView(r, "closed")).length,
    expiring: filtered.filter((r) => isRowInView(r, "expiring")).length,
  };

  const scopedFiltered = filtered.filter((r) => isRowInView(r, viewMode));
  const sortedFiltered = scopedFiltered;

  // Reset to first page when filters change (but not when rows are updated)
  useEffect(() => {
    setPage(1);
  }, [q, nameFilter, positionFilter, projectFilter, viewMode, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const paginated = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/40 ring-1 ring-slate-200 overflow-hidden">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-5 text-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#0f3d7a] text-white ring-1 ring-[#0f3d7a]/20 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                <path d="M3 5h18M3 12h18M3 19h18" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">KLSB Workforce Register</div>
              <div className="text-xl font-semibold tracking-tight text-slate-900">Records: {sortedFiltered.length} / {rows.length}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search anywhere (BIL, Name, Position, PO, Location)"
                className="w-80 max-w-[75vw] pl-9 pr-3 py-2.5 rounded-xl text-sm text-slate-900 placeholder:text-slate-500 bg-white border border-slate-300 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d7a]/30"
              />
              <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="m21 21-4.3-4.3m0 0A7.5 7.5 0 1 0 5.5 5.5a7.5 7.5 0 0 0 11.2 11.2Z" />
              </svg>
            </div>

            <button
              onClick={() => openAddForm()}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#0f3d7a] text-white font-semibold shadow-sm hover:bg-[#0c3368] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d7a]/40"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                <path d="M12 5v14M5 12h14" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Add row
            </button>

            <input ref={fileInputRef} type="file" accept=".csv" onChange={onFileChange} className="hidden" />
            <button
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white text-slate-800 border border-slate-300 font-medium hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d7a]/40 disabled:opacity-60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                <path d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {importing ? "Importing…" : "Import CSV"}
            </button>

            <div
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold"
              title="Statuses are updated automatically every 60 seconds and on load"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{statusSyncing ? "Auto-syncing status..." : "Status auto-sync on"}</span>
              <span className="text-[11px] font-medium text-emerald-700/80">{formatRelativeTime(statusLastSyncedAt)}</span>
            </div>

            <button
              onClick={() => {
                setQ("");
                setNameFilter("");
                setPositionFilter("");
                setProjectFilter("");
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white text-slate-700 border border-slate-300 font-medium hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d7a]/40"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Scoped views */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[
            { key: "all", label: "All Records" },
            { key: "active", label: "Active" },
            { key: "pending", label: "Pending" },
            { key: "closed", label: "Closed" },
            { key: "expiring", label: "Expiring Soon" },
          ].map((v) => {
            const active = viewMode === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                  active
                    ? "bg-[#0f3d7a] text-white border-[#0f3d7a]"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>{v.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 ${active ? "bg-white/20" : "bg-slate-100"}`}>{statusCounters[v.key]}</span>
              </button>
            );
          })}
        </div>

        {/* Filter row */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Filter by Name"
            className="pl-3 pr-3 py-2.5 rounded-xl text-sm text-slate-900 placeholder:text-slate-500 bg-white border border-slate-300 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d7a]/30"
          />
          <input
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            placeholder="Filter by Position"
            className="pl-3 pr-3 py-2.5 rounded-xl text-sm text-slate-900 placeholder:text-slate-500 bg-white border border-slate-300 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d7a]/30"
          />
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="pl-3 pr-3 py-2.5 rounded-xl text-sm text-slate-900 bg-white border border-slate-300 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d7a]/30"
          >
            <option value="">All Locations</option>
            {projectOptions.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
        <div className="overflow-auto border-t border-slate-200 bg-white">
          <table className="w-full min-w-[1180px] table-auto text-sm">
          <thead className="sticky top-0 z-10 shadow-sm">
            <tr>
              {[
                "BIL",
                "STAFF NAME",
                "POSITION",
                "STATUS",
                "LOCATION",
                "PO/SO No",
                "START DATE",
                "END DATE",
                "END DATE KLSB",
                "EXTENSION STATUS",
                "PAY TYPE",
                "NH",
                "OT",
              ].map((h, i) => (
                <th
                  key={i}
                  className="text-left px-4 py-3 bg-slate-100 text-slate-700 border-b border-slate-300 font-semibold text-[11px] uppercase tracking-[0.1em] first:rounded-tl-xl last:rounded-tr-xl"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length ? (
              paginated.map((r, i) => (
                <MemoRow key={r.id ?? `${r.BIL}-${(page-1)*PAGE_SIZE + i}`} r={r} i={(page-1)*PAGE_SIZE + i} onEdit={openEditForm} onRemove={remove} onSelect={setSelectedRow} />
              ))
            ) : (
              <tr>
                <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                  No matching records. Try adjusting your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-5 py-3 bg-slate-50/80 border-t border-slate-200">
        <div className="text-sm text-slate-600">
          {sortedFiltered.length
            ? `Showing ${Math.min(sortedFiltered.length, (page - 1) * PAGE_SIZE + 1)}-${Math.min(sortedFiltered.length, page * PAGE_SIZE)} of ${sortedFiltered.length}`
            : "Showing 0 of 0"}
        </div>
        <div className="inline-flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) || 30)}
            className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-sm"
            title="Rows per page"
          >
            <option value={30}>30 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
          <button onClick={() => setPage((p) => Math.max(1, p-1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50">Prev</button>
          <div className="text-sm font-medium text-slate-700">Page {page} / {totalPages}</div>
          <button onClick={() => setPage((p) => Math.min(totalPages, p+1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50">Next</button>
        </div>
      </div>

      {/* Row detail drawer */}
      {selectedRow && (
        <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={() => setSelectedRow(null)}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl border-l border-slate-200 p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Staff Detail</p>
                <h3 className="text-xl font-semibold text-slate-900 mt-1">{selectedRow.STAFF_NAME || "Unnamed"}</h3>
              </div>
              <button onClick={() => setSelectedRow(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">✕</button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              {[
                ["BIL", selectedRow.BIL],
                ["Position", selectedRow.POSITION],
                ["Status", selectedRow.STATUS_COLOR || computeStatusColorFromDates(selectedRow) || selectedRow.STATUS],
                ["Location", selectedRow.LOCATION],
                ["PO/SO", selectedRow.PO_SO_No],
                ["Start Date", formatDate(selectedRow.START_DATE)],
                ["End Date", formatDate(selectedRow.END_DATE)],
                ["End Date KLSB", formatDate(selectedRow.END_DATE_KLSB)],
                ["Extension", selectedRow.EXTENSION_STATUS],
                ["Pay Type", computePayType(selectedRow) === "M" ? "Monthly" : "Hourly"],
                ["NH", selectedRow.NH],
                ["OT", selectedRow.OT],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-slate-900 font-medium text-right">{value || "-"}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  const idx = rows.findIndex((x) => x === selectedRow || (x.id && x.id === selectedRow.id));
                  if (idx >= 0) {
                    setSelectedRow(null);
                    openEditForm(idx);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-[#0f3d7a] text-white text-sm font-semibold hover:bg-[#0c3368]"
              >
                Edit Record
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={submitForm} className="bg-white rounded-2xl p-6 w-[min(720px,95vw)] shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingIndex >= 0 ? "Edit Staff" : "Add Staff"}
              </h3>
              <button type="button" onClick={closeForm} className="p-2 rounded-lg hover:bg-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 text-slate-600">
                  <path d="M6 6l12 12M6 18L18 6" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              {renderInput("BIL", "BIL")}
              {renderInput("Staff Name", "STAFF_NAME")}
              {renderInput("Position", "POSITION")}
              {renderInput("Status", "STATUS")}
              {/* Editable STATUS_COLOR */}
              <label className="flex flex-col">
                <span className="text-xs text-slate-500 mb-1">Status Color</span>
                <select
                  value={form.STATUS_COLOR || ""}
                  onChange={e => setForm({ ...form, STATUS_COLOR: e.target.value })}
                  className="border px-3 py-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2b57]/30"
                >
                  <option value="">(none)</option>
                  <option value="Active">Active (Green)</option>
                  <option value="Pending">Pending (Yellow)</option>
                  <option value="Completed">Completed (Gray)</option>
                  <option value="Terminated">Terminated (Red)</option>
                </select>
              </label>
              {/* Lock to prevent automatic batch updates from overwriting manual status changes */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(form.STATUS_LOCKED)}
                  onChange={e => setForm({ ...form, STATUS_LOCKED: e.target.checked })}
                  className="rounded border"
                />
                <span className="text-sm text-slate-600">Lock status from auto-updates</span>
              </label>
              {renderInput("Location", "LOCATION")}
              {renderInput("PO/SO No", "PO_SO_No")}
              {renderInput("Start Date", "START_DATE", "date")}
              {/* Editable PAY_TYPE */}
              <label className="flex flex-col">
                <span className="text-xs text-slate-500 mb-1">Pay Type</span>
                <select
                  value={form.PAY_TYPE || ""}
                  onChange={e => setForm({ ...form, PAY_TYPE: e.target.value })}
                  className="border px-3 py-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2b57]/30"
                >
                  <option value="">(auto)</option>
                  <option value="M">Monthly</option>
                  <option value="H">Hourly</option>
                </select>
              </label>
              {/* Editable END_DATE */}
              <label className="flex flex-col">
                <span className="text-xs text-slate-500 mb-1">End Date</span>
                <input
                  type="date"
                  value={form.END_DATE || ""}
                  onChange={e => setForm({ ...form, END_DATE: e.target.value })}
                  className="border px-3 py-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2b57]/30"
                />
              </label>
              {/* Editable EXTENSION_STATUS */}
              <label className="flex flex-col">
                <span className="text-xs text-slate-500 mb-1">Extension Status</span>
                <input
                  type="text"
                  value={form.EXTENSION_STATUS || ""}
                  onChange={e => setForm({ ...form, EXTENSION_STATUS: e.target.value })}
                  className="border px-3 py-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2b57]/30"
                />
              </label>
              {renderInput("NH", "NH")}
              {renderInput("OT", "OT")}
              {renderInput("End Date (KLSB)", "END_DATE_KLSB", "date")}
            </div>

            <div className="flex gap-2 justify-between mt-6">
              <div>
                {editingIndex >= 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Delete this staff record? This action cannot be undone.")) return;
                      try {
                        await remove(editingIndex);
                      } catch (e) {
                        console.error(e);
                      }
                      closeForm();
                    }}
                    className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={closeForm} className="px-3 py-2 border rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-3 py-2 rounded-lg bg-[#0e2b57] text-white font-medium shadow hover:brightness-110">Save</button>
              </div>
            </div>
          </form>
        </div>
      )}
      {/* Raw CSV preview modal (shown right after file selection) */}
      {showRawPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl p-6 w-[min(980px,98vw)] shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">CSV Preview ({rawCsvRows.length} rows)</h3>
              <div className="text-sm text-slate-500">Showing first 50 rows</div>
            </div>

            <div className="max-h-72 overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {rawCsvRows[0] && Object.keys(rawCsvRows[0]).map((h) => (
                      <th key={h} className="p-2 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawCsvRows.slice(0, 50).map((r, i) => (
                    <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      {Object.keys(rawCsvRows[0]).map((k) => (
                        <td key={k} className="p-2">{r[k]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button onClick={() => { setShowRawPreview(false); setRawCsvRows([]); }} className="px-3 py-2 border rounded-lg">Cancel</button>
              <button onClick={() => { setShowRawPreview(false); setShowMappingModal(true); }} className="px-3 py-2 border rounded-lg">Map columns</button>
              <button onClick={() => { /* Auto-import: reuse normalized confirm flow to avoid empty-field writes */
                confirmRawImport();
              }} className="px-3 py-2 rounded-lg bg-white/5 text-slate-900">Auto-import</button>
              <button onClick={() => confirmRawImport()} className="px-3 py-2 rounded-lg bg-[#0e2b57] text-white">Confirm Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Mapping modal */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl p-6 w-[min(880px,98vw)] shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Map CSV Columns</h3>
              <button onClick={() => { setShowMappingModal(false); setShowRawPreview(true); }} className="p-2 rounded hover:bg-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 text-slate-600"><path d="M6 6l12 12M6 18L18 6" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-3">Choose where each CSV column should go. Unmapped columns will be ignored.</p>

            <div className="max-h-80 overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 text-left">CSV Header</th>
                    <th className="p-2 text-left">Map to field</th>
                  </tr>
                </thead>
                <tbody>
                  {csvHeaders.map((h) => (
                    <tr key={h} className="border-t">
                      <td className="p-2 align-top font-medium text-slate-700">{h}</td>
                      <td className="p-2">
                        <select
                          value={mapping[h] || ''}
                          onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                          className="border px-2 py-1 rounded w-60"
                        >
                          <option value="">(skip)</option>
                          {[
                            'BIL', 'STAFF_NAME', 'POSITION', 'STATUS', 'STATUS_COLOR', 'LOCATION', 'PO_SO_No',
                            'START_DATE', 'END_DATE', 'END_DATE_KLSB', 'EXTENSION_STATUS', 'PAY_TYPE', 'NH', 'OT'
                          ].map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button onClick={() => { setShowMappingModal(false); setShowRawPreview(true); }} className="px-3 py-2 border rounded-lg">Cancel</button>
              <button onClick={() => setMapping(guessMapping(csvHeaders))} className="px-3 py-2 border rounded-lg">Auto-map</button>
              <button onClick={() => { setShowMappingModal(false); /* proceed to import using mapping */ confirmRawImport(); }} className="px-3 py-2 rounded-lg bg-[#0e2b57] text-white">Apply & Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // helpers (scoped below component for access to state setters)
  function renderInput(label, key, type = "text") {
    const val = form[key] ?? "";
    if (type === "date") {
      return (
        <label className="flex flex-col">
          <span className="text-xs text-slate-500 mb-1">{label}</span>
          <MondayDateInput
            value={val}
            onChange={(nextValue) => setForm({ ...form, [key]: nextValue })}
            className="border px-3 py-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2b57]/30"
          />
        </label>
      );
    }

    return (
      <label className="flex flex-col">
        <span className="text-xs text-slate-500 mb-1">{label}</span>
        <input
          type={type}
          value={val}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="border px-3 py-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2b57]/30"
        />
      </label>
    );
  }
}

// ===== Pure helpers (no React state) =====
function getLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sortByLocationAndPoSoNoAsc(list) {
  if (!Array.isArray(list)) return list;
  return list.slice().sort((a, b) => {
    const aLoc = String(a?.LOCATION ?? "").toLowerCase();
    const bLoc = String(b?.LOCATION ?? "").toLowerCase();
    if (aLoc < bLoc) return -1;
    if (aLoc > bLoc) return 1;

    const aPo = String(a?.PO_SO_No ?? "").toLowerCase();
    const bPo = String(b?.PO_SO_No ?? "").toLowerCase();
    if (aPo < bPo) return -1;
    if (aPo > bPo) return 1;
    return 0;
  });
}



function sortByBilAsc(list) {
  if (!Array.isArray(list)) return list;
  return list.slice().sort((a, b) => {
    const aBil = Number(a?.BIL ?? a?.bil ?? -Infinity);
    const bBil = Number(b?.BIL ?? b?.bil ?? -Infinity);
    const aValid = !Number.isNaN(aBil);
    const bValid = !Number.isNaN(bBil);
    if (aValid && bValid) return aBil - bBil; // ascending
    if (aValid) return -1; // valid BILs first
    if (bValid) return 1;
    return 0;
  });
}

function parseTimestamp(v) {
  if (!v) return null;
  if (typeof v === "number") return v;
  const ms = Date.parse(v);
  if (!Number.isNaN(ms)) return ms;
  return null;
}

function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toISOString().slice(0, 10);
}

function normalizeDate(v) {
  if (!v) return "";
  // Try parse common CSV formats (DD/MM/YYYY or MM/DD/YYYY or ISO)
  const s = String(v).trim();
  // If ISO-like
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // If DD/MM/YYYY or D/M/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [_, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  // Fallback to Date.parse
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return s;
}

function computePayType(row) {
  // If NH or OT is blank, PAY_TYPE is 'M' (monthly), otherwise 'H' (hourly)
  const nh = row?.NH;
  const ot = row?.OT;
  const isBlank = (x) => x === undefined || x === null || String(x).trim() === "";
  if (isBlank(nh) || isBlank(ot)) return "M";
  return "H";
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function matchFilter(row, q, nameQ, positionQ) {
  try {
    if (q) {
      const s = String(q).trim().toLowerCase();
      if (String(row.BIL ?? "").toLowerCase().includes(s)) return true;
      if (String(row.STAFF_NAME ?? "").toLowerCase().includes(s)) return true;
      if (String(row.POSITION ?? "").toLowerCase().includes(s)) return true;
      if (String(row.LOCATION ?? "").toLowerCase().includes(s)) return true;
      if (String(row.PO_SO_No ?? "").toLowerCase().includes(s)) return true;
      return false;
    }

    if (nameQ) {
      const s = String(nameQ).trim().toLowerCase();
      if (!String(row.STAFF_NAME ?? "").toLowerCase().includes(s)) return false;
    }

    if (positionQ) {
      const s = String(positionQ).trim().toLowerCase();
      if (!String(row.POSITION ?? "").toLowerCase().includes(s)) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

function formatRelativeTime(ts) {
  if (!ts) return "waiting...";
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function parseCSV(text) {
  // Robust CSV parser with delimiter auto-detect (comma, semicolon, or tab)
  if (!text) return [];
  // Remove BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  // Normalize newlines
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Detect delimiter by scanning first non-empty line ignoring quotes
  function detectDelimiter(s) {
    const candidates = [',', ';', '\t'];
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let inQ = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') {
        if (inQ && s[i + 1] === '"') { i++; continue; }
        inQ = !inQ; continue;
      }
      if (!inQ && (ch === ',' || ch === ';' || ch === '\t')) counts[ch]++;
      if (ch === '\n') break;
    }
    let best = ',';
    let bestCount = -1;
    for (const c of candidates) {
      if (counts[c] > bestCount) { best = c; bestCount = counts[c]; }
    }
    return best;
  }

  const delim = detectDelimiter(text);

  const rows = [];
  let cur = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; continue; }
      inQuotes = !inQuotes; continue;
    }
    if (ch === delim && !inQuotes) { row.push(cur); cur = ''; continue; }
    if (ch === '\n' && !inQuotes) { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
    cur += ch;
  }
  if (cur !== '' || inQuotes) row.push(cur);
  if (row.length) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map((h) => String(h || '').trim());
  // Forward-fill for merged cells: only for STAFF_NAME, POSITION, STATUS, LOCATION
  // Forward-fill for merged cells: only for STAFF_NAME, POSITION, STATUS, LOCATION (with header variants)
  const forwardFillKeys = [
    k => /^(staff[ _]?name|name)$/i.test(k),
    k => /^position$/i.test(k),
    k => /^status$/i.test(k),
    k => /^location$/i.test(k)
  ];
  const lastVals = {};
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    let cols = rows[r];
    if (cols.length < headers.length) {
      cols = [...cols, ...Array(headers.length - cols.length).fill("")];
    }
    if (cols.every((c) => String(c || '').trim() === '')) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col_${c}`;
      let val = String((cols[c] ?? '')).trim();
      // Forward-fill if key matches any of the patterns
      if (forwardFillKeys.some(fn => fn(key))) {
        if (val === "") {
          val = lastVals[key] ?? "";
        } else {
          lastVals[key] = val;
        }
      }
      obj[key] = val;
    }
    out.push(obj);
  }
  return out;
}

function guessMapping(headers) {
  // Make every CSV column available for mapping to any table header, and vice versa
  const tableHeaders = [
    'BIL', 'STAFF_NAME', 'POSITION', 'STATUS', 'STATUS_COLOR', 'LOCATION', 'PO_SO_No',
    'START_DATE', 'END_DATE', 'END_DATE_KLSB', 'EXTENSION_STATUS', 'PAY_TYPE', 'NH', 'OT'
  ];
  function normalize(s) {
    return String(s || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  }
  // Build a mapping from normalized table header to table header
  const normalizedTable = Object.fromEntries(tableHeaders.map(h => [normalize(h), h]));
  const m = {};
  (headers || []).forEach((csvHeader) => {
    const norm = normalize(csvHeader);
    if (normalizedTable[norm]) {
      m[csvHeader] = normalizedTable[norm];
    } else {
      m[csvHeader] = '';
    }
  });
  return m;
}

function isRowInView(row, viewMode) {
  if (!viewMode || viewMode === "all") return true;

  const status = String(row?.STATUS_COLOR || computeStatusColorFromDates(row) || row?.STATUS || "")
    .trim()
    .toLowerCase();

  if (viewMode === "active") return status.includes("active") || status.includes("ongoing");
  if (viewMode === "pending") return status.includes("pending");
  if (viewMode === "closed") {
    return status.includes("completed") || status.includes("terminated") || status.includes("closed");
  }
  if (viewMode === "expiring") {
    const klsbTs = parseTimestamp(row?.END_DATE_KLSB);
    if (klsbTs == null) return false;
    const now = Date.now();
    const in14Days = now + 14 * 24 * 60 * 60 * 1000;
    return klsbTs >= now && klsbTs <= in14Days;
  }

  return true;
}