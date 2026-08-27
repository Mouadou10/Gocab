export function TableSkeleton() {
  return (
    <div className="w-full animate-pulse border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="h-12 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 w-full"></div>
      
      {/* Rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex p-4 border-b border-gray-100 dark:border-slate-800 space-x-4 items-center">
          <div className="h-4 w-1/4 bg-gray-200 dark:bg-slate-700 rounded"></div>
          <div className="h-4 w-1/4 bg-gray-200 dark:bg-slate-700 rounded"></div>
          <div className="h-4 w-1/4 bg-gray-200 dark:bg-slate-700 rounded"></div>
          <div className="h-4 w-1/4 bg-gray-200 dark:bg-slate-700 rounded"></div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm animate-pulse">
      <div className="h-5 w-1/3 bg-gray-200 dark:bg-slate-700 rounded mb-4"></div>
      <div className="h-8 w-1/2 bg-gray-200 dark:bg-slate-700 rounded mb-2"></div>
      <div className="h-4 w-2/3 bg-gray-200 dark:bg-slate-700 rounded mt-4"></div>
    </div>
  );
}
