import type { ErrorTypeStat } from "../../../services/grammarApi";

/** Sidebar widget: the user's most frequent grammar error types, from their check history. */
export default function ErrorStatsCard({ stats, loading }: { stats: ErrorTypeStat[]; loading: boolean }) {
  if (!loading && stats.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Lỗi bạn hay gặp</h2>
      <div className="space-y-4">
        {loading
          ? [0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="mb-1.5 h-3.5 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800" />
              </div>
            ))
          : stats.map((stat) => (
              <div key={stat.error_type}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{stat.error_type}</span>
                  <span className="font-medium text-gray-500 dark:text-gray-400">{stat.percentage}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.min(100, stat.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
