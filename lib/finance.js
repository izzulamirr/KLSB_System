// lib/finance.js
// Simple server-side data provider for Finance demo.
// Replace with Firestore calls or real data fetching in production.

export async function getFinanceData() {
  // Simulate async fetch / DB read
  await new Promise((r) => setTimeout(r, 30));
  return {
    stats: [
      { label: "Invoices", value: 54, note: "12 overdue" },
      { label: "Payments", value: 23, note: "Last 7 days" },
      { label: "AR Balance", value: "RM 128k", note: "Current" },
    ],
    updatedAt: new Date().toISOString(),
  };
}
