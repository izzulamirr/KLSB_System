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
    <div className="min-h-screen flex bg-gradient-to-b from-[#0b1e3a] via-[#0e2b57] to-[#0b1e3a] relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-yellow-400/90 via-yellow-400 to-yellow-400/90" />

      <div className="absolute -right-40 -top-40 w-[420px] h-[420px] rotate-45 rounded-3xl bg-gradient-to-br from-white/10 to-transparent border border-white/20" />
      <div className="absolute -left-48 -bottom-48 w-[520px] h-[520px] rotate-45 rounded-3xl bg-gradient-to-tr from-white/10 to-transparent border border-white/10" />

      <aside className="hidden md:flex md:w-72 shrink-0 flex-col relative z-10 bg-white/10 backdrop-blur-xl border-r border-white/20 text-white">
        <div className="relative px-5 py-5 border-b border-white/10">
          <div className="flex items-center justify-center">
            <Image src="/logo/KLSB_icon.png" alt="KLSB Logo" width={64} height={64} className="object-contain drop-shadow" />
          </div>
        
        </div>

        <nav className="p-4 grid gap-1 text-sm">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "group flex items-center gap-3 px-3 py-2 rounded-xl transition border " +
                  (active
                    ? "text-white bg-white/15 border-white/20"
                    : "text-white/90 hover:text-white hover:bg:white/10 hover:bg-white/10 border-transparent hover:border-white/10")
                }
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
                <span className="ml-auto w-1.5 h-1.5 rotate-45 bg-yellow-400/60 group-hover:bg-yellow-400 rounded-[1px]" />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-white/10">
          <button
            onClick={async () => {
              await signOut(auth);
              router.push("/login");
            }}
            aria-label="Sign out"
            className="w-full py-2.5 rounded-xl font-medium bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow hover:shadow-lg transform hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            Logout
          </button>
          <p className="mt-2 text-[10px] text-white/60 text-center">v0.0.1</p>
        </div>
      </aside>

      <main className="relative z-10 flex-1 px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        <div className="min-h-full rounded-2xl bg-white/90 backdrop-blur-xl border border-white/40 shadow-2xl p-5 sm:p-8 text-[#0b1e3a]">
          {children}
        </div>
      </main>
    </div>
  );
}
