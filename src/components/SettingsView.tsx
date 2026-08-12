"use client";

/**
 * SettingsView Component
 * 
 * Allows users to write and customize the WhatsApp confirmation template.
 * Saves settings to the SQLite database.
 */

import { useState, useEffect } from "react";

export default function SettingsView() {
  const [template, setTemplate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.settings && data.settings.whatsapp_invite_template) {
          setTemplate(data.settings.whatsapp_invite_template);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "whatsapp_invite_template",
          value: template,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved successfully!" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save settings." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-2xl mx-auto mt-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-navy px-6 py-5">
        <h2 className="text-white text-lg font-semibold flex items-center gap-2">
          <span>⚙️</span> CRM Configuration Settings
        </h2>
        <p className="text-white/70 text-xs mt-1">
          Customize system-wide behaviors, notification templates, and messaging defaults.
        </p>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            WhatsApp Training Confirmation Template
          </label>
          <textarea
            rows={6}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy/50 focus:border-navy"
            placeholder="Write your WhatsApp message here..."
          />
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Configure the message sent automatically to drivers when their training session is fixed.
          </p>
        </div>

        {/* Placeholders Guide */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">
            Available Placeholders
          </h4>
          <ul className="text-xs text-blue-700 space-y-1.5 list-disc list-inside">
            <li>
              <code className="bg-blue-100 px-1 py-0.5 rounded font-semibold">{`{name}`}</code>
              {" — "} Substitutes the driver's full name (e.g. John Doe).
            </li>
            <li>
              <code className="bg-blue-100 px-1 py-0.5 rounded font-semibold">{`{date}`}</code>
              {" — "} Substitutes the scheduled date formatted as DD/MM/YYYY.
            </li>
            <li>
              <code className="bg-blue-100 px-1 py-0.5 rounded font-semibold">{`{time}`}</code>
              {" — "} Substitutes session time (11:00 AM on Fridays, 3:00 PM Monday-Thursday).
            </li>
          </ul>
        </div>

        {/* Feedback Message */}
        {message && (
          <div
            className={`p-3.5 rounded-xl text-sm ${
              message.type === "success"
                ? "bg-olive/10 border border-olive/30 text-olive"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {message.type === "success" ? "✅" : "⚠️"} {message.text}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-navy hover:bg-navy/95 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
