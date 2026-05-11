"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "../../firebase";
import useIdleLogout from "../../lib/useIdleLogout";

export default function BdLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState("");

  const handleIdleTimeout = useCallback(async () => {
    await signOut(auth);
    router.replace("/login?reason=idle-timeout");
  }, [router]);

  useIdleLogout({
    enabled: !checking && authorized,
    timeoutMs: 5 * 60 * 1000,
    onTimeout: handleIdleTimeout,
  });

  const tabs = [
    { href: "/bd", label: "Dashboard" },
    { href: "/bd/scope", label: "Analytics" },
    { href: "/bd/proposals", label: "Proposal Tracker" },
    { href: "/bd/staff", label: "Staff Management" },
  ];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/auth/role", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();

        if (!res.ok) {
          router.push("/dashboard");
          return;
        }

        if (String(data?.role || "").toLowerCase() !== "bd") {
          router.push("/dashboard");
          return;
        }

        setAuthorized(true);
        setEmail(user.email || "");
      } catch {
        router.push("/dashboard");
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, [router]);

  if (checking || !authorized) {
    return (
      <div className="min-h-screen bg-slate-100 grid place-items-center">
        <div className="portal-shell px-4 py-2 text-sm text-slate-600">Loading BD workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Business Development</p>
              <h1 className="text-xl font-semibold text-slate-900">KLSB Portal</h1>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-sm text-slate-600">{email}</span>
              <button
                onClick={async () => {
                  await signOut(auth);
                  router.push("/login");
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-4 inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {tabs.map((tab) => {
              const active =
                tab.href === "/bd/proposals"
                  ? pathname?.startsWith("/bd/proposals") && !pathname?.startsWith("/bd/proposals/new")
                  : pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={
                    "rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 " +
                    (active
                      ? "bg-[#0f3d7a] !text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100")
                  }
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-8">
        <div className="portal-shell p-5 md:p-7">{children}</div>
      </main>
    </div>
  );
}
