"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { bdFetch, formatCurrency, statusClass } from "./api";

export default function BDProposalTrackerPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Proposal Tracker</h2>
          <p className="text-sm text-slate-500 mt-1">All BD proposals in one table.</p>
        </div>
        <button
          onClick={load}
          className="rounded-xl border border-blue-300 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-sm text-white shadow-[0_10px_20px_rgba(37,99,235,0.28)] hover:from-blue-700 hover:to-indigo-700"
        >
          Refresh
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-indigo-50 text-slate-500">
              <th className="px-3 py-2 text-left">Ref No</th>
              <th className="px-3 py-2 text-left">Date Received</th>
              <th className="px-3 py-2 text-left">Title / Project</th>
              <th className="px-3 py-2 text-left">Client</th>
              <th className="px-3 py-2 text-left">Deadline</th>
              <th className="px-3 py-2 text-left">Value (RM)</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">PIC</th>
              <th className="px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">Loading proposals...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">No proposals found.</td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.id} className="border-t border-slate-200 text-slate-700 hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2">{item.refNo || "-"}</td>
                  <td className="px-3 py-2">{item.dateReceived || "-"}</td>
                  <td className="px-3 py-2 max-w-[280px] truncate" title={item.titleProjectName || ""}>{item.titleProjectName || "-"}</td>
                  <td className="px-3 py-2">{item.client || "-"}</td>
                  <td className="px-3 py-2">{item.deadline || "-"}</td>
                  <td className="px-3 py-2">{formatCurrency(item.valueRM)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(item.status)}`}>
                      {item.status || "PENDING"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{item.personInCharge || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/bd/proposals/${item.id}/edit`}
                        className="rounded-lg border border-blue-300 bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
