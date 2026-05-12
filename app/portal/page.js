"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../firebase";

export default function PortalChooserPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const userEmail = String(user.email || "").toLowerCase();

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/auth/role", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.ok ? await res.json() : {};
        const resolvedEmail = String(data?.email || userEmail || "").toLowerCase();
        const resolvedRole = String(data?.role || "").toLowerCase();

        if (resolvedEmail === "admin@klsb.com") {
          setEmail(resolvedEmail);
          setAllowed(true);
          return;
        }

        if (resolvedRole === "bd") {
          router.replace("/bd");
          return;
        }

        router.replace("/dashboard");
      } catch {
        if (userEmail === "admin@klsb.com") {
          setEmail(userEmail);
          setAllowed(true);
          return;
        }
        router.replace("/login");
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-100">
        <div className="portal-shell px-5 py-3 text-sm text-slate-600">Loading portal selector...</div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center">
        <div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">One login, two portals</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Choose a portal</h1>
            <p className="mt-2 text-sm text-slate-600">Signed in as {email || "admin@klsb.com"}. Select the workspace you want to open.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-0.5 hover:border-[#0f3d7a]/30 hover:bg-[#eef4fd]"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">HR Portal</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">Human Resources</div>
              <p className="mt-2 text-sm text-slate-600">Manage staff, manpower, timesheets, and operational records.</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0f3d7a]">
                Open HR Portal
                <span className="transition group-hover:translate-x-1">→</span>
              </div>
            </button>

            <button
              onClick={() => router.push("/bd")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-0.5 hover:border-[#0f3d7a]/30 hover:bg-[#eef4fd]"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">BD Portal</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">Business Development</div>
              <p className="mt-2 text-sm text-slate-600">Track proposals, analytics, and BD staff management.</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0f3d7a]">
                Open BD Portal
                <span className="transition group-hover:translate-x-1">→</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}