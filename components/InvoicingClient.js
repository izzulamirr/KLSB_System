"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { withBasePath } from "../lib/apiPath";
import MondayDateInput from "./MondayDateInput";
const initialRows = [
  {
    sent: true,
    invoiceNo: "2394-002",
    invoiceType: "ACTUAL",
    dateIssued: "15-May-24",
    poSoNumber: "",
    clientName: "26-DCSE TECH SDN BHD",
    timesheetMonth: "April 2024",
    details: "GROUP",
    invoiceAmountWoSst: "3,000.00",
    invoiceAmountWithSst: "3,000.00",
    sstAmount: "",
    paidAmount: "3,000.00",
    balance: "0.00",
    status: "PAID",
    days: "",
    dueDate: "14-Jun-24",
    paymentDate: "29/8/25",
    notes: "",
  },
  {
    sent: true,
    invoiceNo: "1947-948",
    invoiceType: "ACTUAL",
    dateIssued: "20-Dec-24",
    poSoNumber: "1001211 Revision : 0",
    clientName: "2NOV Process & Flow Technologies Malaysia Sdn Bhd",
    timesheetMonth: "November 2024",
    details: "MARA LEAH VANESSA (Traveling Expenses Oct & Nov24)",
    invoiceAmountWoSst: "896.03",
    invoiceAmountWithSst: "896.03",
    sstAmount: "",
    paidAmount: "896.03",
    balance: "0.00",
    status: "PAID",
    days: "",
    dueDate: "19-Jan-25",
    paymentDate: "18-Jun-25",
    notes: "",
  },
  {
    sent: true,
    invoiceNo: "2410-029",
    invoiceType: "ACTUAL",
    dateIssued: "06-Nov-24",
    poSoNumber: "",
    clientName: "7-BUREAU VERITAS (M) SDN BHD",
    timesheetMonth: "November 2024",
    details: "MOHD ZAIN BIN JAMALUDDIN YUNOS",
    invoiceAmountWoSst: "150.00",
    invoiceAmountWithSst: "150.00",
    sstAmount: "",
    paidAmount: "0.00",
    balance: "150.00",
    status: "PENDING",
    days: "",
    dueDate: "07-Dec-24",
    paymentDate: "",
    notes: "",
  },
];

const columns = [
  { key: "sent", label: "Sent" },
  { key: "invoiceNo", label: "Invoice No." },
  { key: "invoiceType", label: "Invoice Type" },
  { key: "dateIssued", label: "Date Issued" },
  { key: "poSoNumber", label: "PO/SO Number" },
  { key: "clientName", label: "Client Name" },
  { key: "timesheetMonth", label: "Timesheet Month" },
  { key: "details", label: "Details" },
  { key: "invoiceAmountWoSst", label: "Invoice Amount (WO/SST)" },
  { key: "invoiceAmountWithSst", label: "Invoice Amount (With SST)" },
  { key: "sstAmount", label: "SST Amount" },
  { key: "paidAmount", label: "Paid Amount" },
  { key: "balance", label: "Balance" },
  { key: "status", label: "Status" },
  { key: "days", label: "Days" },
  { key: "dueDate", label: "Due Date" },
  { key: "paymentDate", label: "Payment Date" },
  { key: "notes", label: "Notes" },
];

