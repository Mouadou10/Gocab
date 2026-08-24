"use client";

/**
 * PasswordChangeModal Component
 * 
 * Enforced on first login if the user has `mustChangePassword === true`.
 * Blocks access to the dashboard until a secure personal password is created.
 */

import React, { useState } from "react";
import toast from "react-hot-toast";

interface PasswordChangeModalProps {
  userEmail: string;
  userName: string;
  onPasswordChanged: () => void;
}

export default function PasswordChangeModal({
  userEmail,
  userName,
  onPasswordChanged,
}: PasswordChangeModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword === "GoCab2024!") {
      setErrorMsg("Please choose a new password different from the default initial password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please retype carefully.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Password updated successfully! Welcome to GoCab.");
        onPasswordChanged();
      } else {
        setErrorMsg(data.error || "Failed to update password.");
      }
    } catch (err) {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full p-8 relative overflow-hidden">
        {/* Top decorative accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#f5c842] to-amber-500" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl">
            🔐
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">First-Time Login Security</h2>
            <p className="text-xs text-gray-500 mt-0.5">Welcome, {userName || "Team Member"}!</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 mb-6 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
          For your account security, you must set a new personal password before accessing the GoCab Operations dashboard.
        </p>

        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              New Personal Password
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                required
                minLength={8}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy/30 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[11px]"
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Confirm New Password
            </label>
            <input
              type={showPass ? "text" : "password"}
              required
              minLength={8}
              placeholder="Retype your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 bg-navy hover:bg-navy/90 text-white font-bold text-xs rounded-xl shadow-md shadow-navy/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Updating Security Credentials…
              </>
            ) : (
              "Save Password & Enter CRM"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
