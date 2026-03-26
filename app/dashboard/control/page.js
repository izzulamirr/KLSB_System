"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../../firebase";
import ControlClient from "../../../components/ControlClient";

export default function ControlPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/login");
        setChecking(false);
        return;
      }

      (async () => {
        try {
          const token = await u.getIdToken();
          const res = await fetch("/api/auth/role", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            router.replace("/dashboard");
            return;
          }

          const data = await res.json();
          const role = String(data?.role || "").toLowerCase();
          if (role !== "sysdev") {
            router.replace("/dashboard");
            return;
          }

          setAllowed(true);
        } catch {
          router.replace("/dashboard");
        } finally {
          setChecking(false);
        }
      })();
    });

    return () => unsub();
  }, [router]);

  if (checking) {
    return <div className="px-4 py-3 text-sm text-slate-600">Checking access...</div>;
  }

  if (!allowed) return null;

  return <ControlClient />;
}
