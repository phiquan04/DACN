import { StudyOverview } from "../../services/vocabularyLearningApi";
import { ArrowUpIcon } from "../../icons";

export default function LevelProgressCard({ overview, loading }: { overview: StudyOverview | null; loading: boolean }) {
  const xpSpan = overview ? Math.max(1, overview.level_xp_ceil - overview.level_xp_floor) : 1;
  const xpProgress = overview ? Math.min(100, Math.max(0, ((overview.xp - overview.level_xp_floor) / xpSpan) * 100)) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
      <h4 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90">
        <ArrowUpIcon className="h-4 w-4 text-brand-500" /> Tiến độ lên cấp
      </h4>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
      ) : !overview ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có dữ liệu học tập.</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Cấp {overview.level}
              <span className="mx-1 text-gray-300 dark:text-gray-600">→</span>
              {overview.level + 1}
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
              {overview.xp - overview.level_xp_floor} / {xpSpan} XP
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${xpProgress}%` }} />
          </div>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            Còn {xpSpan - (overview.xp - overview.level_xp_floor)} XP nữa để lên cấp {overview.level + 1}!
          </p>
        </>
      )}
    </div>
  );
}
