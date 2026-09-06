import { AttemptHistoryItem, JlptLevel, LevelAverage } from "../../services/jlptApi";
import { PERCENT_BADGE_CLASSES, percentTone } from "./scoreColor";
import { formatDateTime } from "./dateFormat";

export default function AttemptHistoryList({
  level,
  attempts,
  averages,
  loading,
}: {
  level: JlptLevel | "ALL";
  attempts: AttemptHistoryItem[];
  averages: LevelAverage[];
  loading: boolean;
}) {
  const visible = level === "ALL" ? attempts : attempts.filter((a) => a.level === level);

  return (
    <div className="flex flex-col gap-4">
      {averages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {averages.map((a) => (
            <div
              key={a.level}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900"
            >
              <span className="font-semibold text-gray-700 dark:text-gray-200">{a.level}</span>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className="text-gray-500 dark:text-gray-400">TB {a.average_percent}%</span>
              <span className="text-gray-400 dark:text-gray-500">({a.attempt_count} lượt)</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
        {!loading && visible.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bạn chưa làm đề nào{level !== "ALL" ? ` ở cấp độ ${level}` : ""}.
          </p>
        )}
        {visible.map((a) => {
          const tone = percentTone(a.percent);
          return (
            <div
              key={a.attempt_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                    {a.level}
                  </span>
                  <span
                    lang="ja"
                    className="truncate text-sm font-semibold text-gray-800 dark:text-white/90"
                    title={a.exam_title}
                  >
                    {a.exam_title}
                  </span>
                  {a.is_pass != null && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        a.is_pass
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                      }`}
                    >
                      {a.is_pass ? "Đạt chuẩn" : "Chưa đạt"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDateTime(a.submitted_at)}</p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  {a.score}/{a.total_questions}
                </p>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PERCENT_BADGE_CLASSES[tone]}`}>
                  {a.percent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
