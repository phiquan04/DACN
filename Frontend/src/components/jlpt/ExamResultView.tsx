import { SubmitAttemptResult, TakeExam } from "../../services/jlptApi";
import FormattedText from "./FormattedText";
import SectionScoreBars from "./SectionScoreBars";

export default function ExamResultView({
  exam,
  result,
  onBack,
  backLabel = "Làm đề khác",
}: {
  exam: TakeExam;
  result: SubmitAttemptResult;
  onBack: () => void;
  backLabel?: string;
}) {
  const questionById = new Map(
    exam.sections.flatMap((s) => s.mondai.flatMap((m) => m.questions.map((q) => [q.id, q] as const)))
  );
  const hasBreakdown = result.is_pass !== null && result.is_pass !== undefined && result.sections.length > 0;
  const isPass = hasBreakdown ? result.is_pass! : result.percent >= 60;

  return (
    <div className="space-y-5">
      <div
        className={`rounded-xl border p-5 text-center shadow-sm ${
          isPass
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
            : "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
        }`}
      >
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Kết quả</p>
        <p
          className={`mt-1 text-3xl font-bold ${
            isPass ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {hasBreakdown ? `${result.total}/${result.total_max}` : `${result.score}/${result.total_questions}`}
          <span className="ml-1 text-lg font-medium text-gray-400 dark:text-gray-500">
            ({result.score}/{result.total_questions} câu đúng)
          </span>
        </p>
        <p className={`mt-1 text-sm font-semibold ${isPass ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
          {isPass ? "Dự kiến đậu" : "Dự kiến rớt"}
          {hasBreakdown ? ` · cần ${result.pass_total} để đậu` : ""}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2 text-sm font-medium text-white hover:from-brand-600 hover:to-brand-700"
        >
          {backLabel}
        </button>
      </div>

      {hasBreakdown && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <SectionScoreBars sections={result.sections} />
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {result.answers.map((a) => {
          const q = questionById.get(a.question_id);
          if (!q) return null;
          const selectedChoice = q.choices.find((c) => c.choice_no === a.selected_choice_no);
          const correctChoice = q.choices.find((c) => c.choice_no === a.correct_no);
          return (
            <div
              key={a.question_id}
              className={`rounded-xl border p-4 shadow-sm ${
                a.is_correct
                  ? "border-emerald-200 bg-white dark:border-emerald-500/30 dark:bg-gray-900"
                  : "border-rose-200 bg-white dark:border-rose-500/30 dark:bg-gray-900"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {q.question_no}. <FormattedText text={q.question_text} />
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    a.is_correct
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                  }`}
                >
                  {a.is_correct ? "Đúng" : "Sai"}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Bạn chọn: <span lang="ja">{selectedChoice?.choice_text ?? "(bỏ trống)"}</span>
              </p>
              {!a.is_correct && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Đáp án đúng: <span lang="ja">{correctChoice?.choice_text}</span>
                </p>
              )}
              {a.explanation && (
                <p className="mt-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {a.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
