"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center p-4 bg-gray-50 dark:bg-slate-900">
      <div className="rounded-lg bg-white dark:bg-slate-800 p-8 text-center shadow-lg border border-gray-100 dark:border-slate-700 max-w-md w-full">
        <h2 className="mb-2 text-2xl font-bold text-red-600 dark:text-red-400">Oops, something went wrong!</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          An unexpected error has occurred in the application.
        </p>
        <button
          onClick={() => reset()}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors w-full font-medium shadow-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
