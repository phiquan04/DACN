import { useMemo, useState } from "react";
import { ChevronLeftIcon } from "../../icons";
import { VocabularySetProgress } from "../../services/vocabularyLearningApi";
import ProgressBar from "./ProgressBar";

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

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("ALL")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              category === "ALL"
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "border border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
            }`}
          >
            Tất cả danh mục
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                category === c
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "border border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {filteredSets.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-500 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  {s.level}
                </span>
                <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{s.set_name}</span>
                {s.category_name && (
                  <span className="shrink-0 rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
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
            </div>
            <button
              type="button"
              onClick={() => onSelectSet(s)}
              className="shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600"
            >
              Tiếp tục học
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
