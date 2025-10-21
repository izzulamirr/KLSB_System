"use client";
import { useEffect, useState, useCallback, useRef, memo } from "react";
import { getAuth } from "firebase/auth";

async function fetchWithAuth(url, opts = {}) {
  const auth = getAuth();
  const user = auth.currentUser;
  const headers = opts.headers || {};
  if (user) {
    const token = await user.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...headers } });
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
    EXTENSION_STATUS: "",
    Rate: "",
    NH: "",
    OT: "",
  };
}

function Row({ r, i, onChange, onEdit, onRemove }) {
  // Render read-only cells; editing happens via modal opened by Edit
  return (
    <tr key={i} className="border-t">
      <td className="px-2 py-2 align-top">{r.BIL}</td>
      <td className="px-2 py-2 align-top">{r.STAFF_NAME ?? "-"}</td>
      <td className="px-2 py-2 align-top">{r.POSITION ?? "-"}</td>
      <td className="px-2 py-2 align-top">{r.STATUS ?? "-"}</td>
      <td className="px-2 py-2 align-top">{r.LOCATION ?? "-"}</td>
      <td className="px-2 py-2 align-top">{r.PO_SO_No ?? "-"}</td>
      <td className="px-2 py-2 align-top">{r.START_DATE ?? "-"}</td>
      <td className="px-2 py-2 align-top">{r.END_DATE ?? "-"}</td>
      <td className="px-2 py-2 align-top">{r.EXTENSION_STATUS ?? "-"}</td>
      <td className="px-2 py-2 align-top">{r.Rate ?? "-"}</td>
      <td className="px-2 py-2 align-top">{r.NH ?? "-"}</td>
      <td className="px-2 py-2 align-top">{r.OT ?? "-"}</td>
      <td className="px-2 py-2 align-top flex gap-2">
        <button onClick={() => onEdit(i)} className="text-blue-600">Edit</button>
        <button onClick={() => onRemove(i)} className="text-red-600">Remove</button>
      </td>
    </tr>
  );
}

const MemoRow = memo(Row);

