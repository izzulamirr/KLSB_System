"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import BDStaffManagementClient from "../../../components/bd/BDStaffManagementClient";

export default function AdminUsersPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        setChecking(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/auth/role", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          // Fallback: if role API is unavailable, allow based on client email for admin or BD admin
          const fallbackEmail = String(user?.email || "").toLowerCase();
          if (fallbackEmail === "admin@klsb.com" || fallbackEmail === "bd@gmail.com") {
            setRole(fallbackEmail === "admin@klsb.com" ? "sysdev" : "bd");
            setEmail(fallbackEmail);
            setAllowed(true);
            setChecking(false);
            return;
          }
          router.replace("/");
          setChecking(false);
          return;
        }

        const data = await res.json();
        const resolvedRole = String(data?.role || "").toLowerCase();
        const respEmail = String(data?.email || user.email || "").toLowerCase();
        setRole(resolvedRole);
        setEmail(respEmail);

        if (resolvedRole === "sysdev" || respEmail === "admin@klsb.com" || respEmail === "bd@gmail.com") {
          setAllowed(true);
        } else {
          router.replace("/dashboard");
        }
      } catch (err) {
        console.error(err);
        router.replace("/");
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-100">
        <div className="portal-shell px-5 py-3 text-sm text-slate-600">Loading user management…</div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      <main className="mx-auto max-w-[1200px] px-5 py-8">
        <div className="portal-shell p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
            </div>

            {(role === "sysdev" || String(email || "").toLowerCase() === "admin@klsb.com") && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="rounded-md border border-transparent bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Open HR Portal
                </button>
                <button
                  onClick={() => router.push("/bd")}
                  className="rounded-md bg-[#0f3d7a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0c3368]"
                >
                  Open BD Portal
                </button>
              </div>
            )}
          </div>

            <div className="max-w-[1100px] mx-auto">
              <BDStaffManagementClient viewRole={role === "bd" ? "bd" : role === "hr" ? "hr" : undefined} />
            </div>
        </div>
      </main>
    </div>
  );
}
