import { AttemptHistoryItem, LevelAverage } from "../../services/jlptApi";

export default function AttemptHistoryPanel({
  averages,
  history,
}: {
  averages: LevelAverage[];
  history: AttemptHistoryItem[];
}) {
  if (averages.length === 0 && history.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {averages.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Điểm trung bình theo level
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {averages.map((a) => (
              <div
                key={a.level}
                className="flex min-w-[92px] flex-col items-center rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{a.level}</span>
                <span className="text-lg font-bold text-brand-600 dark:text-brand-300">
                  {a.average_percent}%
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{a.attempt_count} lượt</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Lịch sử làm bài gần đây</h3>
          <div className="flex flex-col gap-2">
            {history.slice(0, 5).map((h) => (
              <div key={h.attempt_id} className="flex items-center justify-between text-xs">
                <span lang="ja" className="truncate text-gray-700 dark:text-gray-300">
                  {h.exam_title}
                </span>
                <span
                  className={`ml-2 shrink-0 font-semibold ${
                    h.percent >= 60 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {h.score}/{h.total_questions} ({h.percent}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
