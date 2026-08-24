"use client";

/**
 * GoCab CRM Login Page
 * Full-screen branded login with NextAuth credentials sign-in.
 * Wrapped in Suspense boundary as required by Next.js useSearchParams.
 */

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function GoCabLogoLarge() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
      <rect width="48" height="48" rx="14" fill="#1e3a5f" />
      <path d="M10 28l8-12 6 8 5-6 9 10" stroke="#f5c842" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="34" cy="32" r="4" fill="#f5c842"/>
      <circle cx="18" cy="32" r="4" fill="#f5c842"/>
    </svg>
  );
}

const ROLE_LABELS: Record<string, string> = {
  LEAD_ACQUISITION_JR: "Lead Acquisition",
  FLEET_PERF_MANAGER: "Fleet Performance",
  FIELD_SUPERVISOR: "Field Supervisor",
  FINANCE_OFFICER: "Finance Officer",
  OPS_MANAGER: "Ops Manager",
  ADMIN: "Administrator",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (error === "CredentialsSignin") {
      setErrorMsg("Invalid email or password. Please try again.");
    }
  }, [error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setErrorMsg("Invalid email or password. Please try again.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
      <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
      <p className="text-white/50 text-sm mb-8">Sign in to your team account</p>

      {errorMsg && (
        <div className="bg-red-500/15 border border-red-400/30 rounded-xl px-4 py-3 mb-5 text-sm text-red-300 flex items-center gap-2">
          <span>⚠️</span> {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gocab.ma"
            className="w-full bg-white/10 border border-white/10 text-white placeholder-white/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5c842]/50 focus:border-[#f5c842]/50 transition-all"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-white/60 mb-2 uppercase tracking-wider">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/10 border border-white/10 text-white placeholder-white/25 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5c842]/50 focus:border-[#f5c842]/50 transition-all pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors text-xs"
            >
              {showPass ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          id="login-submit"
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#f5c842] hover:bg-[#f5c842]/90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-[#0f1e35] font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all shadow-lg shadow-[#f5c842]/20 mt-2"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-[#0f1e35]/30 border-t-[#0f1e35] rounded-full animate-spin" />
              Signing in…
            </span>
          ) : (
            "Sign in to GoCab"
          )}
        </button>
      </form>

      {/* Role hints */}
      <div className="mt-8 pt-6 border-t border-white/10">
        <p className="text-xs text-white/30 text-center mb-4">Team roles on this platform</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {Object.values(ROLE_LABELS).map((label) => (
            <span
              key={label}
              className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/40 font-medium"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1e35] via-[#1e3a5f] to-[#0a1628] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(#f5c842 1px, transparent 1px), linear-gradient(90deg, #f5c842 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#f5c842]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo + Brand */}
        <div className="flex flex-col items-center mb-10 gap-4">
          <GoCabLogoLarge />
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">GoCab CRM</h1>
            <p className="text-[#f5c842]/70 text-sm font-medium tracking-widest uppercase mt-1">
              Operations Platform
            </p>
          </div>
        </div>

        <Suspense fallback={<div className="text-white text-center py-8">Loading...</div>}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-white/20 text-xs mt-8">
          GoCab Operations Platform · Casablanca Hub · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
