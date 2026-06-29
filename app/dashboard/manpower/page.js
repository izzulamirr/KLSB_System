import { getManpowerData } from "../../../lib/manpower";
import { effectiveStatusColor } from "../../../lib/manpowerStatus";
import ManpowerClient from "../../../components/ManpowerClient";

export const metadata = { title: "PO Database | KLSB Portal" };

export default async function ManpowerPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const poFilter = resolvedSearchParams?.po;
  const companyFilter = resolvedSearchParams?.company;

  const data = await getManpowerData({
    poSoNo: poFilter || null,
    location: companyFilter || null,
  });
  const total = Array.isArray(data) ? data.length : 0;
  const initial = data;

  const statusCounts = (initial || []).reduce(
    (acc, row) => {
      const status = String(effectiveStatusColor(row)).toLowerCase();
      if (status.includes("active") || status.includes("ongoing")) acc.active += 1;
      else if (status.includes("pending")) acc.pending += 1;
      else if (status.includes("completed") || status.includes("terminated")) acc.closed += 1;
      return acc;
    },
    { active: 0, pending: 0, closed: 0 }
  );

  const filterScope = poFilter
    ? `PO/SO: ${poFilter}`
    : companyFilter
    ? `Company: ${companyFilter}`
    : "All records";

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <nav className="text-sm text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2">
            <li>Dashboard</li>
            <li className="text-slate-400 dark:text-slate-600">/</li>
            <li className="font-medium text-slate-700 dark:text-slate-300">PO Database</li>
          </ol>
        </nav>

        <div className="flex items-center gap-4">
         
        </div>
      </div>

      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-slate-100">PO Database</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Employee directory — roles, locations and dates.</p>
          <div className="mt-3 inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
            Scope: {filterScope}
          </div>
        </div>

        <div className="mt-2 sm:mt-0 flex items-center gap-3">
          {/* reserved for toolbar actions */}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Staff</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{total}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 px-4 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Active</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-800 dark:text-emerald-300">{statusCounts.active}</div>
        </div>
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 px-4 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400">Pending</div>
          <div className="mt-1 text-2xl font-semibold text-amber-800 dark:text-amber-300">{statusCounts.pending}</div>
        </div>
        <div className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Closed</div>
          <div className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">{statusCounts.closed}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <main>
            <div className="bg-white dark:bg-slate-900 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
            <ManpowerClient initial={initial} />
          </div>
        </main>
      </div>
    </section>
  );
}