import { JLPT_LEVELS, JlptLevel, PublishedExamSummary } from "../../services/jlptApi";

export default function ExamBrowseList({
  exams,
  loading,
  level,
  onLevelChange,
  onStart,
}: {
  exams: PublishedExamSummary[];
  loading: boolean;
  level: JlptLevel | "ALL";
  onLevelChange: (level: JlptLevel | "ALL") => void;
  onStart: (examId: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onLevelChange("ALL")}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            level === "ALL"
              ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
              : "border border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
          }`}
        >
          Tất cả
        </button>
        {JLPT_LEVELS.map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => onLevelChange(lv)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              level === lv
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "border border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
            }`}
          >
            {lv}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
        {!loading && exams.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có đề thi nào ở cấp độ này.</p>
        )}
        {exams.map((exam) => (
          <div
            key={exam.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-500 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  {exam.level}
                </span>
                <span lang="ja" className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                  {exam.title}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {exam.question_count} câu
                {exam.total_time_minutes ? ` · khoảng ${exam.total_time_minutes} phút` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onStart(exam.id)}
              className="shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600"
            >
              Bắt đầu làm bài
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
