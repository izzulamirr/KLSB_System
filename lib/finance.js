// lib/finance.js
// Server-side data provider for Finance page demo data.

export async function getFinanceData() {
  // Simulate async fetch / DB read
  await new Promise((resolve) => setTimeout(resolve, 30));

  return {
    stats: [
      { label: "Total Invoices", value: "128", note: "YTD documents" },
      { label: "Paid This Month", value: "RM 186,450", note: "As of today" },
      { label: "Outstanding AR", value: "RM 342,900", note: "18 open invoices" },
      { label: "Overdue Amount", value: "RM 76,400", note: "7 invoices overdue" },
      { label: "Avg Collection Days", value: "34 days", note: "Rolling 3 months" },
      { label: "Forecast Inflow", value: "RM 210,000", note: "Next 14 days" },
    ],
    kpiBreakdown: {
      collected: "RM 1,245,700",
      billed: "RM 1,588,600",
      collectionRate: "78.4%",
      dso: "34",
    },
    agingBuckets: [
      { bucket: "Current (0-30)", amount: "RM 198,500", invoiceCount: 9 },
      { bucket: "31-60 Days", amount: "RM 87,300", invoiceCount: 5 },
      { bucket: "61-90 Days", amount: "RM 39,200", invoiceCount: 2 },
      { bucket: "90+ Days", amount: "RM 17,900", invoiceCount: 2 },
    ],
    monthlySummary: [
      { month: "Oct 2025", billed: "RM 252,000", collected: "RM 233,400", outstanding: "RM 18,600" },
      { month: "Nov 2025", billed: "RM 274,800", collected: "RM 246,500", outstanding: "RM 28,300" },
      { month: "Dec 2025", billed: "RM 301,200", collected: "RM 257,900", outstanding: "RM 43,300" },
      { month: "Jan 2026", billed: "RM 267,100", collected: "RM 238,100", outstanding: "RM 29,000" },
      { month: "Feb 2026", billed: "RM 263,500", collected: "RM 224,300", outstanding: "RM 39,200" },
      { month: "Mar 2026", billed: "RM 229,000", collected: "RM 186,450", outstanding: "RM 42,550" },
    ],
    receivables: [
      { invoiceNo: "INV-2026-031", client: "Tenaga Solusi Sdn Bhd", dueDate: "2026-03-10", amount: "RM 28,300", status: "Due Soon" },
      { invoiceNo: "INV-2026-029", client: "Nexa Engineering", dueDate: "2026-03-06", amount: "RM 19,800", status: "Due Soon" },
      { invoiceNo: "INV-2026-026", client: "Optima Industrial", dueDate: "2026-02-28", amount: "RM 14,700", status: "Overdue" },
      { invoiceNo: "INV-2026-022", client: "MKS Infra", dueDate: "2026-02-24", amount: "RM 12,900", status: "Overdue" },
      { invoiceNo: "INV-2026-019", client: "Apex Systems", dueDate: "2026-03-14", amount: "RM 21,600", status: "Open" },
      { invoiceNo: "INV-2026-017", client: "Vanguard Services", dueDate: "2026-03-18", amount: "RM 16,500", status: "Open" },
    ],
    recentInvoices: [
      { invoiceNo: "INV-2026-034", client: "Jati Construction", issueDate: "2026-03-01", amount: "RM 22,400", po: "PO-88213", status: "Sent" },
      { invoiceNo: "INV-2026-033", client: "Aster Global", issueDate: "2026-02-28", amount: "RM 31,000", po: "PO-88156", status: "Sent" },
      { invoiceNo: "INV-2026-032", client: "Gamma Utilities", issueDate: "2026-02-27", amount: "RM 18,900", po: "PO-88102", status: "Draft" },
      { invoiceNo: "INV-2026-030", client: "Trinity Offshore", issueDate: "2026-02-25", amount: "RM 27,500", po: "PO-88044", status: "Approved" },
      { invoiceNo: "INV-2026-028", client: "Axis Manufacturing", issueDate: "2026-02-23", amount: "RM 14,200", po: "PO-87988", status: "Approved" },
    ],
    recentPayments: [
      { reference: "PMT-98911", client: "Aster Global", paidOn: "2026-03-02", method: "Bank Transfer", amount: "RM 31,000" },
      { reference: "PMT-98902", client: "Jati Construction", paidOn: "2026-03-01", method: "Online Banking", amount: "RM 22,400" },
      { reference: "PMT-98874", client: "Nexa Engineering", paidOn: "2026-02-27", method: "GIRO", amount: "RM 19,800" },
      { reference: "PMT-98853", client: "Vanguard Services", paidOn: "2026-02-25", method: "Bank Transfer", amount: "RM 16,500" },
      { reference: "PMT-98821", client: "Apex Systems", paidOn: "2026-02-22", method: "Online Banking", amount: "RM 21,600" },
    ],
    updatedAt: new Date().toISOString(),
  };
}
