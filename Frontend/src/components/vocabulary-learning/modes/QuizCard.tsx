import { useMemo, useState } from "react";
import type { ReviewRating, VocabularyLearningItem } from "../../../services/vocabularyLearningApi";
import BookmarkToggle from "../BookmarkToggle";

const CHOICE_COUNT = 4;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Picks up to CHOICE_COUNT-1 distractors from the rest of the session batch,
 * deduping by meaning text so two choices never read the same. */
function pickChoices(item: VocabularyLearningItem, pool: VocabularyLearningItem[]): VocabularyLearningItem[] {
  const seenMeanings = new Set([item.meaning_vi]);
  const distractors: VocabularyLearningItem[] = [];
  for (const candidate of shuffle(pool.filter((p) => p.id !== item.id))) {
    if (distractors.length >= CHOICE_COUNT - 1) break;
    if (seenMeanings.has(candidate.meaning_vi)) continue;
    seenMeanings.add(candidate.meaning_vi);
    distractors.push(candidate);
  }
  return shuffle([item, ...distractors]);
}

export default function QuizCard({
  item,
  pool,
  onGrade,
  onToggleBookmark,
}: {
  item: VocabularyLearningItem;
  pool: VocabularyLearningItem[];
  onGrade: (rating: ReviewRating) => void;
  onToggleBookmark: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const choices = useMemo(() => pickChoices(item, pool), [item, pool]);

  const isAnswered = selectedId !== null;
  const isCorrect = selectedId === item.id;

  return (
    <div className="space-y-4">
      <div className="relative flex min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <BookmarkToggle active={item.is_bookmarked} onToggle={onToggleBookmark} />
        <span lang="ja" className="text-3xl font-bold text-gray-800 dark:text-white/90">
          {item.word}
        </span>
        {item.reading && (
          <span lang="ja" className="text-base text-gray-500 dark:text-gray-400">
            {item.reading}
          </span>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500">Chọn nghĩa đúng của từ này</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {choices.map((choice) => {
          const isThisCorrect = choice.id === item.id;
          const isThisSelected = choice.id === selectedId;
          let className =
            "border-gray-200 bg-white text-gray-700 hover:border-teal-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";
          if (isAnswered && isThisCorrect) {
            className =
              "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300";
          } else if (isAnswered && isThisSelected) {
            className =
              "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300";
          }
          return (
            <button
              key={choice.id}
              type="button"
              lang="vi"
              disabled={isAnswered}
              onClick={() => setSelectedId(choice.id)}
              className={`rounded-xl border p-3 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed ${className}`}
            >
              {choice.meaning_vi}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <button
          type="button"
          onClick={() => onGrade(isCorrect ? "good" : "again")}
          className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          Tiếp tục
        </button>
      )}
    </div>
  );
}
