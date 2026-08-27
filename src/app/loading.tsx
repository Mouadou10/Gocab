export default function Loading() {
  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        {/* Spinner */}
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 dark:border-slate-700 border-t-blue-600 dark:border-t-blue-400"></div>
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400 animate-pulse">
          Loading GoCab CRM...
        </p>
      </div>
    </div>
  );
}
