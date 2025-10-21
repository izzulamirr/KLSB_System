import { getFinanceData } from "../../../lib/finance";

export const metadata = { title: "Finance | KLSB Portal" };
export const revalidate = 10; // ISR: revalidate every 10s

export default async function FinancePage() {
  const data = await getFinanceData();

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#0b1e3a]">Finance</h1>
          <p className="text-sm text-[#0e2b57]/70">Invoices, payments and account receivables.</p>
        </div>
        <div className="text-sm text-[#0e2b57]/60">Updated: {new Date(data.updatedAt).toLocaleString()}</div>
      </div>

      <section className="mt-8 grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {data.stats.map((s) => (
          <div key={s.label} className="group text-left rounded-2xl p-5 border border-[#7aa4cf]/30 bg-white/70 hover:bg-white shadow hover:shadow-lg transition relative overflow-hidden">
            <div className="text-xs uppercase tracking-wider text-[#0e2b57]/70">{s.label}</div>
            <div className="mt-2 text-3xl font-semibold text-[#0b1e3a]">{s.value}</div>
            <div className="mt-2 text-xs text-[#0e2b57]/70">{s.note}</div>
          </div>
        ))}
      </section>
    </section>
  );
}
