"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import Image from "next/image";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err) {
      console.error(err.code, err.message);
      setError(err.code || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#0b1e3a] via-[#0e2b57] to-[#0b1e3a]">
      {/* Subtle top yellow accent line */}
      <div className="pointer-events-none absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-yellow-400/90 via-yellow-400 to-yellow-400/90" />

      {/* Cosmic star dots for depth */}
      <div className="absolute inset-0 opacity-20 [background:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]" />

      {/* Big soft diamond glow behind card */}
      <div className="absolute w-[820px] h-[820px] bg-white/5 rounded-[3rem] rotate-45 blur-3xl" style={{
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%) rotate(45deg)",
      }} />

      {/* Layered diamond accents (brand motif) */}
      <div className="absolute -right-40 -top-40 w-[420px] h-[420px] rotate-45 rounded-3xl bg-gradient-to-br from-white/10 to-white/0 border border-white/20 shadow-[0_0_60px_rgba(255,255,255,0.08)]" />
      <div className="absolute -left-44 -bottom-44 w-[520px] h-[520px] rotate-45 rounded-3xl bg-gradient-to-tr from-white/10 to-transparent border border-white/10" />

      {/* Animated thin yellow orbit line hint */}
      <div className="absolute h-px w-[140%] left-1/2 -translate-x-1/2 -rotate-2 bg-gradient-to-r from-transparent via-yellow-400/70 to-transparent animate-pulse [animation-duration:2400ms]" style={{ top: "18%" }} />

      {/* Login Card */}
      <form
        onSubmit={handleLogin}
        className="relative z-10 w-full max-w-md bg-white/90 backdrop-blur-xl rounded-2xl border border-white/30 shadow-2xl px-8 sm:px-10 py-10 sm:py-12"
        aria-labelledby="klsb-login-title"
      >
       

        <div className="flex flex-col items-center gap-3 mb-6">
          <Image
            src="/logo-full.svg"
            alt="KLSB Logo"
            width={200}
            height={64}
            priority
            className="object-contain drop-shadow-[0_4px_16px_rgba(255,255,255,0.35)]"
          />
          <div className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#0b1e3a]/70">
            <span className="inline-block w-1.5 h-1.5 rotate-45 bg-[#0b1e3a]" />
            <span>Secure Access</span>
          </div>
        </div>

        <h2
          id="klsb-login-title"
          className="text-2xl font-semibold text-center text-[#0b1e3a]"
        >
          KLSB Portal Login
        </h2>

        {/* Divider with yellow dash */}
        <div className="mt-4 mb-8 flex items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#0e2b57]/20 to-transparent" />
          <span className="w-10 h-[3px] rounded-full bg-yellow-400" />
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#0e2b57]/20 to-transparent" />
        </div>

        <label className="block text-sm font-medium text-[#0e2b57]">Email</label>
        <input
          type="email"
          placeholder="you@klsb.com.my"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 mb-5 w-full px-4 py-3 rounded-xl border border-[#7aa4cf]/60 bg-white/80 text-[#0b1e3a] placeholder-[#0b1e3a]/40 shadow-inner focus:outline-none focus:ring-4 focus:ring-[#7aa4cf]/40 focus:border-[#0e2b57] transition"
          autoComplete="email"
          inputMode="email"
        />

        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-[#0e2b57]">Password</label>
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="text-xs text-[#0e2b57]/70 hover:text-[#0e2b57] underline decoration-dotted"
            aria-pressed={showPw}
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 mb-4 w-full px-4 py-3 rounded-xl border border-[#7aa4cf]/60 bg-white/80 text-[#0b1e3a] placeholder-[#0b1e3a]/40 shadow-inner focus:outline-none focus:ring-4 focus:ring-[#7aa4cf]/40 focus:border-[#0e2b57] transition"
            autoComplete="current-password"
          />

          {/* Small floating diamond ornament */}
          <span className="pointer-events-none absolute -right-3 -bottom-3 w-4 h-4 rotate-45 bg-gradient-to-br from-white to-[#c7d9ee] border border-white/60 shadow" />
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
          className="group relative w-full py-3 rounded-xl font-medium text-white bg-gradient-to-r from-[#0e2b57] to-[#0b1e3a] shadow-lg hover:shadow-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="relative z-10">{loading ? "Signing in…" : "Login"}</span>
          {/* sheen */}
          <span className="absolute inset-0 overflow-hidden rounded-xl">
            <span className="absolute -inset-10 -skew-x-12 opacity-0 group-hover:opacity-30 bg-white/60 blur-2xl transition-opacity duration-500" />
          </span>
        </button>

        {/* Helper links */}
        <div className="mt-4 flex items-center justify-between text-xs text-[#0e2b57]/70">
          <a className="hover:underline" href="#" onClick={(e) => e.preventDefault()}>
            Forgot password?
          </a>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rotate-45 bg-yellow-400" />
            <span>v0.0.1</span>
          </div>
        </div>
      </form>

      {/* Bottom-right subtle yellow accent line */}
      <div className="pointer-events-none absolute bottom-6 right-8 h-[2px] w-40 bg-gradient-to-r from-yellow-400/0 via-yellow-400 to-yellow-400/0" />
    </div>
  );
}
