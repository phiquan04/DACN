import { useState } from "react";
import { PublishedExamSummary } from "../../services/jlptApi";
import { RefreshIcon } from "../../icons/custom";
import ExamInfoModal from "./ExamInfoModal";

const EXCELLENT_PERCENT = 90;

export default function ExamBrowseList({
  exams,
  loading,
  recommendedExamId,
  onStart,
  onViewHistory,
}: {
  exams: PublishedExamSummary[];
  loading: boolean;
  recommendedExamId: number | null;
  onStart: (examId: number) => void;
  onViewHistory: () => void;
}) {
  const [infoExam, setInfoExam] = useState<PublishedExamSummary | null>(null);

  return (
    <div className="flex flex-col gap-2.5">
      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
      {!loading && exams.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Không tìm thấy đề thi nào phù hợp với bộ lọc.</p>
      )}
      {exams.map((exam) => {
        const isRecommended = exam.id === recommendedExamId;
        const isExcellent =
          exam.attempt_count > 0 &&
          !!exam.best_total &&
          ((exam.best_score ?? 0) / exam.best_total) * 100 >= EXCELLENT_PERCENT;

        return (
          <div
            key={exam.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-sm dark:bg-gray-900 ${
              isRecommended
                ? "border-brand-300 ring-1 ring-brand-200 dark:border-brand-500/50 dark:ring-brand-500/20"
                : "border-gray-200 hover:border-teal-500 dark:border-gray-700"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  {exam.level}
                </span>
                <span lang="ja" className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                  {exam.title}
                </span>
                {isRecommended && (
                  <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                    Đề xuất theo mục tiêu
                  </span>
                )}
                {isExcellent && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    Hoàn thành xuất sắc
                  </span>
                )}
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
                onClick={() => setInfoExam(exam)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
              >
                Thông tin đề
              </button>
              <button
                type="button"
                onClick={() => onStart(exam.id)}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-xs font-medium text-white hover:from-brand-600 hover:to-brand-700"
              >
                {exam.attempt_count > 0 && <RefreshIcon className="h-3 w-3" />}
                {exam.attempt_count > 0 ? "Làm lại" : "Bắt đầu"}
              </button>
            </div>
          </div>
        );
      })}

      {infoExam && (
        <ExamInfoModal
          exam={infoExam}
          onClose={() => setInfoExam(null)}
          onStart={(id) => {
            setInfoExam(null);
            onStart(id);
          }}
          onViewHistory={() => {
            setInfoExam(null);
            onViewHistory();
          }}
        />
      )}
    </div>
  );
}
