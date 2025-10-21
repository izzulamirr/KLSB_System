"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../firebase";

export default function Page() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUser(u);
    });
    return () => unsub();
  }, [router]);

  if (!user) return null;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#0b1e3a]">Welcome, {user?.email}</h1>
          <p className="text-sm text-[#0e2b57]/70">Select a section from the sidebar to begin.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="h-px w-24 bg-gradient-to-r from-transparent via-[#0e2b57]/20 to-transparent" />
          <span className="w-8 h-[3px] rounded-full bg-yellow-400" />
          <span className="h-px w-24 bg-gradient-to-r from-transparent via-[#0e2b57]/20 to-transparent" />
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {[
          { title: "Finance", kpi: "Invoices", value: "54", note: "12 overdue" },
          { title: "Recruitment", kpi: "Active Reqs", value: "7", note: "3 interviews today" },
          { title: "Tender & Proposal", kpi: "Open Bids", value: "5", note: "2 due this week" },
        ].map((c) => (
          <div
            key={c.title}
            className="group text-left rounded-2xl p-5 border border-[#7aa4cf]/30 bg-white/70 hover:bg-white shadow hover:shadow-lg transition relative overflow-hidden"
          >
            <span className="absolute -right-4 -top-4 w-16 h-16 rotate-45 bg-gradient-to-br from-white to-[#dfeaf7] border border-white/70 shadow" />
            <div className="text-xs uppercase tracking-wider text-[#0e2b57]/70">{c.title}</div>
            <div className="mt-2 text-3xl font-semibold text-[#0b1e3a]">{c.value}</div>
            <div className="text-sm text-[#0e2b57]/70">{c.kpi}</div>
            <div className="mt-2 text-xs text-[#0e2b57]/70">{c.note}</div>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-[#7aa4cf]/30 bg-white/70 p-5">
          <h3 className="text-lg font-semibold text-[#0b1e3a]">Recent Activity</h3>
          <ul className="mt-4 space-y-3 text-sm text-[#0e2b57]/80">
            <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rotate-45 bg-yellow-400" /> New invoice draft created for NOV Malaysia.</li>
            <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rotate-45 bg-yellow-400" /> Recruitment: 2 candidates moved to Interview.</li>
            <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rotate-45 bg-yellow-400" /> Tender: Submitted proposal for SRU package.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[#7aa4cf]/30 bg-white/70 p-5">
          <h3 className="text-lg font-semibold text-[#0b1e3a]">Shortcuts</h3>
          <div className="mt-4 grid gap-3">
            {["Create Invoice", "Add Candidate", "New Proposal"].map((label) => (
              <div key={label} className="px-3 py-2 rounded-xl bg-white border border-[#7aa4cf]/40 text-[#0b1e3a]">
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