// Client list extracted from provided image, ordered by their number prefixes.
const clients = [
  "RANHILL WORLEY SDN BHD",
  "NOV Process & Flow Technologies Malaysia Sdn Bhd",
  "ICE WOOD SDN BHD",
  "RNZ INTERGRATED (M) SDN BHD",
  "UNIVERSITI KUALA LUMPUR (MIIT)",
  "JJ-LURGI ENGINEERING SDN BHD",
  "BUREAU VERITAS (M) SDN BHD",
  "TUAH CONSULT SDN BHD",
  "PETROFAC ENGINEERING SERVICES (M) SDN BHD",
  "TECHNIP ENERGIES (M) SDN BHD",
  "LYNAS KALGOORLIE PTY LTD",
  "PETROSAINS SDN BHD",
  "UNIVERSITI TEKNOLOGI PETRONAS",
  "MECIP (M) SDN BHD",
  "INTERGRAPH PROCESS POWER & OFFSHORE (M) SDN BHD",
  "ENEOS Xplora Malaysia Limited",
  "DAR ENERGY SDN BHD",
  "MEINHARDT EPCM SDN BHD",
  "HASKELL MALAYSIA SERVICES SDN BHD",
  "WIBE GROUP ASIA PACIFIC SDN. BHD.",
  "MMC Oil & Gas Engineering Sdn Bhd",
  "REGISTERED SECONDED STAFF",
  "UNIVERSITI KEBANGSAAN MALAYSIA",
  "AEM Energy Solutions Sdn Bhd",
  "IFP ENGINEERING",
  "DCSE TECH SDN BHD",
  "ABA GAS TECHNOLOGIES SDN BHD",
  "Meta Engineering Technology Sdn. Bhd.",
  "Jiangsu HDmann Electric Group Co., Ltd.",
  "McDermott Asia Pacific Sdn Bhd",
  "KUMPULAN PT J KEMENTERIAN PERTAHANAN MARKAS PEMERINTAHAN BANTUAN UDARA",
  "NGLTech Sdn Bhd",
  "KERRY INGREDIENTS (M) SDN BHD",
  "DYNAC SDN BHD",
  "PTTEP Sarawak Oil Limited",
  "EXYTE MALAYSIA SDN BHD",
  "AKER ENGINEERING MALAYSIA SDN BHD",
  "TOYO ENGINEERING & CONSTRUCTION SENDIRIAN BERHAD",
  "INTEGRATED PROCESS SOLUTIONS ENGINEERING SDN BHD",
  "MIE INDUSTRIAL SDN BHD",
  "KOLEJ KEMAHIRAN TINGGI MARA GADING",
  "BUMI ARMADA OFFSHORE HOLDINGS LTD",
  "Petrofac Facilities Management Limited",
];

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const currentYear = new Date().getFullYear();
const timesheetYears = Array.from({ length: 6 }, (_, index) => currentYear - 2 + index);

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("paid")) return "bg-emerald-500 text-white";
  if (normalized.includes("cancel")) return "bg-rose-500 text-white";
  if (normalized.includes("pending")) return "bg-amber-400 text-slate-900";
  return "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200";
}

function normalizeStatusValue(status) {
  return String(status || "").trim().toUpperCase();
}

function createInvoiceForm(invoiceNo = "") {
  return {
    sent: false,
    invoiceNo,
    invoiceType: "ACTUAL",
    dateIssued: "",
    poSoNumber: "",
    clientName: "",
    timesheetMonth: "",
    timesheetMonthName: months[new Date().getMonth()] || "",
    timesheetYear: String(currentYear),
    details: "",
    invoiceAmountWoSst: "",
    invoiceAmountWithSst: "",
    sstAmount: "",
    hasSst: true,
    paidAmount: "",
    balance: "",
    status: "DRAFT",
    days: "",
    dueDate: "",
    paymentDate: "",
    notes: "",
  };
}

