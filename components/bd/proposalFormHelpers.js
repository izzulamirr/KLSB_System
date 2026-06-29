"use client";

import MondayDateInput from "../MondayDateInput";

export function Field({ label, value, onChange, type = "text", disabled = false }) {
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

export function parseCurrencyInput(value) {
  if (value === null || value === undefined) return "";
  const digitsOnly = String(value).replace(/[^\d.]/g, "");
  const [wholePart, ...fractionParts] = digitsOnly.split(".");
  const fractionPart = fractionParts.join("").replace(/\./g, "").slice(0, 2);
  return fractionParts.length > 0 ? `${wholePart || "0"}.${fractionPart}` : wholePart;
}

export function formatCurrencyDisplay(value) {
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

export function calculateMaturityOnDate(submissionDate, bidValidity) {
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

export function formatAuditDate(value) {
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

// Returns an error message if the form is missing required fields, otherwise null.
export function validateProposalForm(form) {
  if (!String(form.refNo || "").trim()) return "Ref No. is required.";
  if (!String(form.titleProjectName || "").trim()) return "Title / Project is required.";
  if (!String(form.client || "").trim()) return "Client is required.";
  return null;
}
