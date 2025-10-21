import { getManpowerData } from "../../../lib/manpower";
import ManpowerClient from "../../../components/ManpowerClient";

export const metadata = { title: "Manpower Database | KLSB Portal" };

export default async function ManpowerPage() {
  const data = await getManpowerData();
  const total = Array.isArray(data) ? data.length : 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2">
            <li>Dashboard</li>
            <li className="text-slate-400">/</li>
            <li className="font-medium text-slate-700">Manpower</li>
          </ol>
        </nav>

        <div className="flex items-center gap-4">
         
        </div>
      </div>

      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Manpower Database</h1>
          <p className="text-sm text-slate-600 mt-1">Employee directory — roles, locations and dates.</p>
        </div>

        <div className="mt-2 sm:mt-0 flex items-center gap-3">
          {/* reserved for toolbar actions */}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <main>
          <div className="bg-white shadow-sm rounded-lg border border-slate-100 p-6">
            <ManpowerClient initial={data} />
          </div>
        </main>
      </div>
    </section>
  );
}
