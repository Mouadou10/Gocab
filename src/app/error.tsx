"use client";

import { useEffect, useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-[#f4f6fb]">
      <div className="rounded-3xl bg-white p-8 text-center shadow-xl border border-gray-100 max-w-lg w-full space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-3xl shadow-xs">
          ⚠️
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-gray-900">Une erreur inattendue est survenue</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            L&apos;application a rencontré un problème temporaire. Vous pouvez réessayer ou actualiser la page.
          </p>
        </div>

        {error?.message && (
          <div className="text-left bg-gray-50 border border-gray-200 rounded-2xl p-3.5 space-y-2">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-2xs font-bold text-gray-600 hover:text-navy flex items-center justify-between w-full cursor-pointer"
            >
              <span>Détails techniques :</span>
              <span>{showDetails ? "▲ Masquer" : "▼ Afficher"}</span>
            </button>
            {showDetails && (
              <div className="space-y-1">
                <p className="text-3xs font-mono text-red-600 break-all">{error.message}</p>
                {error.digest && (
                  <p className="text-3xs font-mono text-gray-400">Digest: {error.digest}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 rounded-xl bg-navy px-4 py-2.5 text-xs text-white hover:bg-navy/90 transition-all font-bold shadow-xs cursor-pointer"
          >
            🔄 Réessayer
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-200 transition-all font-bold cursor-pointer"
          >
            🌐 Actualiser la page
          </button>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <a
            href="/login"
            className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            ← Retourner à la page de connexion
          </a>
        </div>
      </div>
    </div>
  );
}
