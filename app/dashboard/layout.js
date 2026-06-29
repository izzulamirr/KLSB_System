"use client";
import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "../../firebase";
import useIdleLogout from "../../lib/useIdleLogout";
import { withBasePath } from "../../lib/apiPath";

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");

  const handleIdleTimeout = useCallback(async () => {
    await signOut(auth);
    router.replace("/login?reason=idle-timeout");
  }, [router]);

  useIdleLogout({
    enabled: !checking,
    timeoutMs: 15 * 60 * 1000,
    onTimeout: handleIdleTimeout,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/login");
        setChecking(false);
        return;
      }

      (async () => {
        try {
          const token = await u.getIdToken();
          const res = await fetch(withBasePath("/api/auth/role"), {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            // Fail closed: without a resolved role we cannot tell BD users
            // from HR/sysdev users apart, so don't render any dashboard page.
            router.replace("/login?reason=role-check-failed");
            return;
          }

          const data = await res.json();
          const resolvedRole = String(data?.role || "").toLowerCase();
          setRole(resolvedRole);
          setEmail(String(data?.email || u.email || "").toLowerCase());

          // BD users are strictly scoped to BD portal only.
          if (resolvedRole === "bd") {
            router.replace("/bd");
            return;
          }

          // Non-sysdev users cannot open control center directly.
          if (pathname?.startsWith("/dashboard/control") && resolvedRole !== "sysdev") {
            router.replace("/dashboard");
            return;
          }

          setChecking(false);
        } catch {
          // Fail closed on network/parse errors too, for the same reason.
          router.replace("/login?reason=role-check-failed");
        }
      })();
    });
    return () => unsub();
  }, [router, pathname]);

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-950">
        <div className="portal-shell px-5 py-3 text-sm text-slate-600 dark:text-slate-400">
          Loading…
        </div>
      </div>
    );
  }

  const nav = [
    { href: "/dashboard", label: "Dashboard", icon: "DB" },
    { href: "/dashboard/manpower", label: "PO/SO Database", icon: "PO" },
    { href: "/dashboard/timesheet", label: "Timesheet Management", icon: "TS" },
    { href: "/dashboard/invoicing", label: "Invoicing", icon: "IV" },
    { href: "/dashboard/finance", label: "Finance", icon: "FN" },
    ...(role === "sysdev" ? [{ href: "/dashboard/control", label: "Control Center", icon: "CT" }] : []),
    { href: "/dashboard/settings", label: "System Settings", icon: "ST" },
    ...(role === "sysdev" ? [{ href: "/admin/users", label: "User Management", icon: "US" }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <aside className="hidden md:flex md:flex-col fixed left-0 top-0 w-72 h-screen z-40 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative px-6 py-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Image src="/logo-full.svg" alt="KLSB Logo" width={180} height={56} className="object-contain" />
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 flex items-center gap-2 font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Secure Access
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
                  "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border text-sm font-medium " +
                  (active
                    ? "text-[#0f3d7a] dark:text-blue-300 bg-[#eef4fd] dark:bg-blue-400/10 border-[#c9d9ef] dark:border-blue-400/30"
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700")
                }
              >
                <span className={
                  "inline-flex min-w-8 justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold " +
                  (active ? "bg-[#0f3d7a] text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300")
                }>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={async () => {
              await signOut(auth);
              router.push("/login");
            }}
            className="w-full py-2.5 rounded-xl font-semibold text-sm bg-[#0f3d7a] text-white hover:bg-[#0c3368] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/40"
          >
            Logout
          </button>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 text-center font-medium">Portal v0.0.1</p>
        </div>
      </aside>

      <main className="md:ml-72 min-h-screen px-4 sm:px-6 lg:px-8 py-6">
        <header className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">KLSB Workforce Portal</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Operations Dashboard</h2>
            </div>
            <Link
              href="/dashboard/profile"
              className="inline-flex items-center rounded-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:border-[#0f3d7a]/30 hover:bg-[#eef4fd] dark:hover:bg-blue-400/10 hover:text-[#0f3d7a] dark:hover:text-blue-300 self-start sm:self-center"
              title="Open profile settings"
              aria-label="Open profile settings"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 21a8 8 0 10-16 0" />
                <circle cx="12" cy="8" r="4" />
              </svg>
            </Link>
          </div>
        </header>
        <div className="portal-shell p-5 sm:p-7 text-[#0b1e3a] dark:text-slate-100">
          {children}
        </div>
      </main>
    </div>
  );
}
