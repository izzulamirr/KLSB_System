"use client";
import { useMemo, useState, useEffect } from "react";
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
    status: "CANCELLED",
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

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("paid")) return "bg-emerald-500 text-white";
  if (normalized.includes("cancel")) return "bg-rose-500 text-white";
  if (normalized.includes("pending")) return "bg-amber-400 text-slate-900";
  return "bg-slate-200 text-slate-800";
}

function createInvoiceForm(invoiceNo = "") {
  return {
    sent: true,
    invoiceNo,
    invoiceType: "ACTUAL",
    dateIssued: "",
    poSoNumber: "",
    clientName: "",
    timesheetMonth: "",
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
  const [form, setForm] = useState(() => createInvoiceForm());

  function startEdit(index) {
    setEditingIndex(index);
    setFormMode("edit");
    const row = rows[index];
    const baseAmount = parseAmount(row.invoiceAmountWoSst);
    const withSstAmount = parseAmount(row.invoiceAmountWithSst);
    setForm({
      ...row,
      hasSst: Number.isFinite(baseAmount) && Number.isFinite(withSstAmount) ? withSstAmount > baseAmount : true,
    });
    setModalOpen(true);
  }

  function deleteRow(index) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setFormMode("create");
      setForm(createInvoiceForm(String(nextInvoiceNumber)));
    }
  }

  const totals = useMemo(() => {
    const paid = rows.filter((row) => String(row.status).toLowerCase().includes("paid")).length;
    const cancelled = rows.filter((row) => String(row.status).toLowerCase().includes("cancel")).length;
    return { count: rows.length, paid, cancelled };
  }, [rows]);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
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
  // auto-calc balance when total or paid changes
  useEffect(() => {
    const total = parseAmount(form.invoiceAmountWithSst);
    const paid = parseAmount(form.paidAmount);
    if (!Number.isNaN(total)) {
      const b = Number.isNaN(paid) ? 0 : paid;
      setForm((prev) => ({ ...prev, balance: formatCurrency(total - b) }));
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
    if (!form.clientName) return;
    if (formMode === "edit" && editingIndex != null) {
      setRows((prev) => prev.map((row, index) => (index === editingIndex ? { ...form, invoiceNo: String(form.invoiceNo || row.invoiceNo) } : row)));
    } else {
      const assignedInvoiceNo = form.invoiceNo || String(nextInvoiceNumber);
      const newForm = { ...form, invoiceNo: String(assignedInvoiceNo) };
      setRows((prev) => [{ ...newForm }, ...prev]);
      setNextInvoiceNumber((n) => Number(n) + 1);
    }
    setModalOpen(false);
    setEditingIndex(null);
    setFormMode("create");
    setForm(createInvoiceForm());
  }

  function openModalForNew() {
    setEditingIndex(null);
    setFormMode("create");
    setForm(createInvoiceForm(String(nextInvoiceNumber)));
    setModalOpen(true);
  }

  function closeInvoiceModal() {
    setModalOpen(false);
    setEditingIndex(null);
    setFormMode("create");
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#0e2b57]/70">Operations</p>
          <h1 className="mt-1 text-3xl font-semibold text-[#0b1e3a]">Invoicing</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#0e2b57]/70">
            Use the table below as the input reference for invoice tracking, payment status, and time-based billing details.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-[#7aa4cf]/30 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs uppercase text-[#0e2b57]/60">Invoices</p>
            <p className="text-2xl font-semibold text-[#0b1e3a]">{totals.count}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-[#0e2b57]/60">Paid</p>
            <p className="text-2xl font-semibold text-emerald-600">{totals.paid}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-[#0e2b57]/60">Cancelled</p>
            <p className="text-2xl font-semibold text-rose-600">{totals.cancelled}</p>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Invoice Table Reference</h2>
            <p className="text-sm text-slate-500">Scrollable input table based on the structure you shared.</p>
          </div>
          <p className="text-xs text-slate-500">Click the Sent checkbox to mark entries for dispatch</p>
        </div>

        <div className="flex items-center justify-end border-b border-slate-100 px-5 py-4">
          <button
            onClick={openModalForNew}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f3d7a] text-xl font-semibold text-white shadow-sm transition hover:bg-[#0c3368]"
            aria-label="Add invoice"
            title="Add invoice"
          >
            +
          </button>
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
                <th className="border-b border-white/10 px-4 py-4 text-left text-[13px] font-semibold whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.invoiceNo}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                  <td className="border-b border-slate-200 px-4 py-3 text-center align-middle">
                    <input type="checkbox" checked={!!row.sent} readOnly className="h-4 w-4 accent-[#0f3d7a]" />
                  </td>

                  <td className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{row.invoiceNo}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-slate-700">{row.invoiceType}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-slate-700">{row.dateIssued}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-slate-700">{row.poSoNumber}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-slate-700">{row.clientName}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-slate-700">{row.timesheetMonth}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-slate-700">{row.details}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-right text-slate-700">{formatCurrency(parseAmount(row.invoiceAmountWoSst)) || ""}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-right text-slate-700">{formatCurrency(parseAmount(row.invoiceAmountWithSst)) || ""}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-right text-slate-700">{formatCurrency(parseAmount(row.sstAmount)) || ""}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-right text-slate-700">{formatCurrency(parseAmount(row.paidAmount)) || ""}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-right text-slate-700">{formatCurrency(parseAmount(row.balance)) || row.balance}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-slate-700">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                  </td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-center text-slate-500">{row.days}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-slate-700">{row.dueDate}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-slate-700">{row.paymentDate}</td>
                  <td className="border-b border-slate-200 px-4 py-3 min-w-[260px] text-slate-700">{row.notes}</td>
                  <td className="border-b border-slate-200 px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => startEdit(index)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                        aria-label="Edit invoice"
                        title="Edit invoice"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteRow(index)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                        aria-label="Delete invoice"
                        title="Delete invoice"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
                          <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
                          <path d="M10 10v6" />
                          <path d="M14 10v6" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeInvoiceModal} />
          <div className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-xl font-semibold text-[#0b1e3a]">{formMode === "edit" ? "Edit Invoice" : "Create Invoice"}</h2>
                <p className="text-sm text-[#0e2b57]/70">Enter invoice details in a modal, similar to the timesheet flow.</p>
              </div>
              <button onClick={closeInvoiceModal} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
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
                        <span className="block font-medium text-[#0e2b57]">{label}</span>
                        <input
                          type="date"
                          value={form[key] || ""}
                          onChange={(e) => updateForm(key, e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
                        />
                      </label>
                    );
                  }

                  // invoice type select
                  if (key === "invoiceType") {
                    return (
                      <label key={key} className="space-y-1 text-sm">
                        <span className="block font-medium text-[#0e2b57]">{label}</span>
                        <select
                          value={form.invoiceType}
                          onChange={(e) => updateForm("invoiceType", e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
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
                        <span className="block font-medium text-[#0e2b57]">{label}</span>
                        <input
                          value={form[key]}
                          readOnly
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none"
                          placeholder={label}
                        />
                      </label>
                    );
                  }

                  if (key === "invoiceAmountWoSst") {
                    return (
                      <div key={key} className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="block font-medium text-[#0e2b57]">{label}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={setNoSst}
                              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                                form.hasSst ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-[#0f3d7a] text-white"
                              }`}
                            >
                              No SST
                            </button>
                            <button
                              type="button"
                              onClick={setWithSst}
                              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                                form.hasSst ? "bg-[#0f3d7a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
                          placeholder={label}
                        />
                      </div>
                    );
                  }

                  // client name select
                  if (key === "clientName") {
                    return (
                      <label key={key} className="space-y-1 text-sm">
                        <span className="block font-medium text-[#0e2b57]">{label}</span>
                        <select
                          value={form.clientName}
                          onChange={(e) => updateForm("clientName", e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
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
                      <label key={key} className="space-y-1 text-sm">
                        <span className="block font-medium text-[#0e2b57]">{label}</span>
                        <select
                          value={form.timesheetMonth}
                          onChange={(e) => updateForm("timesheetMonth", e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
                        >
                          <option value="">-- Select month --</option>
                          {months.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                    );
                  }

                  // status select
                  if (key === "status") {
                    return (
                      <label key={key} className="space-y-1 text-sm">
                        <span className="block font-medium text-[#0e2b57]">{label}</span>
                        <select
                          value={form.status}
                          onChange={(e) => updateForm("status", e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
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
                      <span className="block font-medium text-[#0e2b57]">{label}</span>
                      <input
                        value={form[key]}
                        onChange={(e) => updateForm(key, e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-[#0f3d7a] focus:ring-2 focus:ring-[#0f3d7a]/10"
                        placeholder={label}
                      />
                    </label>
                  );
                })}

              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button onClick={closeInvoiceModal} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                  Cancel
                </button>
                <button onClick={handleAddRow} className="rounded-xl bg-[#0f3d7a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c3368]">
                  {formMode === "edit" ? "Update Invoice" : "Save Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
