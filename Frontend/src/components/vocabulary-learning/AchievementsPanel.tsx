import { useEffect, useState } from "react";
import { Achievement, fetchAchievements } from "../../services/vocabularyLearningApi";

export default function AchievementsPanel() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements()
      .then(setAchievements)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {achievements.map((a) => {
        const pct = Math.min(100, (a.progress_current / a.progress_target) * 100);
        return (
          <div
            key={a.code}
            className={`flex flex-col gap-2 rounded-xl border p-4 shadow-sm ${
              a.earned
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm font-semibold ${
                  a.earned ? "text-emerald-700 dark:text-emerald-300" : "text-gray-800 dark:text-white/90"
                }`}
              >
                {a.name}
              </span>
              {a.earned && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  Đạt được
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{a.description}</p>
            <div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-full ${a.earned ? "bg-emerald-500" : "bg-brand-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                {a.progress_current}/{a.progress_target}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