export default function ManpowerTable({ initial = [] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyRow());
  const [editingIndex, setEditingIndex] = useState(-1);
  const dirtyRef = useRef(false);
  const syncTimer = useRef(null);

  useEffect(() => {
    // Load from server API first
    (async () => {
      try {
        const res = await fetchWithAuth("/api/manpower");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) setRows(sortOldestFirst(data));
        }
      } catch (e) {
        // fallback to initial
        setRows(sortOldestFirst(initial));
      }
    })();
  }, []);

  // Ensure oldest entries appear at the top and newest at the bottom.
  function sortOldestFirst(list) {
    if (!Array.isArray(list)) return list;
    return list.slice().sort((a, b) => {
      const aTs = parseTimestamp(a.updatedAt || a.createdAt || a.START_DATE || a.START_DATE || null);
      const bTs = parseTimestamp(b.updatedAt || b.createdAt || b.START_DATE || b.START_DATE || null);
      if (aTs != null && bTs != null) return aTs - bTs;
      if (aTs != null) return -1;
      if (bTs != null) return 1;
      // fallback to numeric BIL if present
      const aBil = Number(a.BIL ?? a.bil ?? 0);
      const bBil = Number(b.BIL ?? b.bil ?? 0);
      if (!Number.isNaN(aBil) && !Number.isNaN(bBil)) return aBil - bBil;
      // final fallback: preserve existing order
      return 0;
    });
  }

  function parseTimestamp(v) {
    if (!v) return null;
    // If already a number
    if (typeof v === "number") return v;
    // If ISO string
    const ms = Date.parse(v);
    if (!Number.isNaN(ms)) return ms;
    return null;
  }

  function matchFilter(row, q, nameQ, positionQ, statusQ) {
    // If any specific filter is provided, all provided filters must match.
    try {
      if (q) {
        const s = String(q).trim().toLowerCase();
        if (String(row.BIL ?? "").toLowerCase().includes(s)) return true;
        if (String(row.STAFF_NAME ?? "").toLowerCase().includes(s)) return true;
        if (String(row.POSITION ?? "").toLowerCase().includes(s)) return true;
        if (String(row.LOCATION ?? "").toLowerCase().includes(s)) return true;
        if (String(row.PO_SO_No ?? "").toLowerCase().includes(s)) return true;
        // if general q is present and none matched, return false
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

      // passed all provided filters
      return true;
    } catch (e) {
      return false;
    }
  }

  // Persist changes to server when rows change (debounce could be added)
  // Debounced background sync to reduce network churn and re-renders
  useEffect(() => {
    dirtyRef.current = true;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      (async () => {
        try {
          // process rows sequentially but with reduced frequency
          for (const r of rows) {
            if (r.id) {
              await fetchWithAuth("/api/manpower", { method: "PUT", body: JSON.stringify(r) });
            } else {
              const res = await fetchWithAuth("/api/manpower", { method: "POST", body: JSON.stringify(r) });
              if (res.ok) {
                const json = await res.json();
                if (json.id) r.id = json.id; // assign returned id
              }
            }
          }
          dirtyRef.current = false;
        } catch (e) {
          // leave dirty state so user can retry; developer console for debugging
          console.error("Background sync failed", e);
        }
      })();
    }, 800); // 800ms debounce

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [rows]);

  function openAddForm(prefill = null) {
    const maxBIL = rows.length ? Math.max(...rows.map((x) => Number(x.BIL || 0))) : 0;
    const newBIL = maxBIL + 1;
    const base = { ...emptyRow(), BIL: newBIL };
    if (prefill) {
      Object.assign(base, prefill);
    }
    setForm(base);
    setEditingIndex(-1);
    setShowForm(true);
  }

  const submitForm = useCallback((e) => {
    e?.preventDefault?.();
    // basic validation
    if (!form.STAFF_NAME || !form.BIL) {
      alert("Please provide at least BIL and STAFF NAME");
      return;
    }
    if (editingIndex >= 0) {
      // update existing row in UI
      setRows((r) => {
        const cp = r.map((x) => ({ ...x }));
        cp[editingIndex] = { ...cp[editingIndex], ...form };
        return cp;
      });

      // If the row has an id (persisted), send a PUT immediately
      // perform immediate PUT for persisted rows but refer to id from previous state
      const targetId = rows[editingIndex]?.id;
      if (targetId) {
        (async () => {
          try {
            await fetchWithAuth('/api/manpower', { method: 'PUT', body: JSON.stringify({ id: targetId, ...form }) });
          } catch (err) {
            console.error('Update failed', err);
            alert('Update failed: ' + (err.message || err));
          }
        })();
      }
    } else {
      // If user is authenticated, try to POST immediately so the new row is persisted.
      (async () => {
        const { getAuth } = await import("firebase/auth");
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          try {
            const res = await fetchWithAuth("/api/manpower", { method: "POST", body: JSON.stringify(form) });
            if (res.ok) {
              const json = await res.json();
              setRows((r) => {
                const next = [...r, { ...form, id: json.id }];
                return next;
              });
              return;
            }
            // If POST failed, fall back to local add and log
            console.error("POST failed when adding row", res.status, await res.text());
          } catch (err) {
            console.error("POST error when adding row", err);
          }
        }

        // Fallback: add locally (unsynced)
        setRows((r) => {
          const next = [...r, { ...form }];
          return next;
        });
      })();
    }
    setShowForm(false);
    setForm(emptyRow());
    setEditingIndex(-1);
  }, [editingIndex, form, rows]);

  function cancelForm() {
    setShowForm(false);
    setForm(emptyRow());
  }

  const update = useCallback((idx, key, value) => {
    setRows((r) => {
      const cp = r.map((x) => ({ ...x }));
      cp[idx][key] = value;
      return cp;
    });
  }, []);

  const openEditForm = useCallback((idx) => {
    const row = rows[idx];
    if (!row) return;
    const copy = { ...row };
    setForm(copy);
    setEditingIndex(idx);
    setShowForm(true);
  }, [rows]);

  const remove = useCallback(async (idx) => {
    const row = rows[idx];

    // If this row was never persisted (no id), just remove locally
    if (!row?.id) {
      setRows((r) => r.filter((_, i) => i !== idx));
      return;
    }

    // Require an authenticated user for server-side deletes
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      alert("You must be signed in to delete records.");
      return;
    }

    // Optimistically remove from UI, but keep a copy to restore on failure
    setRows((r) => r.filter((_, i) => i !== idx));

    try {
      const res = await fetchWithAuth("/api/manpower", { method: "DELETE", body: JSON.stringify({ id: row.id }) });
      let json = null;
      try {
        json = await res.json();
      } catch (e) {
        // ignore JSON parse error
      }

      if (!res.ok) {
        // restore
        setRows((r) => {
          const cp = [...r];
          cp.splice(idx, 0, row);
          return cp;
        });
        const msg = (json && json.error) || res.statusText || "Delete failed";
        console.error("Delete failed", msg, json);
        alert("Delete failed: " + msg);
      }
    } catch (e) {
      // restore on network/error
      setRows((r) => {
        const cp = [...r];
        cp.splice(idx, 0, row);
        return cp;
      });
      console.error("Delete error", e);
      alert("Delete error: " + e.message);
    }
  }, [rows]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-[#0e2b57]/70">Records: {rows.filter(r => matchFilter(r, filter)).length} / {rows.length}</div>

        <div className="flex items-center gap-3">
          <input value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} placeholder="Name" className="px-2 py-1 border rounded text-sm" />
          <input value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} placeholder="Position" className="px-2 py-1 border rounded text-sm" />
          <input value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="Status" className="px-2 py-1 border rounded text-sm" />
          <button onClick={() => { setNameFilter(''); setPositionFilter(''); setStatusFilter(''); setFilter(''); }} className="px-3 py-1 border rounded text-sm">Clear</button>
          <button onClick={() => openAddForm()} className="px-3 py-1 rounded bg-yellow-400 text-white">Add row</button>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr>
              <th className="text-left px-2 py-1">BIL</th>
              <th className="text-left px-2 py-1">STAFF NAME</th>
              <th className="text-left px-2 py-1">POSITION</th>
              <th className="text-left px-2 py-1">STATUS</th>
              <th className="text-left px-2 py-1">LOCATION</th>
              <th className="text-left px-2 py-1">PO/SO No</th>
              <th className="text-left px-2 py-1">START DATE</th>
              <th className="text-left px-2 py-1">END DATE</th>
              <th className="text-left px-2 py-1">EXTENSION STATUS</th>
              <th className="text-left px-2 py-1">Rate</th>
              <th className="text-left px-2 py-1">NH</th>
              <th className="text-left px-2 py-1">OT</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.filter(r => matchFilter(r, filter, nameFilter, positionFilter, statusFilter)).map((r, i) => (
              <MemoRow key={r.id ?? i} r={r} i={i} onChange={update} onEdit={openEditForm} onRemove={remove} />
            ))}
          </tbody>
        </table>
      </div>
      {/* Add row modal (simple) */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <form onSubmit={submitForm} className="bg-white rounded-lg p-6 w-[90%] max-w-2xl">
            <h3 className="text-lg font-semibold mb-3">{editingIndex >= 0 ? 'Edit Staff' : 'Add Staff'}</h3>
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
              <label className="flex flex-col"><span className="text-xs">BIL</span><input value={form.BIL} onChange={(e) => setForm({ ...form, BIL: e.target.value })} className="border p-2" /></label>
              <label className="flex flex-col"><span className="text-xs">Staff Name</span><input value={form.STAFF_NAME} onChange={(e) => setForm({ ...form, STAFF_NAME: e.target.value })} className="border p-2" /></label>
              <label className="flex flex-col"><span className="text-xs">Position</span><input value={form.POSITION} onChange={(e) => setForm({ ...form, POSITION: e.target.value })} className="border p-2" /></label>
              <label className="flex flex-col"><span className="text-xs">Status</span><input value={form.STATUS} onChange={(e) => setForm({ ...form, STATUS: e.target.value })} className="border p-2" /></label>
              <label className="flex flex-col"><span className="text-xs">Location</span><input value={form.LOCATION} onChange={(e) => setForm({ ...form, LOCATION: e.target.value })} className="border p-2" /></label>
              <label className="flex flex-col"><span className="text-xs">PO/SO No</span><input value={form.PO_SO_No} onChange={(e) => setForm({ ...form, PO_SO_No: e.target.value })} className="border p-2" /></label>
              <label className="flex flex-col"><span className="text-xs">Start Date</span><input type="date" value={form.START_DATE} onChange={(e) => setForm({ ...form, START_DATE: e.target.value })} className="border p-2" /></label>
              <label className="flex flex-col"><span className="text-xs">End Date</span><input type="date" value={form.END_DATE} onChange={(e) => setForm({ ...form, END_DATE: e.target.value })} className="border p-2" /></label>
              <label className="flex flex-col"><span className="text-xs">Extension Status</span><input value={form.EXTENSION_STATUS} onChange={(e) => setForm({ ...form, EXTENSION_STATUS: e.target.value })} className="border p-2" /></label>
              <label className="flex flex-col"><span className="text-xs">Rate</span><input value={form.Rate} onChange={(e) => setForm({ ...form, Rate: e.target.value })} className="border p-2" /></label>
              <label className="flex flex-col"><span className="text-xs">NH</span><input value={form.NH} onChange={(e) => setForm({ ...form, NH: e.target.value })} className="border p-2" /></label>
              <label className="flex flex-col"><span className="text-xs">OT</span><input value={form.OT} onChange={(e) => setForm({ ...form, OT: e.target.value })} className="border p-2" /></label>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={cancelForm} className="px-3 py-1 border rounded">Cancel</button>
              <button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

