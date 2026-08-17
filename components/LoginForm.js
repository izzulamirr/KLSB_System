"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import Image from "next/image";
import { withBasePath } from "../lib/apiPath";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const sessionTimedOut = searchParams.get("reason") === "idle-timeout";

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const signedInEmail = String(credential.user.email || email || "").toLowerCase();

      let targetRoute = "/dashboard";
      try {
        const roleRes = await fetch(withBasePath("/api/auth/role"), {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (roleRes.ok) {
          const roleData = await roleRes.json();
          if (signedInEmail === "admin@klsb.com") {
            targetRoute = "/portal";
          } else if (String(roleData?.role || "").toLowerCase() === "bd") {
            targetRoute = "/bd";
          } else {
            targetRoute = "/dashboard";
          }
        }
      } catch {
        targetRoute = signedInEmail === "admin@klsb.com" ? "/portal" : "/dashboard";
      }

      router.push(targetRoute);
    } catch (err) {
      console.error(err.code, err.message);
      setError(err.code || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleLogin}
      className="relative z-10 w-full max-w-md portal-shell px-8 sm:px-10 py-10 sm:py-12"
      aria-labelledby="klsb-login-title"
    >
      <div className="flex flex-col items-center gap-3 mb-6 text-center">
        <Image
          src={withBasePath("/KLSB_icon.png")}
          alt="KLSB Icon"
          width={84}
          height={84}
          priority
          unoptimized
          className="object-contain mx-auto"
        />
      </div>

      <h2
        id="klsb-login-title"
        className="text-2xl font-semibold text-center text-[#0b1e3a]"
      >
        KLSB Portal Login
      </h2>

      <div className="mt-4 mb-8 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Secure Access</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {sessionTimedOut && (
        <div
          role="status"
          className="text-amber-700 text-sm mb-4 text-center bg-amber-50/90 border border-amber-200 px-3 py-2 rounded-lg"
        >
          Session ended due to 15 minutes of inactivity. Please sign in again.
        </div>
      )}

      <label className="block text-sm font-medium text-[#0e2b57]">Email</label>
      <input
        type="email"
        placeholder="you@klsb.com.my"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="mt-1 mb-5 w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-[#0b1e3a] placeholder-[#0b1e3a]/40 focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/25 focus:border-[#0e2b57] transition"
        autoComplete="email"
        inputMode="email"
      />

      <div>
        <label className="block text-sm font-medium text-[#0e2b57]">Password</label>
      </div>
      <div className="relative">
        <input
          type={showPw ? "text" : "password"}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1 mb-4 w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-[#0b1e3a] placeholder-[#0b1e3a]/40 focus:outline-none focus:ring-2 focus:ring-[#0f3d7a]/25 focus:border-[#0e2b57] transition"
          autoComplete="current-password"
        />
      </div>

      <div className="mb-4 text-right">
        <button
          type="button"
          onClick={() => setShowPw((s) => !s)}
          className="text-xs text-[#0e2b57]/70 hover:text-[#0e2b57] underline decoration-dotted"
          aria-pressed={showPw}
        >
          {showPw ? "Hide" : "Show"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="text-red-700 text-sm mb-4 text-center bg-red-50/90 border border-red-200 px-3 py-2 rounded-lg"
        >
          {error.replace("auth/", "").replaceAll("-", " ")}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl font-medium text-white bg-[#0f3d7a] hover:bg-[#0c3368] transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span>{loading ? "Signing in…" : "Login"}</span>
      </button>

      <div className="mt-4 flex items-center justify-between text-xs text-[#0e2b57]/70">
        <a className="hover:underline" href="#" onClick={(e) => e.preventDefault()}>
          Forgot password?
        </a>
        <span>v0.0.1</span>
      </div>
    </form>
  );
}
