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
  // memoized row to avoid re-rendering all rows on every change
  return (
    <tr key={i} className="border-t">
      <td className="px-2 py-1">{r.BIL}</td>
      <td className="px-2 py-1"><input className="w-full" value={r.STAFF_NAME ?? ""} onChange={(e) => onChange(i, "STAFF_NAME", e.target.value)} /></td>
      <td className="px-2 py-1"><input className="w-full" value={r.POSITION ?? ""} onChange={(e) => onChange(i, "POSITION", e.target.value)} /></td>
      <td className="px-2 py-1"><input className="w-full" value={r.STATUS ?? ""} onChange={(e) => onChange(i, "STATUS", e.target.value)} /></td>
      <td className="px-2 py-1"><input className="w-full" value={r.LOCATION ?? ""} onChange={(e) => onChange(i, "LOCATION", e.target.value)} /></td>
      <td className="px-2 py-1"><input className="w-full" value={r.PO_SO_No ?? ""} onChange={(e) => onChange(i, "PO_SO_No", e.target.value)} /></td>
      <td className="px-2 py-1"><input className="w-full" type="date" value={r.START_DATE ?? ""} onChange={(e) => onChange(i, "START_DATE", e.target.value)} /></td>
      <td className="px-2 py-1"><input className="w-full" type="date" value={r.END_DATE ?? ""} onChange={(e) => onChange(i, "END_DATE", e.target.value)} /></td>
      <td className="px-2 py-1"><input className="w-full" value={r.EXTENSION_STATUS ?? ""} onChange={(e) => onChange(i, "EXTENSION_STATUS", e.target.value)} /></td>
      <td className="px-2 py-1"><input className="w-full" value={r.Rate ?? ""} onChange={(e) => onChange(i, "Rate", e.target.value)} /></td>
      <td className="px-2 py-1"><input className="w-full" value={r.NH ?? ""} onChange={(e) => onChange(i, "NH", e.target.value)} /></td>
      <td className="px-2 py-1"><input className="w-full" value={r.OT ?? ""} onChange={(e) => onChange(i, "OT", e.target.value)} /></td>
      <td className="px-2 py-1 flex gap-2">
        <button onClick={() => onEdit(i)} className="text-blue-600">Edit</button>
        <button onClick={() => onRemove(i)} className="text-red-600">Remove</button>
      </td>
    </tr>
  );
}

const MemoRow = memo(Row);

export default function ManpowerTable({ initial = [] }) {
  const [rows, setRows] = useState(initial);
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
          if (Array.isArray(data) && data.length) setRows(data);
        }
      } catch (e) {
        // fallback to initial
        setRows(initial);
      }
    })();
  }, []);

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
      setRows((r) => {
        const next = [...r, { ...form }];
        return next;
      });
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
        <div className="text-sm text-[#0e2b57]/70">Records: {rows.length}</div>
        <div>
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
            {rows.map((r, i) => (
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
