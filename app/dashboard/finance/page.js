import { getFinanceData } from "../../../lib/finance";

export const metadata = { title: "Finance | KLSB Portal" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

function statusBadgeClasses(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("overdue") || normalized.includes("cancel")) {
    return "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800";
  }

  if (normalized.includes("due soon") || normalized.includes("draft") || normalized.includes("pending")) {
    return "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800";
  }

  if (normalized.includes("approved") || normalized.includes("open")) {
    return "bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-400 border border-sky-200 dark:border-sky-800";
  }

  if (normalized.includes("paid")) {
    return "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800";
  }

  return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
}

export default async function FinancePage() {
  const data = await getFinanceData();

  return (
    <section className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#0b1e3a] dark:text-slate-100">Finance</h1>
          <p className="mt-1 text-sm text-[#0e2b57]/70 dark:text-slate-400">Complete finance snapshot with invoices, receivables and payment tracking.</p>
        </div>
        <div className="rounded-xl border border-[#7aa4cf]/30 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-[#0e2b57]/80 dark:text-slate-400">
          <div>Last update</div>
          <div className="font-medium text-[#0b1e3a] dark:text-slate-100">{new Date(data.updatedAt).toLocaleString()}</div>
        </div>
      </header>

      <section className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {data.stats.map((stat) => (
          <article key={stat.label} className="rounded-2xl border border-[#7aa4cf]/30 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-[#0e2b57]/70 dark:text-slate-400">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-[#0b1e3a] dark:text-slate-100">{stat.value}</p>
            <p className="mt-2 text-xs text-[#0e2b57]/70 dark:text-slate-400">{stat.note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 grid-cols-1 xl:grid-cols-5">
        <article className="xl:col-span-3 rounded-2xl border border-[#7aa4cf]/30 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#0b1e3a] dark:text-slate-100">Receivables Aging</h2>
            <span className="text-xs text-[#0e2b57]/70 dark:text-slate-400">Open balances by bucket</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-700 text-[#0e2b57]/80 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Bucket</th>
                  <th className="py-2 pr-3 font-medium">Invoices</th>
                  <th className="py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.agingBuckets.map((item) => (
                  <tr key={item.bucket} className="border-b border-slate-100 dark:border-slate-800 last:border-0 text-[#0b1e3a] dark:text-slate-100">
                    <td className="py-3 pr-3">{item.bucket}</td>
                    <td className="py-3 pr-3">{item.invoiceCount}</td>
                    <td className="py-3 font-medium">{item.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="xl:col-span-2 rounded-2xl border border-[#7aa4cf]/30 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0b1e3a] dark:text-slate-100 mb-4">Collection KPIs</h2>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs uppercase text-[#0e2b57]/70 dark:text-slate-400">Collected (YTD)</p>
              <p className="text-2xl font-semibold text-[#0b1e3a] dark:text-slate-100 mt-1">{data.kpiBreakdown.collected}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs uppercase text-[#0e2b57]/70 dark:text-slate-400">Billed (YTD)</p>
              <p className="text-2xl font-semibold text-[#0b1e3a] dark:text-slate-100 mt-1">{data.kpiBreakdown.billed}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs uppercase text-[#0e2b57]/70 dark:text-slate-400">Collection Rate</p>
                <p className="text-xl font-semibold text-[#0b1e3a] dark:text-slate-100 mt-1">{data.kpiBreakdown.collectionRate}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs uppercase text-[#0e2b57]/70 dark:text-slate-400">DSO</p>
                <p className="text-xl font-semibold text-[#0b1e3a] dark:text-slate-100 mt-1">{data.kpiBreakdown.dso} days</p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-5 grid-cols-1 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#7aa4cf]/30 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0b1e3a] dark:text-slate-100 mb-4">Outstanding Receivables</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-700 text-[#0e2b57]/80 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Invoice</th>
                  <th className="py-2 pr-3 font-medium">Client</th>
                  <th className="py-2 pr-3 font-medium">Due Date</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.receivables.map((item) => (
                  <tr key={item.invoiceNo} className="border-b border-slate-100 dark:border-slate-800 last:border-0 text-[#0b1e3a] dark:text-slate-100 align-top">
                    <td className="py-3 pr-3 font-medium">{item.invoiceNo}</td>
                    <td className="py-3 pr-3">{item.client}</td>
                    <td className="py-3 pr-3">{item.dueDate}</td>
                    <td className="py-3 pr-3">{item.amount}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClasses(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-[#7aa4cf]/30 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0b1e3a] dark:text-slate-100 mb-4">Recent Invoices</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-700 text-[#0e2b57]/80 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Invoice</th>
                  <th className="py-2 pr-3 font-medium">Client</th>
                  <th className="py-2 pr-3 font-medium">Issue Date</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices.map((item) => (
                  <tr key={item.invoiceNo} className="border-b border-slate-100 dark:border-slate-800 last:border-0 text-[#0b1e3a] dark:text-slate-100 align-top">
                    <td className="py-3 pr-3">
                      <p className="font-medium">{item.invoiceNo}</p>
                      <p className="text-xs text-[#0e2b57]/70 dark:text-slate-400">{item.po}</p>
                    </td>
                    <td className="py-3 pr-3">{item.client}</td>
                    <td className="py-3 pr-3">{item.issueDate}</td>
                    <td className="py-3 pr-3">{item.amount}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClasses(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-5 grid-cols-1 xl:grid-cols-5">
        <article className="xl:col-span-3 rounded-2xl border border-[#7aa4cf]/30 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0b1e3a] dark:text-slate-100 mb-4">Monthly Billing Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-700 text-[#0e2b57]/80 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="py-2 pr-3 font-medium">Billed</th>
                  <th className="py-2 pr-3 font-medium">Collected</th>
                  <th className="py-2 font-medium">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlySummary.map((row) => (
                  <tr key={row.month} className="border-b border-slate-100 dark:border-slate-800 last:border-0 text-[#0b1e3a] dark:text-slate-100">
                    <td className="py-3 pr-3 font-medium">{row.month}</td>
                    <td className="py-3 pr-3">{row.billed}</td>
                    <td className="py-3 pr-3">{row.collected}</td>
                    <td className="py-3">{row.outstanding}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="xl:col-span-2 rounded-2xl border border-[#7aa4cf]/30 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0b1e3a] dark:text-slate-100 mb-4">Recent Payments</h2>
          <div className="space-y-3">
            {data.recentPayments.map((payment) => (
              <div key={payment.reference} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#0b1e3a] dark:text-slate-100">{payment.client}</p>
                    <p className="text-xs text-[#0e2b57]/70 dark:text-slate-400">{payment.reference} • {payment.method}</p>
                  </div>
                  <p className="font-semibold text-[#0b1e3a] dark:text-slate-100">{payment.amount}</p>
                </div>
                <p className="mt-1 text-xs text-[#0e2b57]/70 dark:text-slate-400">Paid on {payment.paidOn}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}
