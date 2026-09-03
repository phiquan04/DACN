import { useState } from "react";
import { JLPT_LEVELS, JlptLevel, PublishedExamSummary } from "../../services/jlptApi";
import ExamStructureModal from "./ExamStructureModal";

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
  const [structureLevel, setStructureLevel] = useState<JlptLevel | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        {!loading && <span className="text-xs text-gray-400 dark:text-gray-500">{exams.length} đề</span>}
      </div>

      <div className="flex flex-col gap-2.5">
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
        {!loading && exams.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có đề thi nào ở cấp độ này.</p>
        )}
        {exams.map((exam) => (
          <div
            key={exam.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-500 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
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
                {exam.total_time_minutes ? ` · ${exam.total_time_minutes} phút` : ""}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                {exam.attempt_count > 0 ? (
                  <>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      {exam.best_score}/{exam.best_total}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      điểm cao nhất · {exam.attempt_count} lượt
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">Chưa làm lần nào</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStructureLevel(exam.level as JlptLevel)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
              >
                Xem cấu trúc
              </button>
              <button
                type="button"
                onClick={() => onStart(exam.id)}
                className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-xs font-medium text-white hover:from-brand-600 hover:to-brand-700"
              >
                Bắt đầu
              </button>
            </div>
          </div>
        ))}
      </div>

      {structureLevel && <ExamStructureModal level={structureLevel} onClose={() => setStructureLevel(null)} />}
    </div>
  );
}
