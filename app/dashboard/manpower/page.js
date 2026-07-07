import { getManpowerData } from "../../../lib/manpower";
import ManpowerClient from "../../../components/ManpowerClient";
import ManpowerSummaryCards from "../../../components/ManpowerSummaryCards";

export const metadata = { title: "PO Database | KLSB Portal" };

export default async function ManpowerPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const poFilter = resolvedSearchParams?.po;
  const companyFilter = resolvedSearchParams?.company;

  let initial = [];
  try {
    initial = await getManpowerData({
      poSoNo: poFilter || null,
      location: companyFilter || null,
    });
  } catch (error) {
    console.error("Failed to load manpower data for page:", error);
    initial = [];
  }

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

      <ManpowerSummaryCards poFilter={poFilter || null} companyFilter={companyFilter || null} initialRows={initial} />

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