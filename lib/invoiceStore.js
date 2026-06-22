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

const seedRows = [
  {
    sent: true,
    invoiceNo: "2394-002",
    invoiceType: "ACTUAL",
    dateIssued: "2024-05-15",
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
    dueDate: "2024-06-14",
    paymentDate: "2025-08-29",
    notes: "",
  },
  {
    sent: true,
    invoiceNo: "1947-948",
    invoiceType: "ACTUAL",
    dateIssued: "2024-12-20",
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
    dueDate: "2025-01-19",
    paymentDate: "2025-06-18",
    notes: "",
  },
  {
    sent: true,
    invoiceNo: "2410-029",
    invoiceType: "ACTUAL",
    dateIssued: "2024-11-06",
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
    dueDate: "2024-12-07",
    paymentDate: "",
    notes: "",
  },
];

function getInvoiceStorePath() {
  return process.env.INVOICE_STORE_PATH || `${process.cwd()}/data/invoices.json`;
}

function getInvoiceCollectionName() {
  return process.env.INVOICE_COLLECTION_NAME || "invoice_store";
}

function getInvoiceDocumentId() {
  return process.env.INVOICE_DOCUMENT_ID || "rows";
}

function normalizeInvoiceRow(row) {
  return {
    sent: !!row?.sent,
    invoiceNo: String(row?.invoiceNo || ""),
    invoiceType: String(row?.invoiceType || ""),
    dateIssued: String(row?.dateIssued || ""),
    poSoNumber: String(row?.poSoNumber || ""),
    clientName: String(row?.clientName || ""),
    timesheetMonth: String(row?.timesheetMonth || ""),
    details: String(row?.details || ""),
    invoiceAmountWoSst: String(row?.invoiceAmountWoSst || ""),
    invoiceAmountWithSst: String(row?.invoiceAmountWithSst || ""),
    sstAmount: String(row?.sstAmount || ""),
    paidAmount: String(row?.paidAmount || ""),
    balance: String(row?.balance || ""),
    status: String(row?.status || ""),
    days: String(row?.days || ""),
    dueDate: String(row?.dueDate || ""),
    paymentDate: String(row?.paymentDate || ""),
    notes: String(row?.notes || ""),
  };
}

export function getSeedInvoiceRows() {
  return seedRows.map(normalizeInvoiceRow);
}

export async function readInvoiceRows(options = {}) {
  const preferLive = Boolean(options?.preferLive);

  if (preferLive) {
    try {
      const firestoreRows = await withTimeout(readFirestoreInvoiceRows());
      if (Array.isArray(firestoreRows)) {
        try {
          await writeLocalInvoiceRows(firestoreRows);
        } catch {
          // Keep serving Firestore data even if the backup write fails.
        }
        return firestoreRows;
      }
    } catch {
      // Fall back to the local backup when Firestore is unavailable or too slow.
    }
  }

  const localRows = await readLocalInvoiceRows();
  if (localRows.length) return localRows;

  try {
    const firestoreRows = await withTimeout(readFirestoreInvoiceRows());
    if (Array.isArray(firestoreRows)) {
      try {
        await writeLocalInvoiceRows(firestoreRows);
      } catch {
        // Keep serving Firestore data even if the backup write fails.
      }
      return firestoreRows;
    }
  } catch {
    // Fall back to local storage when Firestore is unavailable or too slow.
  }

  return localRows;
}

export async function writeInvoiceRows(rows) {
  const normalized = Array.isArray(rows) ? rows.map(normalizeInvoiceRow) : [];
  const savedLocal = await writeLocalInvoiceRows(normalized);
  try {
    await withTimeout(writeFirestoreInvoiceRows(savedLocal));
  } catch {
    // Keep the local backup as the authoritative response when Firestore fails.
  }

  return savedLocal;
}

