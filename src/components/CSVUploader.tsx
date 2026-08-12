"use client";

/**
 * CSVUploader Component
 *
 * File input + upload button that sends a CSV to /api/upload-leads.
 * Displays a summary toast after upload completes.
 */

import { useState, useRef } from "react";

interface UploadSummary {
  total_rows: number;
  inserted: number;
  duplicates: number;
  blacklisted: number;
  skipped_invalid: number;
}

interface CSVUploaderProps {
  onUploadComplete: () => void;
}

export default function CSVUploader({ onUploadComplete }: CSVUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload-leads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      setSummary(data.summary);
      onUploadComplete();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 cursor-pointer bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-4 py-2 text-sm text-white border border-white/20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <span>Choose CSV</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={() => {
            setError(null);
            setSummary(null);
          }}
        />
      </label>

      <button
        onClick={handleUpload}
        disabled={isUploading}
        className="bg-olive hover:bg-olive/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {isUploading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Uploading…
          </span>
        ) : (
          "Upload Leads"
        )}
      </button>

      {/* Upload result toast */}
      {summary && (
        <div className="bg-olive/20 border border-olive/40 text-white text-xs rounded-lg px-3 py-2 animate-fade-in">
          ✅ {summary.inserted} inserted · {summary.duplicates} duplicates ·{" "}
          {summary.blacklisted} blacklisted
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-200 text-xs rounded-lg px-3 py-2 animate-fade-in">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
