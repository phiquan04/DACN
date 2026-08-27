import { useState } from "react";
import { SECTION_LABELS, TakeExam } from "../../services/jlptApi";
import FormattedText from "./FormattedText";

export default function TakeExamView({
  exam,
  onSubmit,
  onCancel,
  submitting,
}: {
  exam: TakeExam;
  onSubmit: (answers: { question_id: number; selected_choice_no: number | null }[]) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const totalQuestions = exam.sections.reduce(
    (sum, s) => sum + s.mondai.reduce((s2, m) => s2 + m.questions.length, 0),
    0
  );
  const answeredCount = Object.keys(answers).length;

  const handleSubmit = () => {
    const allQuestionIds: number[] = [];
    exam.sections.forEach((s) => s.mondai.forEach((m) => m.questions.forEach((q) => allQuestionIds.push(q.id))));
    onSubmit(
      allQuestionIds.map((id) => ({ question_id: id, selected_choice_no: answers[id] ?? null }))
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div>
          <h2 lang="ja" className="text-base font-semibold text-gray-800 dark:text-white/90">
            {exam.title}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {exam.level}
            {exam.total_time_minutes ? ` · ${exam.total_time_minutes} phút` : ""} · Đã trả lời {answeredCount}/
            {totalQuestions} câu
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
        >
          Thoát
        </button>
      </div>

      {exam.sections.map((section) => (
        <div key={section.section_type} className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {SECTION_LABELS[section.section_type]} — {section.name}
          </h3>
          {section.mondai.map((mondai) => (
            <div
              key={mondai.mondai_no}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="mb-3">
                <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-white dark:text-gray-900">
                  問題 {mondai.mondai_no} {mondai.name ? `— ${mondai.name}` : ""}
                </span>
                {mondai.description && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{mondai.description}</p>
                )}
                {mondai.tips && (
                  <p className="mt-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    Mẹo: {mondai.tips}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {mondai.questions.map((q) => (
                  <div key={q.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    {q.passage_text && (
                      <p className="mb-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        <FormattedText text={q.passage_text} />
                      </p>
                    )}
                    <p className="mb-2 text-sm font-medium text-gray-800 dark:text-white/90">
                      {q.question_no}. <FormattedText text={q.question_text} />
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {q.choices.map((c) => (
                        <label
                          key={c.choice_no}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
                            answers[q.id] === c.choice_no
                              ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                              : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={answers[q.id] === c.choice_no}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: c.choice_no }))}
                            className="shrink-0 accent-brand-500"
                          />
                          <span lang="ja" className="text-gray-700 dark:text-gray-200">
                            {c.choice_text}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? "Đang nộp bài..." : "Nộp bài"}
        </button>
      </div>
    </div>
  );
}
