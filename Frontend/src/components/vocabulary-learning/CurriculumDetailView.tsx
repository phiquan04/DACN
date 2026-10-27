import { useMemo, useState } from "react";
import { BoxIconLine, CheckCircleIcon, ChevronLeftIcon, ListIcon, TaskIcon } from "../../icons";
import { VocabularySetProgress } from "../../services/vocabularyLearningApi";
import ProgressBar from "./ProgressBar";

/** A set counts as "in progress" once more than 1% of its items have been touched (learned or reviewing). */
function isInProgress(s: VocabularySetProgress): boolean {
  if (s.item_count <= 0) return false;
  return ((s.learned_count + s.reviewing_count) / s.item_count) * 100 > 1;
}

/** A set has been studied before once any of its words has progress (learned or
 * reviewing) — unlike `isInProgress`, no 1% threshold: a single studied word is
 * enough for the button to say "continue" rather than "start". */
function hasStarted(s: VocabularySetProgress): boolean {
  return s.learned_count + s.reviewing_count > 0;
}

export default function CurriculumDetailView({
  curriculumName,
  sets,
  onSelectSet,
  onBack,
}: {
  curriculumName: string;
  sets: VocabularySetProgress[];
  onSelectSet: (set: VocabularySetProgress) => void;
  onBack: () => void;
}) {
  const [category, setCategory] = useState<string | "ALL">("ALL");

  const categories = useMemo(
    () => Array.from(new Set(sets.map((s) => s.category_name).filter((c): c is string => Boolean(c)))),
    [sets]
  );
  const filteredSets = category === "ALL" ? sets : sets.filter((s) => s.category_name === category);

  const setsInProgress = useMemo(() => sets.filter(isInProgress).length, [sets]);
  const totalLearnedWords = useMemo(() => sets.reduce((acc, s) => acc + s.learned_count, 0), [sets]);
  const totalReviewingWords = useMemo(() => sets.reduce((acc, s) => acc + s.reviewing_count, 0), [sets]);
  const totalTouchedWords = totalLearnedWords + totalReviewingWords;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Quay lại thư viện
      </button>

      <h2 className="text-xl font-bold text-gray-800 dark:text-white/90">{curriculumName}</h2>

      {/* Category filter sits above the split so the lesson list and the summary column start at the same height. */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("ALL")}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
              category === "ALL"
                ? "bg-brand-500 text-white"
                : "border border-gray-300 text-gray-600 hover:border-teal-400 dark:border-gray-600 dark:text-gray-300"
            }`}
          >
            Tất cả danh mục
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                category === c
                  ? "bg-brand-500 text-white"
                  : "border border-gray-300 text-gray-600 hover:border-teal-400 dark:border-gray-600 dark:text-gray-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ===== LEFT: all lessons ===== */}
        <div className="flex flex-col gap-2.5 lg:col-span-2">
          {filteredSets.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-500 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-lg bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                    {s.level}
                  </span>
                  <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{s.set_name}</span>
                  {s.category_name && (
                    <span className="shrink-0 rounded-lg border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      {s.category_name}
                    </span>
                  )}
                </div>
                {s.description && <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{s.description}</p>}
                <div className="mt-2 flex max-w-xs items-center gap-2">
                  <div className="flex-1">
                    <ProgressBar learned={s.learned_count} reviewing={s.reviewing_count} total={s.item_count} />
                  </div>
                  <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{s.item_count} từ</span>
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {s.learned_count} thuộc
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {s.reviewing_count} cần ôn
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />{" "}
                    {Math.max(0, s.item_count - s.learned_count - s.reviewing_count)} mới
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectSet(s)}
                className="shrink-0 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-xs font-medium text-white hover:from-brand-600 hover:to-brand-700"
              >
                {hasStarted(s) ? "Tiếp tục học" : "Bắt đầu học"}
              </button>
            </div>
          ))}
        </div>

        {/* ===== RIGHT: curriculum summary ===== */}
        <div className="space-y-5">
          {/* Hero stat — the headline number, in the system's brand color */}
          <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <BoxIconLine className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold">Tổng kết bộ giáo trình</h3>
            </div>
            <p className="text-4xl font-bold">{setsInProgress}</p>
            <p className="mt-1 text-sm text-white/80">bộ đã học trong giáo trình đã chọn</p>
          </div>

          {/* Word counts — total studied, then split into mastered vs. needs review */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <ListIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Tổng số từ đã học</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">{totalTouchedWords} từ</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircleIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Đã thuộc</span>
              </div>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">{totalLearnedWords} từ</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <TaskIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Cần ôn</span>
              </div>
              <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-300">{totalReviewingWords} từ</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Chú thích tiến độ</h3>
            <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                Đã thuộc
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" />
                Cần ôn
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                Từ mới
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
