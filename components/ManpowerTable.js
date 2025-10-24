"use client";
import { useEffect, useState, useCallback, useRef, memo } from "react";
import { getAuth } from "firebase/auth";

/**
 * Modern manpower table (Redesigned)
 * - Light, clean layout with grouped controls
 * - Filter card + Table card separation
 * - Light, blurred sticky header
 * - Semantic status pills
 * - Accessible focus states (indigo theme)
 * - Safe debounced sync to /api/manpower with Firebase ID token
 * - CSV import with column mapping
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
    STATUS: "",
    LOCATION: "",
    PO_SO_No: "",
    START_DATE: "",
    END_DATE: "",
    END_DATE_KLSB: "",
    EXTENSION_STATUS: "",
    Rate: "",
    PAY_TYPE: "",
    NH: "",
    OT: "",
  };
}

// StatusPill is already modern and well-implemented. No changes needed.
function StatusPill({ value }) {
  const v = String(value || "").trim().toLowerCase();
  const map = {
    active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    ongoing: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    completed: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
    terminated: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    default: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  };
  const cls = map[v] || map.default;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}
    >
      {value || "—"}
    </span>
  );
}

// Cell: Updated to use `gray` theme
function Cell({ children, className = "" }) {
  return (
    <td
      className={`px-4 py-3 align-top text-sm text-gray-700 ${className}`}
    >
      {children}
    </td>
  );
}

// ActionIconButton: Updated to use `gray` theme and `indigo` focus
function ActionIconButton({ title, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={title}
      title={title}
      className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition"
    >
      {children}
    </button>
  );
}

// Row: Updated to use `gray` theme
function Row({ r, i, onEdit, onRemove }) {
  return (
    <tr
      className={`border-t border-gray-100 ${
        i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
      } hover:bg-gray-100/70 transition-colors`}
    >
      <Cell className="whitespace-nowrap text-gray-900 font-medium">
        {r.BIL}
      </Cell>
      <Cell>{r.STAFF_NAME || "-"}</Cell>
      <Cell>{r.POSITION || "-"}</Cell>
      <Cell>
        <StatusPill value={r.STATUS} />
      </Cell>
      <Cell>{r.LOCATION || "-"}</Cell>
      <Cell>{r.PO_SO_No || "-"}</Cell>
  <Cell>{formatDate(r.START_DATE)}</Cell>
  <Cell>{formatDate(r.END_DATE)}</Cell>
  <Cell>{formatDate(r.END_DATE_KLSB)}</Cell>
  <Cell>{r.EXTENSION_STATUS || "-"}</Cell>
      <Cell>{r.Rate || "-"}</Cell>
      <Cell>{
        (computePayType(r) === 'M') ? 'Monthly'
        : (computePayType(r) === 'H') ? 'Hourly'
        : (computePayType(r) || '-')
      }</Cell>
      <Cell>{r.NH || "-"}</Cell>
      <Cell>{r.OT || "-"}</Cell>
      <Cell className="text-right">
        <div className="inline-flex items-center gap-1">
          <ActionIconButton title="Edit" onClick={() => onEdit(i)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M4 13.5V17h3.5L17.65 6.85a1 1 0 0 0 0-1.41L15.56 3.29a1 1 0 0 0-1.41 0L4 13.5z"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </ActionIconButton>
          <ActionIconButton title="Delete" onClick={() => onRemove(i)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-rose-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 11v6M14 11v6"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </ActionIconButton>
        </div>
      </Cell>
    </tr>
  );
}

const MemoRow = memo(Row);

export default function ManpowerTable({ initial = [] }) {
  const [rows, setRows] = useState(() => {
    // On initial load, ensure PAY_TYPE is set according to Rate
      // Ensure table always displays rows sorted by BIL ascending regardless of internal insertion order
      const sortedRows = sortByBilAsc(initial);
      return sortedRows.map(row => ({
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
  const [statusFilter, setStatusFilter] = useState("");
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
  const PAGE_SIZE = 30;
  const dirtyRef = useRef(false);
  const syncTimer = useRef(null);
  const fileInputRef = useRef(null);

  // --- CORE LOGIC (UNCHANGED) ---

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth("/api/manpower");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) {
            setRows(sortByBilAsc(data));
            return;
          }
        }
        // fall back to localStorage or initial
        const cached = getLocal();
  if (cached?.length) setRows(sortByBilAsc(cached));
  else setRows(sortByBilAsc(initial));
      } catch (e) {
        const cached = getLocal();
  if (cached?.length) setRows(sortByBilAsc(cached));
  else setRows(sortByBilAsc(initial));
      }
    })();
  }, []);

  // Local backup
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {}
  }, [rows]);

  // Debounced background sync
  useEffect(() => {
    dirtyRef.current = true;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      (async () => {
        try {
          for (const r of rows) {
            if (r.id) {
              await fetchWithAuth("/api/manpower", {
                method: "PUT",
                body: JSON.stringify(r),
              });
            } else {
              const res = await fetchWithAuth("/api/manpower", {
                method: "POST",
                body: JSON.stringify(r),
              });
              if (res.ok) {
                const json = await res.json();
                if (json.id) r.id = json.id;
              }
            }
          }
          dirtyRef.current = false;
        } catch (e) {
          console.error("Background sync failed", e);
        }
      })();
    }, 800);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
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
                setRows((r) =>
                  sortByBilAsc([...r, { ...withPayType, id: json.id }])
                );
                closeForm();
                return;
              }
            } catch (err) {
              console.error("POST error", err);
            }
          }
          // fallback local
          setRows((r) => sortByBilAsc([...r, { ...withPayType }]));
        })();
      }
      closeForm();
    },
    [editingIndex, form]
  );

  const openAddForm = useCallback(
    (prefill = null) => {
      const maxBIL = rows.length
        ? Math.max(...rows.map((x) => Number(x.BIL || 0)))
        : 0;
      const base = { ...emptyRow(), BIL: maxBIL + 1 };
      if (prefill) Object.assign(base, prefill);
      setForm(base);
      setEditingIndex(-1);
      setShowForm(true);
    },
    [rows]
  );

  const openEditForm = useCallback(
    (idx) => {
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
        if (!res.ok)
          throw new Error((await safeJson(res))?.error || res.statusText);
      } catch (e) {
        setRows(snapshot); // restore
        alert("Delete failed: " + (e.message || e));
      }
    },
    [rows]
  );

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
  setCsvHeaders(Object.keys(parsed[0] || {}));
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
  }, []); // Removed `rows` dependency, it's not needed here

  // User confirmed import of the previously parsed raw CSV rows
  const confirmRawImport = useCallback(async () => {
    if (!rawCsvRows?.length) {
      setShowRawPreview(false);
      return;
    }
    setImporting(true);
    try {
      const maxBIL = rows.length
        ? Math.max(...rows.map((x) => Number(x.BIL || 0)))
        : 0;
      let c = 0;
      function normalizeKey(k) {
        return String(k || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
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
            const from = Object.entries(mapping).find(
              ([, to]) => to === target
            )?.[0];
            if (from && p[from] != null) {
              const s = String(p[from]).trim();
              if (s !== "") return s;
            }
          }
          return getVal(...fallbackAliases);
        }

        const bilRaw = getMapped("BIL", "BIL", "bil", "Bil");
        const bilNum = bilRaw
          ? Number(String(bilRaw).replace(/[^0-9]/g, ""))
          : null;
        const bil =
          !Number.isNaN(bilNum) && bilNum !== 0 ? bilNum : maxBIL + ++c;

        const out = {};
        out.BIL = bil;
        const staff = getMapped(
          "STAFF_NAME",
          "STAFF_NAME",
          "STAFF NAME",
          "Name",
          "Staff Name"
        );
        if (staff) out.STAFF_NAME = staff;
        const pos = getMapped("POSITION", "POSITION", "Job Title", "Role");
        if (pos) out.POSITION = pos;
        const status = getMapped("STATUS", "STATUS", "State");
        if (status) out.STATUS = status;
        const loc = getMapped("LOCATION", "LOCATION", "Location", "Office");
        if (loc) out.LOCATION = loc;
        const po = getMapped(
          "PO_SO_No",
          "PO_SO_No",
          "PO/SO No",
          "PO",
          "PO No",
          "PO No."
        );
        if (po) out.PO_SO_No = po;
        const sd = getMapped(
          "START_DATE",
          "START_DATE",
          "START DATE",
          "Start Date"
        );
        if (sd) out.START_DATE = normalizeDate(sd);
        const ed = getMapped("END_DATE", "END_DATE", "END DATE", "End Date");
        if (ed) out.END_DATE = normalizeDate(ed);
        const ext = getMapped("EXTENSION_STATUS", "EXTENSION_STATUS", "EXTENSION STATUS", "Extension Status");
        if (ext) out.EXTENSION_STATUS = ext;
        const rate = getMapped("Rate", "Rate", "RATE", "Salary");
        if (rate) out.Rate = rate;
        const nh = getMapped("NH", "NH", "N/H");
        if (nh) out.NH = nh;
        const ot = getMapped("OT", "OT", "O/T");
        if (ot) out.OT = ot;
  // compute pay type ('M' if NH or OT is blank, else 'H')
  out.PAY_TYPE = computePayType(out);

        return out;
      });

      // Debug: show what we're about to import (first 3 rows)
      try {
        console.log("[Import] normalized sample:", normalized.slice(0, 3));
      } catch {}

      // If nothing except BIL mapped, prompt user to map columns
      const anyData = normalized.some((r) => (
        r.STAFF_NAME || r.POSITION || r.STATUS || r.LOCATION || r.PO_SO_No || r.START_DATE || r.END_DATE || r.EXTENSION_STATUS || r.Rate || r.NH || r.OT
      ));
      if (!anyData) {
        alert("No CSV columns matched. Please map columns before importing.");
        if (!csvHeaders.length && rawCsvRows[0])
          setCsvHeaders(Object.keys(rawCsvRows[0]));
        setShowMappingModal(true);
        setImporting(false);
        return;
      }

      const auth = getAuth();
      const user = auth.currentUser;
      const successes = [];
      const failures = [];

      if (user) {
        // Persist each row to backend so we get document ids immediately
        const createdRows = [];
        const localFailures = [];
        for (let i = 0; i < normalized.length; i++) {
          const row = normalized[i];
          try {
            const res = await fetchWithAuth("/api/manpower", {
              method: "POST",
              body: JSON.stringify(row),
            });
            if (res.ok) {
              const json = await res.json();
              createdRows.push({ ...row, id: json.id });
              successes.push({ ...row, id: json.id });
            } else {
              const err = await safeJson(res);
              console.error("Import row failed", err || res.statusText);
              localFailures.push({ row, error: err || res.statusText });
              failures.push({ row, error: err || res.statusText });
            }
          } catch (err) {
            console.error("Import row error", err);
            localFailures.push({ row, error: err });
            failures.push({ row, error: err });
          }
        }
        // Batch update UI once
        setRows((r) =>
          sortByBilAsc([
            ...r,
            ...createdRows,
            ...localFailures.map((f) => f.row),
          ])
        );
      } else {
        // Not signed-in: keep rows locally and let background sync attempt when user signs in
        setRows((r) => sortByBilAsc([...r, ...normalized]));
        failures.push(
          ...normalized.map((row) => ({
            row,
            error: new Error("Not signed in"),
          }))
        );
      }

      // Provide a short summary to the user
      if (successes.length && failures.length === 0) {
        alert(`Imported ${successes.length} rows`);
      } else if (successes.length) {
        alert(
          `Imported ${successes.length} rows; ${failures.length} failed (see console)`
        );
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
      setShowMappingModal(false); // Close mapping modal too
      setMapping({}); // Reset mapping
    }
  }, [rawCsvRows, rows, mapping, csvHeaders]); // Added mapping and csvHeaders

  const filtered = rows.filter((r) => matchFilter(r, q, nameFilter, positionFilter, statusFilter));

  // Reset to first page when filters or rows change
  useEffect(() => {
    setPage(1);
  }, [q, nameFilter, positionFilter, statusFilter, rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // --- JSX (REDESIGNED) ---
  return (
    <div className="p-4 md:p-6 bg-gray-50/50 min-h-screen">
      {/* Top bar: Title + Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Manpower Registry
          </h1>
          <p className="text-sm text-gray-600">
            KLSB ·{" "}
            <span className="font-medium text-gray-800">
              {filtered.length}
            </span>{" "}
            matching records /{" "}
            <span className="font-medium text-gray-800">{rows.length}</span>{" "}
            total
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={onFileChange}
            className="hidden"
          />
          <button
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white text-gray-800 text-sm font-medium shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:opacity-60"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {importing ? "Importing…" : "Import CSV"}
          </button>

          <button
            onClick={() => openAddForm()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                d="M12 5v14M5 12h14"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Add row
          </button>
        </div>
      </div>

      {/* Filter card */}
      <div className="mb-4 p-4 bg-white rounded-xl shadow-sm ring-1 ring-gray-200/80">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search anywhere (BIL, Name, Position, PO, Location)"
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white ring-1 ring-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
                d="m21 21-4.3-4.3m0 0A7.5 7.5 0 1 0 5.5 5.5a7.5 7.5 0 0 0 11.2 11.2Z"
              />
            </svg>
          </div>
          <input
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Filter by Name"
            className="w-full px-4 py-2 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white ring-1 ring-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
          <input
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            placeholder="Filter by Position"
            className="w-full px-4 py-2 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white ring-1 ring-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
          <input
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Filter by Status"
            className="w-full px-4 py-2 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white ring-1 ring-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
          <button
            onClick={() => {
              setQ("");
              setNameFilter("");
              setPositionFilter("");
              setStatusFilter("");
            }}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium ring-1 ring-gray-200 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full table-auto text-sm">
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
                "EXTENSION STATUS",
                "Rate",
                "PAY TYPE",
                "NH",
                "OT",
                "",
              ].map((h, i) => (
                <th
                  key={i}
                  className="text-left px-4 py-3 bg-[#0e2b57] text-white font-semibold first:rounded-tl-2xl last:rounded-tr-2xl"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length ? (
              paginated.map((r, i) => (
                <MemoRow key={r.id ?? `${r.BIL}-${(page-1)*PAGE_SIZE + i}`} r={r} i={(page-1)*PAGE_SIZE + i} onEdit={openEditForm} onRemove={remove} />
              ))
            ) : (
              <tr>
                <td colSpan={14} className="px-4 py-12 text-center text-slate-500">
                  No matching records. Try adjusting your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination controls */}
      <div className="flex items-center justify-between px-5 py-3 bg-white/80 border-t border-slate-100">
        <div className="text-sm text-slate-600">Showing {Math.min(filtered.length, (page-1)*PAGE_SIZE+1)}–{Math.min(filtered.length, page*PAGE_SIZE)} of {filtered.length}</div>
        <div className="inline-flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p-1))} disabled={page <= 1} className="px-3 py-1 rounded-md border bg-white/50 disabled:opacity-50">Prev</button>
          <div className="text-sm">Page {page} / {totalPages}</div>
          <button onClick={() => setPage((p) => Math.min(totalPages, p+1))} disabled={page >= totalPages} className="px-3 py-1 rounded-md border bg-white/50 disabled:opacity-50">Next</button>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form
            onSubmit={submitForm}
            className="bg-white rounded-2xl p-6 w-[min(720px,95vw)] shadow-xl ring-1 ring-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingIndex >= 0 ? "Edit Staff" : "Add Staff"}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="h-5 w-5 text-gray-600"
                >
                  <path
                    d="M6 6l12 12M6 18L18 6"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              {renderInput("BIL", "BIL")}
              {renderInput("Staff Name", "STAFF_NAME")}
              {renderInput("Position", "POSITION")}
              {renderInput("Status", "STATUS")}
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
              {/* Editable END_DATE (KLSB) */}
              <label className="flex flex-col">
                <span className="text-xs text-slate-500 mb-1">End Date (KLSB)</span>
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
              {renderInput("Rate", "Rate")}
              {renderInput("NH", "NH")}
              {renderInput("OT", "OT")}
              {renderInput("End Date (KLSB)", "END_DATE_KLSB", "date")}
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                onClick={closeForm}
                className="px-3.5 py-2 rounded-lg text-gray-800 text-sm font-medium bg-white shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Raw CSV preview modal (shown right after file selection) */}
      {showRawPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-[min(980px,98vw)] shadow-xl ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                CSV Preview ({rawCsvRows.length} rows)
              </h3>
              <div className="text-sm text-gray-500">Showing first 50 rows</div>
            </div>

            <div className="max-h-72 overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {rawCsvRows[0] && Object.keys(rawCsvRows[0]).slice(0, 20).map((h) => (
                      <th key={h} className="p-2 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawCsvRows.slice(0, 50).map((r, i) => (
                    <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      {Object.keys(r).slice(0, 20).map((k) => (
                        <td key={k} className="p-2">{r[k]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRawPreview(false);
                  setRawCsvRows([]);
                }}
                className="px-3.5 py-2 rounded-lg text-gray-800 text-sm font-medium bg-white shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRawPreview(false);
                  setShowMappingModal(true);
                }}
                className="px-3.5 py-2 rounded-lg text-gray-800 text-sm font-medium bg-white shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Map columns
              </button>
              <button
                onClick={confirmRawImport}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700"
              >
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mapping modal */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-[min(880px,98vw)] shadow-xl ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Map CSV Columns</h3>
              <button
                onClick={() => {
                  setShowMappingModal(false);
                  setShowRawPreview(true);
                }}
                className="p-2 rounded hover:bg-gray-100"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="h-5 w-5 text-gray-600"
                >
                  <path
                    d="M6 6l12 12M6 18L18 6"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Choose where each CSV column should go. Unmapped columns will be
              ignored.
            </p>

            <div className="max-h-80 overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left text-xs font-medium text-gray-600">CSV Header</th>
                    <th className="p-2 text-left text-xs font-medium text-gray-600">Map to field</th>
                  </tr>
                </thead>
                <tbody>
                  {csvHeaders.map((h) => (
                    <tr key={h} className="border-t border-gray-100">
                      <td className="p-2 align-top font-medium text-gray-700">
                        {h}
                      </td>
                      <td className="p-2">
                        <select
                          value={mapping[h] || ""}
                          onChange={(e) =>
                            setMapping({ ...mapping, [h]: e.target.value })
                          }
                          className="w-60 border border-gray-300 px-2 py-1.5 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                        >
                          <option value="">(skip)</option>
                          <option value="BIL">BIL</option>
                          <option value="STAFF_NAME">STAFF_NAME</option>
                          <option value="POSITION">POSITION</option>
                          <option value="STATUS">STATUS</option>
                          <option value="LOCATION">LOCATION</option>
                          <option value="PO_SO_No">PO_SO_No</option>
                          <option value="START_DATE">START_DATE</option>
                          <option value="END_DATE">END_DATE</option>
                          <option value="EXTENSION_STATUS">EXTENSION_STATUS</option>
                          <option value="Rate">Rate</option>
                          <option value="NH">NH</option>
                          <option value="OT">OT</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowMappingModal(false);
                  setShowRawPreview(true);
                }}
                className="px-3.5 py-2 rounded-lg text-gray-800 text-sm font-medium bg-white shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setMapping(guessMapping(csvHeaders))}
                className="px-3.5 py-2 rounded-lg text-gray-800 text-sm font-medium bg-white shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Auto-map
              </button>
              <button
                onClick={() => {
                  setShowMappingModal(false);
                  /* proceed to import using mapping */
                  confirmRawImport();
                }}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700"
              >
                Apply & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // helpers (scoped below component for access to state setters)
  function renderInput(label, key, type = "text") {
    const val = form[key] ?? "";
    return (
      <label className="flex flex-col">
        <span className="text-xs font-medium text-gray-600 mb-1.5">
          {label}
        </span>
        <input
          type={type}
          value={val}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
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
  // If Rate is below 200, PAY_TYPE is 'H' (hourly), otherwise 'M' (monthly)
  let rate = row?.Rate;
  if (typeof rate === 'string') {
    rate = rate.replace(/,/g, '');
  }
  rate = parseFloat(rate);
  if (!isNaN(rate)) {
    if (rate < 700) return "H";
    return "M";
  }
  // fallback to previous logic if Rate is not a number
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

function matchFilter(row, q, nameQ, positionQ, statusQ) {
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

    if (statusQ) {
      const s = String(statusQ).trim().toLowerCase();
      if (!String(row.STATUS ?? "").toLowerCase().includes(s)) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
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
    const candidates = [",", ";", "\t"];
    const counts = { ",": 0, ";": 0, "\t": 0 };
    let inQ = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') {
        if (inQ && s[i + 1] === '"') {
          i++;
          continue;
        }
        inQ = !inQ;
        continue;
      }
      if (!inQ && (ch === "," || ch === ";" || ch === "\t")) counts[ch]++;
      if (ch === "\n") break;
    }
    let best = ",";
    let bestCount = -1;
    for (const c of candidates) {
      if (counts[c] > bestCount) {
        best = c;
        bestCount = counts[c];
      }
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
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delim && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if (ch === "\n" && !inQuotes) {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur !== "" || inQuotes) row.push(cur);
  if (row.length) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map((h) => String(h || '').trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (cols.every((c) => String(c || '').trim() === '')) continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col_${c}`;
      obj[key] = String((cols[c] ?? '')).trim();
    }
    out.push(obj);
  }
  return out;
}

function guessMapping(headers) {
  // Make every CSV column available for mapping to any table header, and vice versa
  const tableHeaders = [
    'BIL', 'STAFF_NAME', 'POSITION', 'STATUS', 'LOCATION', 'PO_SO_No',
    'START_DATE', 'END_DATE', 'END_DATE_KLSB', 'EXTENSION_STATUS', 'Rate', 'PAY_TYPE', 'NH', 'OT'
  ];
  function normalize(s) {
    return String(s || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  }
  // Build a mapping from normalized table header to table header
  const normalizedTable = Object.fromEntries(tableHeaders.map(h => [normalize(h), h]));
  const m = {};
  (headers || []).forEach((h) => {
    const key = String(h || '').toLowerCase();
    if (key.includes('bil')) m[h] = 'BIL';
    else if (key.includes('staff') || key.includes('name')) m[h] = 'STAFF_NAME';
    else if (key.includes('position') || key.includes('role') || key.includes('job')) m[h] = 'POSITION';
    else if (key.includes('status')) m[h] = 'STATUS';
    else if (key.includes('location') || key.includes('office')) m[h] = 'LOCATION';
    else if (key.includes('po') || key.includes('so')) m[h] = 'PO_SO_No';
    else if (key.includes('start')) m[h] = 'START_DATE';
    else if (key.includes('end')) m[h] = 'END_DATE';
    else if (key.includes('extension')) m[h] = 'EXTENSION_STATUS';
    else if (key.includes('rate') || key.includes('salary')) m[h] = 'Rate';
    else if (key === 'nh' || key.includes('normal hour')) m[h] = 'NH';
    else if (key === 'ot' || key.includes('overtime')) m[h] = 'OT';
  });
  return m;
}
