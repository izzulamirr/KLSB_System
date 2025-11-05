"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "../../firebase";

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      setChecking(false);
    });
    return () => unsub();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-b from-[#0b1e3a] via-[#0e2b57] to-[#0b1e3a] relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="absolute w-[700px] h-[700px] bg-white/5 rounded-[3rem] rotate-45 blur-3xl left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="text-white/90 text-sm tracking-wide bg-white/10 border border-white/20 px-4 py-2 rounded-xl backdrop-blur">
          Loading…
        </div>
      </div>
    );
  }

  const nav = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/dashboard/manpower", label: "Manpower Database", icon: "�" },
    { href: "/dashboard/timesheet", label: "Timesheet Management", icon: "🕒" },
    { href: "/dashboard/finance", label: "Finance & Invoicing", icon: "💰" },
    { href: "/dashboard/control", label: "Control Center", icon: "🧩" },
    { href: "/dashboard/settings", label: "System Settings", icon: "⚙" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1e3a] via-[#0e2b57] to-[#0b1e3a] relative overflow-x-hidden">
      <div className="pointer-events-none absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-yellow-400/90 via-yellow-400 to-yellow-400/90 z-50" />

      <div className="absolute -right-40 -top-40 w-[420px] h-[420px] rotate-45 rounded-3xl bg-gradient-to-br from-white/10 to-transparent border border-white/20" />
      <div className="absolute -left-48 -bottom-48 w-[520px] h-[520px] rotate-45 rounded-3xl bg-gradient-to-tr from-white/10 to-transparent border border-white/10" />

      {/* Fixed Sidebar */}
      <aside className="hidden md:block fixed left-0 top-0 w-80 h-screen z-40 bg-white/15 backdrop-blur-2xl border-r-2 border-white/30 text-white shadow-2xl">
        <div className="relative px-6 py-6 border-b border-white/20">
          <div className="flex items-center gap-3">
            <Image src="/logo-full.svg" alt="KLSB Logo" width={180} height={56} className="object-contain drop-shadow-lg" />
          </div>
          <p className="mt-4 text-xs uppercase tracking-wider text-white/80 flex items-center gap-2 font-medium">
            <span className="inline-block w-2 h-2 rotate-45 bg-yellow-400 animate-pulse" /> Secure Access
          </p>
        </div>

        <nav className="p-5 space-y-2 overflow-y-auto h-[calc(100vh-220px)]">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 border text-base font-medium " +
                  (active
                    ? "text-white bg-white/20 border-white/30 shadow-lg scale-[1.02]"
                    : "text-white/90 hover:text-white hover:bg-white/10 border-transparent hover:border-white/20 hover:scale-[1.02]")
                }
              >
                <span className="text-xl">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <span className="w-2 h-2 rotate-45 bg-yellow-400/60 group-hover:bg-yellow-400 rounded-[1px] transition-colors" />
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-white/20 bg-white/5 backdrop-blur">
          <button
            onClick={async () => {
              await signOut(auth);
              router.push("/login");
            }}
            className="w-full py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            Logout
          </button>
          <p className="mt-3 text-xs text-white/70 text-center font-medium">Portal v0.0.1</p>
        </div>
      </aside>

      {/* Main Content with left margin for fixed sidebar */}
      <main className="md:ml-80 relative z-10 min-h-screen px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        <div className="rounded-2xl bg-white/90 backdrop-blur-xl border border-white/40 shadow-2xl p-5 sm:p-8 text-[#0b1e3a]">
          {children}
        </div>
      </main>
    </div>
  );
}
