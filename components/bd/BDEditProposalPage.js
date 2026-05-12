"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bdFetch } from "./api";
import MondayDateInput from "../MondayDateInput";
import PicSelector from "../PicSelector";
import { BD_SCOPE_OPTIONS, BD_STAGE_OPTIONS, BD_STATUS_OPTIONS } from "./options";

function normalizeForm(data = {}) {
  const status = data.status || "PENDING";
  return {
    id: data.id || "",
    submitted: Boolean(data.submitted) || String(status).toUpperCase() === "ON-GOING",
    refNo: data.refNo || "",
    dateReceived: data.dateReceived || "",
    submissionDate: data.submissionDate || "",
    titleProjectName: data.titleProjectName || "",
    stage: data.stage || "",
    client: data.client || "",
    scopeBusiness: data.scopeBusiness || "",
    deadline: data.deadline || "",
    bidValidity: data.bidValidity ?? "",
    maturityOnDate: data.maturityOnDate || "",
    googleFolderLink: data.googleFolderLink || "",
    valueRM: data.valueRM ?? "",
    status,
    personInCharge: data.personInCharge || "",
    remarks: data.remarks || "",
    remarksCreatedAt: data.remarksCreatedAt || "",
    remarksCreatedBy: data.remarksCreatedBy || "",
    remarksUpdatedAt: data.remarksUpdatedAt || "",
    remarksUpdatedBy: data.remarksUpdatedBy || "",
  };
}

function Field({ label, value, onChange, type = "text", disabled = false }) {
  if (type === "date") {
    return (
      <label className="text-sm text-slate-700">
        <span className="mb-1 block">{label}</span>
        <MondayDateInput value={value} onChange={onChange} disabled={disabled} />
      </label>
    );
  }

  if (type === "currency") {
    return (
      <label className="text-sm text-slate-700">
        <span className="mb-1 block">{label}</span>
        <input
          type="text"
          inputMode="decimal"
          value={formatCurrencyDisplay(value)}
          disabled={disabled}
          onChange={(e) => onChange(parseCurrencyInput(e.target.value))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none"
        />
      </label>
    );
  }

  return (
    <label className="text-sm text-slate-700">
      <span className="mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none"
      />
    </label>
  );
}

function parseCurrencyInput(value) {
  if (value === null || value === undefined) return "";
  const digitsOnly = String(value).replace(/[^\d.]/g, "");
  const [wholePart, ...fractionParts] = digitsOnly.split(".");
  const fractionPart = fractionParts.join("").replace(/\./g, "").slice(0, 2);
  return fractionParts.length > 0 ? `${wholePart || "0"}.${fractionPart}` : wholePart;
}

function formatCurrencyDisplay(value) {
  if (value === "" || value === null || value === undefined) return "";

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value);

  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function calculateMaturityOnDate(submissionDate, bidValidity) {
  if (!submissionDate || bidValidity === "" || bidValidity === null || bidValidity === undefined) {
    return "";
  }

  const days = Number(bidValidity);
  if (!Number.isFinite(days)) return "";

  const parsedSubmission = new Date(`${submissionDate}T00:00:00`);
  if (Number.isNaN(parsedSubmission.getTime())) return "";

  parsedSubmission.setDate(parsedSubmission.getDate() + days);
  return parsedSubmission.toISOString().split("T")[0];
}

function formatAuditDate(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString();
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000).toLocaleString();
  }

  if (typeof value?._seconds === "number") {
    return new Date(value._seconds * 1000).toLocaleString();
  }

  return String(value);
}

export default function BDEditProposalPage({ proposalId }) {
  const router = useRouter();
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

  useEffect(() => {
    const maturityOnDate = calculateMaturityOnDate(form.submissionDate, form.bidValidity);
    setForm((current) => (current.maturityOnDate === maturityOnDate ? current : { ...current, maturityOnDate }));
  }, [form.submissionDate, form.bidValidity]);

  const handlePersonInChargeChange = useCallback(
    (value) => setForm((current) => ({ ...current, personInCharge: value })),
    []
  );

  async function saveProposal() {
    if (!isReady) return;

    setError("");
    setMessage("");
    setSaving(true);
    try {
      await bdFetch("/api/bd/proposals", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      router.replace("/bd/proposals");
    } catch (err) {
      setError(err.message || "Failed to update proposal");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProposal() {
    if (!isReady || !window.confirm("Delete this proposal?")) return;

    setError("");
    setMessage("");
    setSaving(true);
    try {
      await bdFetch("/api/bd/proposals", {
        method: "DELETE",
        body: JSON.stringify({ id: form.id }),
      });
      router.replace("/bd/proposals");
    } catch (err) {
      setError(err.message || "Failed to delete proposal");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await saveProposal();
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
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900"
          aria-label="Back to tracker"
          title="Back to tracker"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
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
          <Field label="Maturity On Date" type="date" value={form.maturityOnDate} onChange={() => {}} disabled />
          <Field
            label="Google Folder Link"
            value={form.googleFolderLink}
            onChange={(value) => setForm((current) => ({ ...current, googleFolderLink: value }))}
            type="text"
          />
          <Field label="Value (RM)" type="currency" value={form.valueRM} onChange={(value) => setForm((current) => ({ ...current, valueRM: value }))} />

          <label className="text-sm text-slate-700">
            <span className="mb-1 block">Status</span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  status: e.target.value,
                  submitted: e.target.value === "ON-GOING" ? true : current.submitted,
                }))
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {BD_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium text-slate-600">Person in Charge</span>
            <PicSelector
              value={form.personInCharge}
              onChange={handlePersonInChargeChange}
            />
          </label>

          <label className="text-sm text-slate-700 xl:col-span-2">
            <span className="mb-1 block">Remarks</span>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((current) => ({ ...current, remarks: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {form.remarks && (form.remarksCreatedAt || form.remarksCreatedBy) && (
              <p className="mt-1 text-xs text-slate-500">
                Created by {form.remarksCreatedBy || "Unknown"} on {formatAuditDate(form.remarksCreatedAt)}
              </p>
            )}
          </label>

          <div className="xl:col-span-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={deleteProposal}
              disabled={saving}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-60"
            >
              Delete Proposal
            </button>
            <button
              type="button"
              onClick={saveProposal}
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
