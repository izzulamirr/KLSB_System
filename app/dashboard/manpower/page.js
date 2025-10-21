import { getManpowerData } from "../../../lib/manpower";
import ManpowerClient from "../../../components/ManpowerClient";

export const metadata = { title: "Manpower Database | KLSB Portal" };

export default async function ManpowerPage() {
  const data = await getManpowerData();

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#0b1e3a]">Manpower Database</h1>
          <p className="text-sm text-[#0e2b57]/70">Employee directory, roles and profiles.</p>
        </div>
        <div className="text-sm text-[#0e2b57]/60">Demo: data stored in local storage for edits</div>
      </div>

      <div className="mt-6">
        {/* client-side interactive table (uses localStorage) */}
        <ManpowerClient initial={data} />
      </div>
    </section>
  );
}
