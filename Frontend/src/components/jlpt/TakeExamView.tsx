import { useEffect, useMemo, useRef, useState } from "react";
import { SECTION_LABELS, TakeExam, TakeMondai, TakeQuestion } from "../../services/jlptApi";
import FormattedText from "./FormattedText";
import { CloseLineIcon, ShootingStarIcon } from "../../icons";

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function QuestionCard({
  q,
  selected,
  marked,
  onSelect,
  onToggleMark,
}: {
  q: TakeQuestion;
  selected?: number;
  marked: boolean;
  onSelect: (choiceNo: number) => void;
  onToggleMark: () => void;
}) {
  return (
    <div id={`jlpt-q-${q.id}`} className="scroll-mt-24 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      {q.passage_text && (
        <p className="mb-2 rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <FormattedText text={q.passage_text} />
        </p>
      )}
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
          {q.question_no}. <FormattedText text={q.question_text} />
        </p>
        <button
          type="button"
          onClick={onToggleMark}
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
            marked
              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
              : "border border-gray-300 text-gray-500 hover:border-gray-400 dark:border-gray-600 dark:text-gray-400"
          }`}
        >
          <ShootingStarIcon className="h-3 w-3" />
          Đánh dấu
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.choices.map((c) => (
          <label
            key={c.choice_no}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
              selected === c.choice_no
                ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
            }`}
          >
            <input
              type="radio"
              name={`q-${q.id}`}
              checked={selected === c.choice_no}
              onChange={() => onSelect(c.choice_no)}
              className="shrink-0 accent-brand-500"
            />
            <span lang="ja" className="text-gray-700 dark:text-gray-200">
              {c.choice_text}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function MondaiGroup({
  mondai,
  answers,
  marked,
  onSelect,
  onToggleMark,
  onlyQuestionId,
}: {
  mondai: TakeMondai;
  answers: Record<number, number>;
  marked: Set<number>;
  onSelect: (questionId: number, choiceNo: number) => void;
  onToggleMark: (questionId: number) => void;
  onlyQuestionId?: number;
}) {
  const questions = onlyQuestionId ? mondai.questions.filter((q) => q.id === onlyQuestionId) : mondai.questions;
  if (questions.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-white dark:text-gray-900">
          問題 {mondai.mondai_no} {mondai.name ? `— ${mondai.name}` : ""}
        </span>
        {mondai.question_count ? (
          <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-gray-600 dark:text-gray-400">
            {mondai.question_count} câu trong đề thi
          </span>
        ) : null}
      </div>
      {mondai.description && (
        <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">{mondai.description}</p>
      )}
      {mondai.tips && (
        <p className="mb-3 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs text-teal-800 dark:bg-teal-500/10 dark:text-teal-300">
          Mẹo: {mondai.tips}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {questions.map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            selected={answers[q.id]}
            marked={marked.has(q.id)}
            onSelect={(choiceNo) => onSelect(q.id, choiceNo)}
            onToggleMark={() => onToggleMark(q.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default function TakeExamView({
  exam,
  onSubmit,
  onCancel,
  submitting,
}: {
  exam: TakeExam;
  onSubmit: (answers: { question_id: number; selected_choice_no: number | null }[], elapsedSeconds: number) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  // When the learner opened the exam — the attempt row is only created on
  // submit, so the time taken has to be measured here and sent along.
  const startedAtRef = useRef(Date.now());
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"one" | "all">("all");
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

  const activeSection = exam.sections[activeSectionIdx];
  const sectionQuestions = useMemo(
    () => activeSection?.mondai.flatMap((m) => m.questions) ?? [],
    [activeSection]
  );

  const [remainingSeconds, setRemainingSeconds] = useState(() => (activeSection?.time_minutes ?? 0) * 60);
  useEffect(() => {
    setRemainingSeconds((activeSection?.time_minutes ?? 0) * 60);
    setActiveQuestionIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionIdx]);
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const id = setInterval(() => setRemainingSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [remainingSeconds]);

  const totalQuestions = exam.sections.reduce(
    (sum, s) => sum + s.mondai.reduce((s2, m) => s2 + m.questions.length, 0),
    0
  );
  const answeredCount = Object.keys(answers).length;
  const answeredInSection = sectionQuestions.filter((q) => answers[q.id] !== undefined).length;
  const unansweredInSection = sectionQuestions.length - answeredInSection;
  const secondsPerQuestion =
    activeSection?.time_minutes && sectionQuestions.length
      ? Math.round((activeSection.time_minutes * 60) / sectionQuestions.length)
      : null;

  const handleSelect = (questionId: number, choiceNo: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceNo }));
  };

  // Keyboard shortcuts only make sense with exactly one question on screen —
  // in "all" view mode there's no single question for 1-4/Space to target.
  useEffect(() => {
    if (viewMode !== "one") return;
    const handler = (e: KeyboardEvent) => {
      // The listener is on window, so it also sees keys typed into unrelated
      // fields (e.g. the floating help assistant's input) — leave those alone.
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const q = sectionQuestions[activeQuestionIdx];
      if (!q) return;
      if (["1", "2", "3", "4"].includes(e.key) && q.choices.some((c) => c.choice_no === Number(e.key))) {
        e.preventDefault();
        handleSelect(q.id, Number(e.key));
      } else if (e.code === "Space") {
        e.preventDefault();
        setActiveQuestionIdx((i) => Math.min(sectionQuestions.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode, activeQuestionIdx, sectionQuestions]);

  const handleToggleMark = (questionId: number) => {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };
  const jumpToQuestion = (questionId: number) => {
    if (viewMode === "one") {
      const idx = sectionQuestions.findIndex((q) => q.id === questionId);
      if (idx >= 0) setActiveQuestionIdx(idx);
    } else {
      document.getElementById(`jlpt-q-${questionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleSubmit = () => {
    const allQuestionIds: number[] = [];
    exam.sections.forEach((s) => s.mondai.forEach((m) => m.questions.forEach((q) => allQuestionIds.push(q.id))));
    onSubmit(
      allQuestionIds.map((id) => ({ question_id: id, selected_choice_no: answers[id] ?? null })),
      Math.round((Date.now() - startedAtRef.current) / 1000)
    );
  };

  const onlyQuestionId = viewMode === "one" ? sectionQuestions[activeQuestionIdx]?.id : undefined;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
            >
              <CloseLineIcon className="h-3.5 w-3.5" />
              Thoát
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  {exam.level}
                </span>
                <h2 lang="ja" className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  {exam.title}
                </h2>
                <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-gray-600 dark:text-gray-400">
                  Thi thử đúng giờ
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Tiến độ: {answeredCount}/{totalQuestions} câu
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p
                className={`text-lg font-bold tabular-nums ${
                  remainingSeconds > 0 && remainingSeconds < 300
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-gray-800 dark:text-white/90"
                }`}
              >
                {/* A section with no time set (JLPT doesn't publish one for
                    every part) has nothing to count down — a frozen 00:00
                    would read as "time's up". */}
                {activeSection?.time_minutes ? formatClock(remainingSeconds) : "—"}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {activeSection?.time_minutes ? "còn lại" : "không giới hạn"} · Phần {activeSectionIdx + 1}/
                {exam.sections.length}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2 text-sm font-medium text-white hover:from-brand-600 hover:to-brand-700 disabled:opacity-60"
            >
              {submitting ? "Đang nộp bài..." : "Nộp bài"}
            </button>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width]"
            style={{ width: `${totalQuestions ? (answeredCount / totalQuestions) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {exam.sections.map((s, idx) => {
          const total = s.mondai.reduce((sum, m) => sum + m.questions.length, 0);
          const done = s.mondai
            .flatMap((m) => m.questions)
            .filter((q) => answers[q.id] !== undefined).length;
          return (
            <button
              key={s.section_type}
              type="button"
              onClick={() => setActiveSectionIdx(idx)}
              className={`rounded-lg px-3.5 py-2 text-left text-xs transition-colors ${
                idx === activeSectionIdx
                  ? "bg-brand-100 font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200"
                  : "text-gray-500 hover:bg-brand-50 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              <span className="block">{SECTION_LABELS[s.section_type]}</span>
              <span className="block text-[11px] opacity-80">
                {done}/{total} câu mẫu
              </span>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1 self-center rounded-lg border border-gray-200 p-0.5 text-xs dark:border-gray-700">
          {(["all", "one"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                viewMode === mode
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {mode === "all" ? "Cả phần thi" : "Từng câu hỏi"}
            </button>
          ))}
        </div>
      </div>

      {activeSection && (
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {SECTION_LABELS[activeSection.section_type]}
                {activeSection.time_minutes ? ` · ${activeSection.time_minutes} phút` : ""} · đã trả lời{" "}
                {answeredInSection}/{sectionQuestions.length} câu mẫu
              </h3>
              {viewMode === "one" && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Phím tắt: 1-4 chọn đáp án | Space câu kế
                </p>
              )}
            </div>
            {activeSection.mondai.map((mondai) => (
              <MondaiGroup
                key={mondai.mondai_no}
                mondai={mondai}
                answers={answers}
                marked={marked}
                onSelect={handleSelect}
                onToggleMark={handleToggleMark}
                onlyQuestionId={onlyQuestionId}
              />
            ))}
            {viewMode === "one" && sectionQuestions.length > 0 && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveQuestionIdx((i) => Math.max(0, i - 1))}
                  disabled={activeQuestionIdx === 0}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  ← Câu trước
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Câu {activeQuestionIdx + 1}/{sectionQuestions.length}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveQuestionIdx((i) => Math.min(sectionQuestions.length - 1, i + 1))}
                  disabled={activeQuestionIdx === sectionQuestions.length - 1}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                  Câu sau →
                </button>
              </div>
            )}
          </div>

          <div className="h-fit rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:sticky lg:top-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Bảng câu hỏi</h4>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {answeredInSection}/{sectionQuestions.length}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand-100 dark:bg-brand-500/30" /> Đã trả lời
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-100 dark:bg-amber-500/30" /> Đánh dấu
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm border border-gray-300 dark:border-gray-600" /> Chưa làm
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2.5">
              {activeSection.mondai.map((m) => (
                <div key={m.mondai_no}>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    問題{m.mondai_no}
                    {m.name ? ` — ${m.name}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.questions.map((q) => {
                      const isAnswered = answers[q.id] !== undefined;
                      const isMarked = marked.has(q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => jumpToQuestion(q.id)}
                          className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                            isMarked
                              ? "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300"
                              : isAnswered
                              ? "border-brand-300 bg-brand-100 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/20 dark:text-brand-200"
                              : "border-gray-300 text-gray-500 hover:border-gray-400 dark:border-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {q.question_no}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Còn <span className="font-semibold text-gray-700 dark:text-gray-300">{unansweredInSection} câu</span>{" "}
              chưa trả lời trong phần này.
            </p>
            {secondsPerQuestion && (
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                Tốc độ khuyến nghị: ~{secondsPerQuestion} giây/câu ({sectionQuestions.length} câu trong{" "}
                {activeSection.time_minutes} phút).
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
