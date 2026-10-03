import { Link } from "react-router";
import { AttemptHistoryItem } from "../../services/jlptApi";
import { formatShortDate } from "../jlpt/dateFormat";
import { PERCENT_BADGE_CLASSES, percentTone } from "../jlpt/scoreColor";
import { HistoryIcon, ArrowRightIcon } from "../../icons/custom";

export default function RecentTestResultsCard({
  attempts,
  loading,
}: {
  attempts: AttemptHistoryItem[];
  loading: boolean;
}) {
  const recent = attempts.slice(0, 3);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90">
          <HistoryIcon className="h-4 w-4 text-brand-500" /> Lịch sử thi thử
        </h4>
        <Link
          to="/jlpt-practice"
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          Xem tất cả <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>
      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Kết quả gần đây</p>

      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Bạn chưa làm đề thi thử nào.</p>
        ) : (
          recent.map((a) => {
            const tone = percentTone(a.percent);
            return (
              <div key={a.attempt_id} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                  {a.level[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200" title={a.exam_title}>
                    {a.exam_title}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {a.submitted_at ? formatShortDate(a.submitted_at) : "—"}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${PERCENT_BADGE_CLASSES[tone]}`}>
                  {a.score}/{a.total_questions}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