function parseAmount(value) {
  if (value == null) return 0;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value) {
  return `RM ${Number(value || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getMonthLabel(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

async function readLocalInvoiceRows() {
  const fs = await import("fs/promises");
  const path = getInvoiceStorePath();
  try {
    const raw = await fs.readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(normalizeInvoiceRow);
    if (Array.isArray(parsed?.rows)) return parsed.rows.map(normalizeInvoiceRow);
  } catch {
    return getSeedInvoiceRows();
  }
  return getSeedInvoiceRows();
}

async function writeLocalInvoiceRows(rows) {
  const fs = await import("fs/promises");
  const pathModule = await import("path");
  const path = getInvoiceStorePath();
  await fs.mkdir(pathModule.dirname(path), { recursive: true });
  const normalized = Array.isArray(rows) ? rows.map(normalizeInvoiceRow) : [];
  await fs.writeFile(path, JSON.stringify({ rows: normalized, updatedAt: new Date().toISOString() }, null, 2), "utf8");
  return normalized;
}

async function readFirestoreInvoiceRows() {
  const initAdmin = (await import("./firebaseAdmin.js")).default;
  const admin = await initAdmin();
  const db = admin.firestore();
  const docSnap = await db.collection(getInvoiceCollectionName()).doc(getInvoiceDocumentId()).get();
  if (!docSnap.exists) return null;

  const data = docSnap.data() || {};
  if (Array.isArray(data.rows)) return data.rows.map(normalizeInvoiceRow);
  if (Array.isArray(data.data)) return data.data.map(normalizeInvoiceRow);
  return null;
}

async function writeFirestoreInvoiceRows(rows) {
  const initAdmin = (await import("./firebaseAdmin.js")).default;
  const admin = await initAdmin();
  const db = admin.firestore();
  const normalized = Array.isArray(rows) ? rows.map(normalizeInvoiceRow) : [];
  await db.collection(getInvoiceCollectionName()).doc(getInvoiceDocumentId()).set(
    {
      rows: normalized,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return normalized;
}

function withTimeout(promise, timeoutMs = 1500) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Timed out")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function isFinanceRelevant(row) {
  const status = normalizeStatus(row?.status);
  return status === "PAID" || status === "PENDING";
}

function isPaid(row) {
  return normalizeStatus(row?.status) === "PAID";
}

export function buildFinanceData(rows) {
  const invoices = Array.isArray(rows) ? rows.map(normalizeInvoiceRow) : [];
  const financeInvoices = invoices.filter((row) => isFinanceRelevant(row));
  const invoiceCount = financeInvoices.length;
  const paidInvoices = financeInvoices.filter((row) => isPaid(row));
  const openInvoices = financeInvoices.filter((row) => !isPaid(row));

  const billedTotal = financeInvoices.reduce((sum, row) => sum + parseAmount(row.invoiceAmountWithSst || row.invoiceAmountWoSst), 0);
  const collectedTotal = paidInvoices.reduce((sum, row) => sum + parseAmount(row.paidAmount || row.invoiceAmountWithSst), 0);
  const outstandingTotal = openInvoices.reduce((sum, row) => sum + Math.max(parseAmount(row.invoiceAmountWithSst || row.invoiceAmountWoSst) - parseAmount(row.paidAmount), 0), 0);

  const overdueRows = openInvoices.filter((row) => {
    const dueDate = new Date(row.dueDate);
    return !Number.isNaN(dueDate.getTime()) && dueDate < new Date();
  });

  const overdueAmount = overdueRows.reduce((sum, row) => sum + Math.max(parseAmount(row.invoiceAmountWithSst || row.invoiceAmountWoSst) - parseAmount(row.paidAmount), 0), 0);

  const recentInvoices = [...financeInvoices]
    .sort((a, b) => new Date(b.dateIssued || 0) - new Date(a.dateIssued || 0))
    .slice(0, 5)
    .map((row) => ({
      invoiceNo: row.invoiceNo,
      client: row.clientName,
      issueDate: row.dateIssued || "-",
      amount: formatCurrency(parseAmount(row.invoiceAmountWithSst || row.invoiceAmountWoSst)),
      po: row.poSoNumber || "-",
      status: String(row.status || "Draft"),
    }));

  const receivables = openInvoices
    .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))
    .slice(0, 6)
    .map((row) => ({
      invoiceNo: row.invoiceNo,
      client: row.clientName,
      dueDate: row.dueDate || "-",
      amount: formatCurrency(Math.max(parseAmount(row.invoiceAmountWithSst || row.invoiceAmountWoSst) - parseAmount(row.paidAmount), 0)),
      status: String(row.status || "").toLowerCase().includes("cancel")
        ? "Cancelled"
        : new Date(row.dueDate || 0) < new Date()
          ? "Overdue"
          : "Open",
    }));

  const monthlyMap = new Map();
  for (const row of financeInvoices) {
    const monthLabel = getMonthLabel(row.dateIssued);
    if (!monthLabel) continue;
    const amount = parseAmount(row.invoiceAmountWithSst || row.invoiceAmountWoSst);
    const current = monthlyMap.get(monthLabel) || { billed: 0, collected: 0, outstanding: 0 };
    current.billed += amount;
    if (isPaid(row)) current.collected += parseAmount(row.paidAmount || row.invoiceAmountWithSst);
    else current.outstanding += Math.max(amount - parseAmount(row.paidAmount), 0);
    monthlyMap.set(monthLabel, current);
  }

  const monthlySummary = Array.from(monthlyMap.entries())
    .sort((a, b) => new Date(`1 ${a[0]}`) - new Date(`1 ${b[0]}`))
    .slice(-6)
    .map(([month, values]) => ({
      month,
      billed: formatCurrency(values.billed),
      collected: formatCurrency(values.collected),
      outstanding: formatCurrency(values.outstanding),
    }));
  const currentInvoices = financeInvoices.filter((row) => {
    const dueDate = new Date(row.dueDate);
    if (Number.isNaN(dueDate.getTime())) return false;
    return dueDate >= new Date() && dueDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  });

  return {
    stats: [
      { label: "Total Invoices", value: String(invoiceCount), note: "All invoice records" },
      { label: "Paid This Month", value: formatCurrency(collectedTotal), note: "Computed from invoice data" },
      { label: "Outstanding AR", value: formatCurrency(outstandingTotal), note: `${openInvoices.length} open invoices` },
      { label: "Overdue Amount", value: formatCurrency(overdueAmount), note: `${overdueRows.length} overdue invoices` },
      { label: "Avg Collection Days", value: "34 days", note: "Derived metric placeholder" },
      { label: "Forecast Inflow", value: formatCurrency(currentInvoices.reduce((sum, row) => sum + Math.max(parseAmount(row.invoiceAmountWithSst || row.invoiceAmountWoSst) - parseAmount(row.paidAmount), 0), 0)), note: "Next 30 days" },
    ],
    kpiBreakdown: {
      collected: formatCurrency(collectedTotal),
      billed: formatCurrency(billedTotal),
      collectionRate: billedTotal > 0 ? `${((collectedTotal / billedTotal) * 100).toFixed(1)}%` : "0.0%",
      dso: "34",
    },
    agingBuckets: [
      { bucket: "Current (0-30)", amount: formatCurrency(currentInvoices.reduce((sum, row) => sum + Math.max(parseAmount(row.invoiceAmountWithSst || row.invoiceAmountWoSst) - parseAmount(row.paidAmount), 0), 0)), invoiceCount: currentInvoices.length },
      { bucket: "31-60 Days", amount: formatCurrency(0), invoiceCount: 0 },
      { bucket: "61-90 Days", amount: formatCurrency(0), invoiceCount: 0 },
      { bucket: "90+ Days", amount: formatCurrency(overdueAmount), invoiceCount: overdueRows.length },
    ],
    monthlySummary: monthlySummary.length ? monthlySummary : [{ month: "No invoice data", billed: formatCurrency(0), collected: formatCurrency(0), outstanding: formatCurrency(0) }],
    receivables,
    recentInvoices,
    recentPayments: paidInvoices.slice(0, 5).map((row, index) => ({
      reference: `PMT-${String(index + 1).padStart(5, "0")}`,
      client: row.clientName,
      paidOn: row.paymentDate || row.dateIssued || "-",
      method: "Invoice record",
      amount: formatCurrency(parseAmount(row.paidAmount || row.invoiceAmountWithSst)),
    })),
    updatedAt: new Date().toISOString(),
  };
}