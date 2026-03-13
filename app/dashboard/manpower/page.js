import { getManpowerData } from "../../../lib/manpower";
import ManpowerClient from "../../../components/ManpowerClient";

export const metadata = { title: "PO Database | KLSB Portal" };

export default async function ManpowerPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const poFilter = resolvedSearchParams?.po;
  const companyFilter = resolvedSearchParams?.company;
  const bilFilter = resolvedSearchParams?.bil;

  const data = await getManpowerData({
    bil: bilFilter || null,
    poSoNo: poFilter || null,
    location: companyFilter || null,
  });
  const total = Array.isArray(data) ? data.length : 0;
  const initial = data;

  const statusCounts = (initial || []).reduce(
    (acc, row) => {
      const status = String(row?.STATUS_COLOR || row?.STATUS || "").toLowerCase();
      if (status.includes("active") || status.includes("ongoing")) acc.active += 1;
      else if (status.includes("pending")) acc.pending += 1;
      else if (status.includes("completed") || status.includes("terminated")) acc.closed += 1;
      return acc;
    },
    { active: 0, pending: 0, closed: 0 }
  );

  const filterScope = bilFilter
    ? `BIL: ${bilFilter}`
    : poFilter
    ? `PO/SO: ${poFilter}`
    : companyFilter
    ? `Company: ${companyFilter}`
    : "All records";

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2">
            <li>Dashboard</li>
            <li className="text-slate-400">/</li>
            <li className="font-medium text-slate-700">PO Database</li>
          </ol>
        </nav>

        <div className="flex items-center gap-4">
         
        </div>
      </div>

      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">PO Database</h1>
          <p className="text-sm text-slate-600 mt-1">Employee directory — roles, locations and dates.</p>
          <div className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            Scope: {filterScope}
          </div>
        </div>

        <div className="mt-2 sm:mt-0 flex items-center gap-3">
          {/* reserved for toolbar actions */}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Staff</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{total}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-emerald-700">Active</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-800">{statusCounts.active}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-amber-700">Pending</div>
          <div className="mt-1 text-2xl font-semibold text-amber-800">{statusCounts.pending}</div>
        </div>
        <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-600">Closed</div>
          <div className="mt-1 text-2xl font-semibold text-slate-800">{statusCounts.closed}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <main>
            <div className="bg-white shadow-sm rounded-xl border border-slate-200 p-4 sm:p-6">
            <ManpowerClient initial={initial} />
          </div>
        </main>
      </div>
    </section>
  );
}