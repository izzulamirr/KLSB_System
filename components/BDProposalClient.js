"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "../firebase";
import MondayDateInput from "./MondayDateInput";
import { formatPicString } from "../lib/picEmailMap";
import HighlightNumbers from "./HighlightNumbers";

const defaultForm = {
  submitted: true,
  refNo: "",
  dateReceived: "",
  submissionDate: "",
  titleProjectName: "",
  stage: "",
  client: "",
  scopeBusiness: "",
  deadline: "",
  bidValidity: "",
  maturityDays: "",
  maturityOnDate: "",
  valueRM: "",
  status: "PENDING",
  personInCharge: "",
  remarks: "",
};

function statusClass(status) {
  const value = String(status || "").toUpperCase();
  if (value === "WON") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (value === "LOST") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

function formatCurrency(num) {
  const value = Number(num || 0);
  if (!value) return "-";
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 }).format(value);
}

export default function BDProposalClient() {
  const [form, setForm] = useState(defaultForm);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const authorizedFetch = useCallback(async (url, options = {}) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthenticated");
    const token = await user.getIdToken();
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    return fetch(url, { ...options, headers });
  }, []);

  const loadProposals = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await authorizedFetch("/api/bd/proposals");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load proposals");
      setRows(data);
    } catch (err) {
      setError(err.message || "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const stats = useMemo(() => {
    const total = rows.length;
    const won = rows.filter((r) => String(r.status || "").toUpperCase() === "WON").length;
    const lost = rows.filter((r) => String(r.status || "").toUpperCase() === "LOST").length;
    const pending = rows.filter((r) => String(r.status || "").toUpperCase() === "PENDING").length;
    const valueTotal = rows.reduce((sum, item) => sum + Number(item.valueRM || 0), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiringSoon = rows.filter((item) => {
      if (!item.deadline) return false;
      const date = new Date(item.deadline);
      const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).length;

    return { total, won, lost, pending, valueTotal, expiringSoon };
  }, [rows]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        personInCharge: formatPicString(form.personInCharge),
      };
      const res = await authorizedFetch("/api/bd/proposals", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add proposal");

      setForm(defaultForm);
      await loadProposals();
    } catch (err) {
      setError(err.message || "Failed to add proposal");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setError("");
    try {
      const res = await authorizedFetch("/api/bd/proposals", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete proposal");
      setRows((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message || "Failed to delete proposal");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card label="Total" value={stats.total} />
        <Card label="Won" value={stats.won} />
        <Card label="Lost" value={stats.lost} />
        <Card label="Pending" value={stats.pending} />
        <Card label="Expiring (7d)" value={stats.expiringSoon} />
        <Card label="Total Value" value={formatCurrency(stats.valueTotal)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Proposal Input</h2>
        <p className="text-sm text-slate-500 mt-1">Add proposal records for BD tracking.</p>

        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 xl:col-span-1">
            <input
              type="checkbox"
              checked={form.submitted}
              onChange={(e) => setForm((f) => ({ ...f, submitted: e.target.checked }))}
              className="h-4 w-4"
            />
            Submitted
          </label>
          <Field label="Ref No." value={form.refNo} onChange={(v) => setForm((f) => ({ ...f, refNo: v }))} />
          <Field label="Date Received" type="date" value={form.dateReceived} onChange={(v) => setForm((f) => ({ ...f, dateReceived: v }))} />
          <Field label="Submission Date" type="date" value={form.submissionDate} onChange={(v) => setForm((f) => ({ ...f, submissionDate: v }))} />
          <Field label="Title / Project" value={form.titleProjectName} onChange={(v) => setForm((f) => ({ ...f, titleProjectName: v }))} />
          <Field label="Stage" value={form.stage} onChange={(v) => setForm((f) => ({ ...f, stage: v }))} />
          <Field label="Client" value={form.client} onChange={(v) => setForm((f) => ({ ...f, client: v }))} />
          <Field label="Scope (Business)" value={form.scopeBusiness} onChange={(v) => setForm((f) => ({ ...f, scopeBusiness: v }))} />
          <Field label="Deadline" type="date" value={form.deadline} onChange={(v) => setForm((f) => ({ ...f, deadline: v }))} />
          <Field label="Bid Validity (days)" type="number" value={form.bidValidity} onChange={(v) => setForm((f) => ({ ...f, bidValidity: v }))} />
          <Field label="Maturity Days" type="number" value={form.maturityDays} onChange={(v) => setForm((f) => ({ ...f, maturityDays: v }))} />
          <Field label="Maturity On Date" type="date" value={form.maturityOnDate} onChange={(v) => setForm((f) => ({ ...f, maturityOnDate: v }))} />
          <Field label="Value (RM)" type="number" value={form.valueRM} onChange={(v) => setForm((f) => ({ ...f, valueRM: v }))} />

          <label className="text-sm text-slate-700">
            <span className="mb-1 block">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="PENDING">PENDING</option>
              <option value="WON">WON</option>
              <option value="LOST">LOST</option>
            </select>
          </label>

          <Field label="Person in Charge" value={form.personInCharge} onChange={(v) => setForm((f) => ({ ...f, personInCharge: v }))} />
          <label className="text-sm text-slate-700 xl:col-span-2">
            <span className="mb-1 block">Remarks</span>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <div className="xl:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Add Proposal"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Proposal Tracker</h2>
          <button
            onClick={loadProposals}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-3 py-2 text-left">Ref</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Client</th>
                <th className="px-3 py-2 text-left">Deadline</th>
                <th className="px-3 py-2 text-left">Value</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">PIC</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">Loading proposals...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">No proposals yet.</td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 text-slate-700">
                    <td className="px-3 py-2"><HighlightNumbers text={item.refNo || "-"} /></td>
                    <td className="px-3 py-2 max-w-[240px] truncate" title={item.titleProjectName || ""}>{item.titleProjectName || "-"}</td>
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
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  if (type === "date") {
    return (
      <label className="text-sm text-slate-700">
        <span className="mb-1 block">{label}</span>
        <MondayDateInput value={value} onChange={onChange} />
      </label>
    );
  }

  return (
    <label className="text-sm text-slate-700">
      <span className="mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}
