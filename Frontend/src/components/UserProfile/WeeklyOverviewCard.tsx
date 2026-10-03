import { StudyOverview } from "../../services/vocabularyLearningApi";
import { TrendingUpIcon } from "../../icons/custom";

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function WeeklyOverviewCard({ overview, loading }: { overview: StudyOverview | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
      </div>
    );
  }

  if (!overview || overview.heatmap.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90">
          <TrendingUpIcon className="h-4 w-4 text-brand-500" /> Tổng quan tuần này
        </h4>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Chưa có dữ liệu học tập.</p>
      </div>
    );
  }

  const days = overview.heatmap;
  const thisWeek = days.slice(-7);
  const lastWeek = days.slice(-14, -7);

  const target = Math.max(1, overview.daily_goal * thisWeek.length);
  const total = thisWeek.reduce((sum, d) => sum + d.count, 0);
  const percent = Math.min(100, Math.round((total / target) * 100));

  const lastWeekTotal = lastWeek.reduce((sum, d) => sum + d.count, 0);
  const delta =
    lastWeek.length === 0
      ? null
      : lastWeekTotal === 0
        ? total > 0
          ? 100
          : 0
        : Math.round(((total - lastWeekTotal) / lastWeekTotal) * 100);

  const maxCount = Math.max(overview.daily_goal, ...thisWeek.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90">
          <TrendingUpIcon className="h-4 w-4 text-brand-500" /> Tổng quan tuần này
        </h4>
        <select
          disabled
          value={7}
          title="Khoảng thời gian"
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
        >
          <option value={7}>7 ngày</option>
        </select>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-bold text-gray-800 dark:text-white/90">{percent}%</p>
        {delta !== null && (
          <span
            className={`mb-1 text-xs font-semibold ${
              delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {delta}% so với tuần trước
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">hoàn thành mục tiêu</p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-400"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-5 flex items-end justify-between gap-2">
        {thisWeek.map((d) => {
          const weekday = new Date(`${d.date}T00:00:00`).getDay();
          const met = d.count >= overview.daily_goal && overview.daily_goal > 0;
          const height = Math.max(4, Math.round((d.count / maxCount) * 56));
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-14 w-full items-end justify-center">
                <div
                  className={`w-4 rounded-t-sm ${met ? "bg-emerald-400" : "bg-brand-300 dark:bg-brand-500/50"}`}
                  style={{ height: `${height}px` }}
                  title={`${d.count} từ`}
                />
              </div>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">{WEEKDAY_LABELS[weekday]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
