import { getManpowerData } from "../../../lib/manpower";
import ManpowerClient from "../../../components/ManpowerClient";

export const metadata = { title: "Manpower Database | KLSB Portal" };

export default async function ManpowerPage() {
  const data = await getManpowerData();

  return (
    <section className="space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Manpower Database</h1>
          <p className="text-sm text-slate-600 mt-1">Employee directory — roles, locations and dates.</p>
        </div>
       
      </header>

      <div className="bg-white shadow-sm rounded-lg border border-slate-100 p-4">
        <ManpowerClient initial={data} />
      </div>
    </section>
  );
}