export default function InvoicingClient() {
  const [rows, setRows] = useState(initialRows);
  const [modalOpen, setModalOpen] = useState(false);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(26000508);
  const [formMode, setFormMode] = useState("create");
  const [editingIndex, setEditingIndex] = useState(null);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState("");
  const [form, setForm] = useState(() => createInvoiceForm());
  const formDraftRef = useRef(createInvoiceForm());

  useEffect(() => {
    let active = true;
    async function loadInvoices() {
      try {
        const response = await fetch(withBasePath(`/api/invoices?live=1&_ts=${Date.now()}`), { cache: "no-store" });
        const data = await response.json();
        if (!active || !response.ok) return;
        if (Array.isArray(data)) {
          setRows(data);
        }
      } catch (error) {
        console.error("Failed to load invoices", error);
      }
    }
    loadInvoices();

    function handleFocus() {
      loadInvoices();
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  function startEdit(index) {
    setEditingIndex(index);
    setFormMode("edit");
    const row = rows[index];
    const baseAmount = parseAmount(row.invoiceAmountWoSst);
    const withSstAmount = parseAmount(row.invoiceAmountWithSst);
    const monthMatch = String(row.timesheetMonth || "").match(/^(.+?)\s+(\d{4})$/);
    const nextForm = {
      ...row,
      hasSst: Number.isFinite(baseAmount) && Number.isFinite(withSstAmount) ? withSstAmount > baseAmount : true,
      timesheetMonthName: monthMatch?.[1] || String(row.timesheetMonth || "").trim(),
      timesheetYear: monthMatch?.[2] || String(currentYear),
    };
    formDraftRef.current = nextForm;
    setForm(nextForm);
    setModalOpen(true);
  }

  const totals = useMemo(() => {
    const statuses = rows.map((row) => deriveRowDisplay(row).status);
    const paid = statuses.filter((status) => String(status).toLowerCase().includes("paid")).length;
    const cancelled = statuses.filter((status) => String(status).toLowerCase().includes("cancel")).length;
    return { count: rows.length, paid, cancelled };
  }, [rows]);

  function updateForm(field, value) {
    setForm((prev) => {
      const nextForm = { ...prev, [field]: value };
      formDraftRef.current = nextForm;
      return nextForm;
    });
  }

  async function persistRows(nextRows) {
    setRows(nextRows);
    try {
      await fetch(withBasePath("/api/invoices"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: nextRows }),
      });
    } catch (error) {
      console.error("Failed to save invoices", error);
    }
  }

  function toggleSent(index) {
    const nextRows = rows.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const nextSent = !row.sent;
      let nextStatus = row.status;
      // Sending a draft moves it into the active AR pipeline; un-sending
      // drops it back to draft so it stops counting as a receivable.
      if (nextSent && normalizeStatusValue(row.status) === "DRAFT") nextStatus = "PENDING";
      if (!nextSent && normalizeStatusValue(row.status) === "PENDING") nextStatus = "DRAFT";
      return { ...row, sent: nextSent, status: nextStatus };
    });
    persistRows(nextRows);
  }

  function getTimesheetMonthName(value) {
    const monthName = String(value || "").trim().split(/\s+/)[0] || "";
    return monthName.toLowerCase();
  }

  const filteredRows = useMemo(() => {
    const filterValue = selectedMonthFilter.toLowerCase();
    return rows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => !selectedMonthFilter || getTimesheetMonthName(row.timesheetMonth) === filterValue);
  }, [rows, selectedMonthFilter]);

  // parse numeric amount from string like "RM 1,234.00" or "1,234.00"
  function parseAmount(v) {
    if (v == null) return NaN;
    const s = String(v).replace(/[^0-9.\-]/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // format number as RM currency, no negative handling special-case
  function formatCurrency(num) {
    if (num == null || Number.isNaN(Number(num))) return "";
    const n = Number(num);
    // use Intl for grouping and 2 decimals
    return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Stored balance/status can drift from the amount fields (e.g. paidAmount
  // edited without recomputing balance). Derive both the same way the edit
  // modal does so the table always matches what opening "Edit" will show.
  function deriveRowDisplay(row) {
    const total = parseAmount(row.invoiceAmountWithSst);
    const paid = parseAmount(row.paidAmount);
    if (!Number.isFinite(total)) {
      return { balance: row.balance, status: row.status };
    }
    const remaining = total - (Number.isFinite(paid) ? paid : 0);
    const status = remaining <= 0 && total > 0 && normalizeStatusValue(row.status) === "PENDING" ? "PAID" : row.status;
    return { balance: formatCurrency(remaining), status };
  }

  function formatCurrencyInput(v) {
    if (v == null || v === "") return "";
    const n = parseAmount(v);
    if (!Number.isFinite(n)) return String(v);
    return formatCurrency(n);
  }

  function focusCurrencyInput(field) {
    setForm((prev) => {
      const n = parseAmount(prev[field]);
      return { ...prev, [field]: Number.isFinite(n) ? String(n) : "" };
    });
  }

  function blurCurrencyInput(field) {
    setForm((prev) => ({ ...prev, [field]: formatCurrencyInput(prev[field]) }));
  }
  // auto-calc balance when total or paid changes, and auto-settle a sent
  // invoice to PAID once the client has fully paid it off.
  useEffect(() => {
    const total = parseAmount(form.invoiceAmountWithSst);
    const paid = parseAmount(form.paidAmount);
    if (!Number.isNaN(total)) {
      const b = Number.isNaN(paid) ? 0 : paid;
      const remaining = total - b;
      setForm((prev) => {
        const next = { ...prev, balance: formatCurrency(remaining) };
        if (remaining <= 0 && total > 0 && normalizeStatusValue(prev.status) === "PENDING") {
          next.status = "PAID";
        }
        return next;
      });
    } else {
      setForm((prev) => ({ ...prev, balance: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.invoiceAmountWithSst, form.paidAmount]);

  // format number to two decimals (no grouping)
  function fmt(n) {
    if (n == null || Number.isNaN(n)) return "";
    return Number(n).toFixed(2);
  }

  // calculate SST (8%) and total when base amount changes
  useEffect(() => {
    const base = parseAmount(form.invoiceAmountWoSst);
    if (!Number.isNaN(base)) {
      const sst = form.hasSst ? +(base * 0.08) : 0;
      const total = form.hasSst ? base + sst : base;
      setForm((prev) => ({ ...prev, sstAmount: formatCurrency(sst), invoiceAmountWithSst: formatCurrency(total) }));
    } else {
      setForm((prev) => ({ ...prev, sstAmount: "", invoiceAmountWithSst: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.invoiceAmountWoSst, form.hasSst]);

  function setNoSst() {
    setForm((prev) => ({
      ...prev,
      hasSst: false,
      sstAmount: prev.invoiceAmountWoSst ? formatCurrency(0) : "",
      invoiceAmountWithSst: prev.invoiceAmountWoSst ? formatCurrency(parseAmount(prev.invoiceAmountWoSst)) : "",
    }));
  }

  function setWithSst() {
    setForm((prev) => ({ ...prev, hasSst: true }));
  }

  // calculate days between dateIssued and dueDate
  useEffect(() => {
    const a = form.dateIssued;
    const b = form.dueDate;
    if (a && b) {
      const da = new Date(a);
      const db = new Date(b);
      if (!isNaN(da) && !isNaN(db)) {
        const diff = Math.round((db - da) / (1000 * 60 * 60 * 24));
        setForm((prev) => ({ ...prev, days: String(diff) }));
        return;
      }
    }
    setForm((prev) => ({ ...prev, days: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dateIssued, form.dueDate]);

  function handleAddRow() {
    const currentForm = formDraftRef.current;
    if (!currentForm.clientName) return;
    const resolvedTimesheetMonth = currentForm.timesheetMonthName && currentForm.timesheetYear ? `${currentForm.timesheetMonthName} ${currentForm.timesheetYear}` : currentForm.timesheetMonth || "";
    if (formMode === "edit" && editingIndex != null) {
      const nextRows = rows.map((row, index) => (index === editingIndex ? { ...currentForm, timesheetMonth: resolvedTimesheetMonth, invoiceNo: String(currentForm.invoiceNo || row.invoiceNo) } : row));
      persistRows(nextRows);
    } else {
      const assignedInvoiceNo = currentForm.invoiceNo || String(nextInvoiceNumber);
      const newForm = { ...currentForm, timesheetMonth: resolvedTimesheetMonth, invoiceNo: String(assignedInvoiceNo) };
      const nextRows = [{ ...newForm }, ...rows];
      persistRows(nextRows);
      setNextInvoiceNumber((n) => Number(n) + 1);
    }
    setModalOpen(false);
    setEditingIndex(null);
    setFormMode("create");
    const resetForm = createInvoiceForm();
    formDraftRef.current = resetForm;
    setForm(resetForm);
  }

  function handleDeleteRow() {
    if (editingIndex == null) return;
    const row = rows[editingIndex];
    const invoiceLabel = row?.invoiceNo || `#${editingIndex + 1}`;
    const confirmed = window.confirm(`Delete invoice ${invoiceLabel}? This cannot be undone.`);
    if (!confirmed) return;

    const nextRows = rows.filter((_, index) => index !== editingIndex);
    persistRows(nextRows);
    setModalOpen(false);
    setEditingIndex(null);
    setFormMode("create");
    const resetForm = createInvoiceForm();
    formDraftRef.current = resetForm;
    setForm(resetForm);
  }

  function openModalForNew() {
    setEditingIndex(null);
    setFormMode("create");
    const nextForm = createInvoiceForm(String(nextInvoiceNumber));
    formDraftRef.current = nextForm;
    setForm(nextForm);
    setModalOpen(true);
  }

  function closeInvoiceModal() {
    setModalOpen(false);
    setEditingIndex(null);
    setFormMode("create");
    formDraftRef.current = createInvoiceForm();
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#0e2b57]/70 dark:text-slate-400">Operations</p>
          <h1 className="mt-1 text-3xl font-semibold text-[#0b1e3a] dark:text-slate-100">Invoicing</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#0e2b57]/70 dark:text-slate-400">
            Use the table below as the input reference for invoice tracking, payment status, and time-based billing details.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-[#7aa4cf]/30 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div>
            <p className="text-xs uppercase text-[#0e2b57]/60 dark:text-slate-400">Invoices</p>
            <p className="text-2xl font-semibold text-[#0b1e3a] dark:text-slate-100">{totals.count}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-[#0e2b57]/60 dark:text-slate-400">Paid</p>
            <p className="text-2xl font-semibold text-emerald-600">{totals.paid}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-[#0e2b57]/60 dark:text-slate-400">Cancelled</p>
            <p className="text-2xl font-semibold text-rose-600">{totals.cancelled}</p>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-[22px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 border-b border-slate-200 dark:border-slate-700 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Invoice Table Reference</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Scrollable input table based on the structure you shared.</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Click the Sent checkbox to mark entries for dispatch</p>
        </div>

        <div className="flex items-center justify-end border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400">Month Filter</label>
              <select
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                className="mt-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
              >
                <option value="">All months</option>
                {months.map((month) => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
            <button
              onClick={openModalForNew}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f3d7a] text-xl font-semibold text-white shadow-sm transition hover:bg-[#0c3368]"
              aria-label="Add invoice"
              title="Add invoice"
            >
              +
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1350px] w-full border-collapse text-[13px]">
            <thead>
              <tr className="sticky top-0 z-10 bg-[#123f7a] text-white">
                {columns.map((col) => (
                  <th key={col.key} className="border-b border-white/10 px-4 py-4 text-left text-[13px] font-semibold whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ row, originalIndex }) => {
                const display = deriveRowDisplay(row);
                return (
                <tr
                  key={`${row.invoiceNo}-${originalIndex}`}
                  className={
                    `${originalIndex % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/70 dark:bg-slate-800/40"} cursor-pointer transition-colors hover:bg-[#eff5ff] dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0f3d7a]/30`
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={`Edit invoice ${row.invoiceNo || originalIndex + 1}`}
                  onClick={() => startEdit(originalIndex)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      startEdit(originalIndex);
                    }
                  }}
                >
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={!!row.sent}
                      onChange={() => toggleSent(originalIndex)}
                      onClick={(event) => event.stopPropagation()}
                      className="h-4 w-4 accent-[#0f3d7a]"
                    />
                  </td>

                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">{row.invoiceNo}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{row.invoiceType}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{row.dateIssued}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{row.poSoNumber}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{row.clientName}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{row.timesheetMonth}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{row.details}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-right text-slate-700 dark:text-slate-300">{formatCurrency(parseAmount(row.invoiceAmountWoSst)) || ""}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-right text-slate-700 dark:text-slate-300">{formatCurrency(parseAmount(row.invoiceAmountWithSst)) || ""}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-right text-slate-700 dark:text-slate-300">{formatCurrency(parseAmount(row.sstAmount)) || ""}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-right text-slate-700 dark:text-slate-300">{formatCurrency(parseAmount(row.paidAmount)) || ""}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-right text-slate-700 dark:text-slate-300">{formatCurrency(parseAmount(display.balance)) || display.balance}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(display.status)}`}>{display.status}</span>
                  </td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-center text-slate-500 dark:text-slate-400">{row.days}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{row.dueDate}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{row.paymentDate}</td>
                  <td className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 min-w-[260px] text-slate-700 dark:text-slate-300">{row.notes}</td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeInvoiceModal} />
          <div className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-xl font-semibold text-[#0b1e3a] dark:text-slate-100">{formMode === "edit" ? "Edit Invoice" : "Create Invoice"}</h2>
                <p className="text-sm text-[#0e2b57]/70 dark:text-slate-400">Enter invoice details in a modal, similar to the timesheet flow.</p>
              </div>
              <button onClick={closeInvoiceModal} className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                Close
              </button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["invoiceNo", "Invoice No."],
                  ["invoiceType", "Invoice Type"],
                  ["dateIssued", "Date Issued"],
                  ["poSoNumber", "PO/SO Number"],
                  ["clientName", "Client Name"],
                  ["timesheetMonth", "Timesheet Month"],
                  ["details", "Details"],
                  ["invoiceAmountWoSst", "Invoice Amount (WO/SST)"],
                  ["invoiceAmountWithSst", "Invoice Amount (With SST)"],
                  ["sstAmount", "SST Amount"],
                  ["paidAmount", "Paid Amount"],
                  ["balance", "Balance"],
                  ["status", "Status"],
                  ["days", "Days"],
                  ["dueDate", "Due Date"],
                  ["paymentDate", "Payment Date"],
                  ["notes", "Notes"],
                ].map(([key, label]) => {
                  // render date pickers for date fields
                  if (key === "dateIssued" || key === "dueDate" || key === "paymentDate") {
                    return (
                      <label key={key} className="space-y-1 text-sm">
                        <span className="block font-medium text-[#0e2b57] dark:text-slate-300">{label}</span>
                        <MondayDateInput
                          value={form[key] || ""}
                          onChange={(value) => updateForm(key, value)}
                          className="dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                    );
                  }

                  // invoice type select
                  if (key === "invoiceType") {
                    return (
                      <label key={key} className="space-y-1 text-sm">
                        <span className="block font-medium text-[#0e2b57] dark:text-slate-300">{label}</span>
                        <select
                          value={form.invoiceType}
                          onChange={(e) => updateForm("invoiceType", e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
                        >
                          <option value="PROFORMA">PROFORMA</option>
                          <option value="ACTUAL">ACTUAL</option>
                          <option value="NIL">NIL</option>
                          <option value="CN">CN</option>
                          <option value="Reserve for Audit">Reserve for Audit</option>
                        </select>
                      </label>
                    );
                  }

                  // make SST and total read-only (auto-calculated)
                  if (key === "invoiceAmountWithSst" || key === "sstAmount") {
                    return (
                      <label key={key} className="space-y-1 text-sm">
                        <span className="block font-medium text-[#0e2b57] dark:text-slate-300">{label}</span>
                        <input
                          value={form[key]}
                          readOnly
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 outline-none"
                          placeholder={label}
                        />
                      </label>
                    );
                  }

                  if (key === "invoiceAmountWoSst") {
                    return (
                      <div key={key} className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="block min-w-0 whitespace-nowrap overflow-hidden text-ellipsis font-medium text-[#0e2b57] dark:text-slate-300">{label}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={setNoSst}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                form.hasSst ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700" : "bg-[#0f3d7a] text-white"
                              }`}
                            >
                              No SST
                            </button>
                            <button
                              type="button"
                              onClick={setWithSst}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                form.hasSst ? "bg-[#0f3d7a] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                              }`}
                            >
                              With SST
                            </button>
                          </div>
                        </div>
                        <input
                          value={form.invoiceAmountWoSst}
                          onFocus={() => focusCurrencyInput(key)}
                          onBlur={() => blurCurrencyInput(key)}
                          onChange={(e) => updateForm(key, e.target.value)}
                          inputMode="decimal"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
                          placeholder={label}
                        />
                      </div>
                    );
                  }

                  // client name select
                  if (key === "clientName") {
                    return (
                      <label key={key} className="space-y-1 text-sm">
                        <span className="block font-medium text-[#0e2b57] dark:text-slate-300">{label}</span>
                        <select
                          value={form.clientName}
                          onChange={(e) => updateForm("clientName", e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
                        >
                          <option value="">-- Select client --</option>
                          {clients.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                    );
                  }

                  // month select
                  if (key === "timesheetMonth") {
                    return (
                      <React.Fragment key={key}>
                        <label className="space-y-1 text-sm">
                          <span className="block font-medium text-[#0e2b57] dark:text-slate-300">Timesheet Month</span>
                          <select
                            value={form.timesheetMonthName}
                            onChange={(e) => updateForm("timesheetMonthName", e.target.value)}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
                          >
                            <option value="">-- Select month --</option>
                            {months.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="block font-medium text-[#0e2b57] dark:text-slate-300">Timesheet Year</span>
                          <select
                            value={form.timesheetYear}
                            onChange={(e) => updateForm("timesheetYear", e.target.value)}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
                          >
                            {timesheetYears.map((year) => (
                              <option key={year} value={String(year)}>{year}</option>
                            ))}
                          </select>
                        </label>
                      </React.Fragment>
                    );
                  }

                  // status select
                  if (key === "status") {
                    return (
                      <label key={key} className="space-y-1 text-sm">
                        <span className="block font-medium text-[#0e2b57] dark:text-slate-300">{label}</span>
                        <select
                          value={form.status}
                          onChange={(e) => updateForm("status", e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
                        >
                          <option value="DRAFT">DRAFT</option>
                          <option value="PAID">PAID</option>
                          <option value="CANCELLED">CANCELLED</option>
                          <option value="PENDING">PENDING</option>
                        </select>
                      </label>
                    );
                  }

                  

                  // default input
                  return (
                    <label key={key} className="space-y-1 text-sm">
                      <span className="block font-medium text-[#0e2b57] dark:text-slate-300">{label}</span>
                      <input
                        value={form[key]}
                        onChange={(e) => updateForm(key, e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
                        placeholder={label}
                      />
                    </label>
                  );
                })}

              </div>

              <div className={`mt-6 flex items-center border-t border-slate-200 dark:border-slate-700 pt-4 ${formMode === "edit" ? "justify-between" : "justify-end"}`}>
                {formMode === "edit" && (
                  <button
                    onClick={handleDeleteRow}
                    className="rounded-xl bg-rose-50 dark:bg-rose-950/40 px-4 py-2 text-sm font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60"
                  >
                    Delete Invoice
                  </button>
                )}
                <div className="flex items-center gap-3">
                  <button onClick={closeInvoiceModal} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                    Cancel
                  </button>
                  <button onClick={handleAddRow} className="rounded-xl bg-[#0f3d7a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c3368]">
                    {formMode === "edit" ? "Update Invoice" : "Save Invoice"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
