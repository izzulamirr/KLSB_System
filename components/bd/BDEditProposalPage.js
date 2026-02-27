"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { bdFetch } from "./api";
import { BD_SCOPE_OPTIONS, BD_STAGE_OPTIONS, BD_STATUS_OPTIONS } from "./options";

function normalizeForm(data = {}) {
  return {
    id: data.id || "",
    submitted: Boolean(data.submitted),
    refNo: data.refNo || "",
    dateReceived: data.dateReceived || "",
    submissionDate: data.submissionDate || "",
    titleProjectName: data.titleProjectName || "",
    stage: data.stage || "",
    client: data.client || "",
    scopeBusiness: data.scopeBusiness || "",
    deadline: data.deadline || "",
    bidValidity: data.bidValidity ?? "",
    maturityDays: data.maturityDays ?? "",
    maturityOnDate: data.maturityOnDate || "",
    valueRM: data.valueRM ?? "",
    status: data.status || "PENDING",
    personInCharge: data.personInCharge || "",
    remarks: data.remarks || "",
  };
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="text-sm text-slate-700">
      <span className="mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

export default function BDEditProposalPage({ proposalId }) {
  const [form, setForm] = useState(normalizeForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      setError("");
      setLoading(true);
      try {
        const data = await bdFetch(`/api/bd/proposals?id=${proposalId}`);
        setForm(normalizeForm(data));
      } catch (err) {
        setError(err.message || "Failed to load proposal");
      } finally {
        setLoading(false);
      }
    }

    if (proposalId) {
      load();
    }
  }, [proposalId]);

  const isReady = useMemo(() => Boolean(form.id), [form.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isReady) return;

    setError("");
    setMessage("");
    setSaving(true);
    try {
      await bdFetch("/api/bd/proposals", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setMessage("Proposal updated successfully.");
    } catch (err) {
      setError(err.message || "Failed to update proposal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-indigo-50/40 to-violet-50/40 p-6 shadow-[0_16px_30px_rgba(15,23,42,0.08)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Edit Proposal</h2>
          <p className="text-sm text-slate-500 mt-1">Update selected proposal details.</p>
        </div>
        <Link
          href="/bd/proposals"
          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Back to Tracker
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading proposal...</p>}
      {error && <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {message && <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-700">{message}</p>}

      {!loading && isReady && (
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 xl:col-span-1">
            <input
              type="checkbox"
              checked={form.submitted}
              onChange={(e) => setForm((current) => ({ ...current, submitted: e.target.checked }))}
              className="h-4 w-4"
            />
            Submitted
          </label>

          <Field label="Ref No." value={form.refNo} onChange={(value) => setForm((current) => ({ ...current, refNo: value }))} />
          <Field label="Date Received" type="date" value={form.dateReceived} onChange={(value) => setForm((current) => ({ ...current, dateReceived: value }))} />
          <Field label="Submission Date" type="date" value={form.submissionDate} onChange={(value) => setForm((current) => ({ ...current, submissionDate: value }))} />
          <Field label="Title / Project" value={form.titleProjectName} onChange={(value) => setForm((current) => ({ ...current, titleProjectName: value }))} />
          <label className="text-sm text-slate-700">
            <span className="mb-1 block">Stage</span>
            <select
              value={form.stage}
              onChange={(e) => setForm((current) => ({ ...current, stage: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Select stage</option>
              {BD_STAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <Field label="Client" value={form.client} onChange={(value) => setForm((current) => ({ ...current, client: value }))} />
          <label className="text-sm text-slate-700">
            <span className="mb-1 block">Scope (Business)</span>
            <select
              value={form.scopeBusiness}
              onChange={(e) => setForm((current) => ({ ...current, scopeBusiness: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Select scope</option>
              {BD_SCOPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <Field label="Deadline" type="date" value={form.deadline} onChange={(value) => setForm((current) => ({ ...current, deadline: value }))} />
          <Field label="Bid Validity" type="number" value={form.bidValidity} onChange={(value) => setForm((current) => ({ ...current, bidValidity: value }))} />
          <Field label="Maturity Days" type="number" value={form.maturityDays} onChange={(value) => setForm((current) => ({ ...current, maturityDays: value }))} />
          <Field label="Maturity On Date" type="date" value={form.maturityOnDate} onChange={(value) => setForm((current) => ({ ...current, maturityOnDate: value }))} />
          <Field label="Value (RM)" type="number" value={form.valueRM} onChange={(value) => setForm((current) => ({ ...current, valueRM: value }))} />

          <label className="text-sm text-slate-700">
            <span className="mb-1 block">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {BD_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <Field label="Person in Charge" value={form.personInCharge} onChange={(value) => setForm((current) => ({ ...current, personInCharge: value }))} />

          <label className="text-sm text-slate-700 xl:col-span-2">
            <span className="mb-1 block">Remarks</span>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((current) => ({ ...current, remarks: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="xl:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(37,99,235,0.3)] hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Update Proposal"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
