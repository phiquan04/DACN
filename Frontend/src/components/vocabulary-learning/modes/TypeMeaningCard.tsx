import { useState } from "react";
import type { ReviewRating, VocabularyLearningItem } from "../../../services/vocabularyLearningApi";
import BookmarkToggle from "../BookmarkToggle";
import SimpleGradeButtons from "../SimpleGradeButtons";

const PUNCTUATION = /[.,!?;:()"'“”]/g;

function normalize(s: string): string {
  return s.toLowerCase().replace(PUNCTUATION, "").replace(/\s+/g, " ").trim();
}

/** Loose fuzzy check — meaning_vi is free-form Vietnamese text, so an exact
 * match would reject perfectly good paraphrases; this only needs to catch
 * obviously-wrong answers, the final call is still the user's own grade. */
function looksCorrect(input: string, meaning: string): boolean {
  const a = normalize(input);
  const b = normalize(meaning);
  if (!a) return false;
  if (b.includes(a) || a.includes(b)) return true;
  const aWords = new Set(a.split(/\s+/).filter(Boolean));
  const bWords = b.split(/\s+/).filter(Boolean);
  if (bWords.length === 0) return false;
  const overlap = bWords.filter((w) => aWords.has(w)).length;
  return overlap / bWords.length >= 0.5;
}

export default function TypeMeaningCard({
  item,
  onGrade,
  onToggleBookmark,
}: {
  item: VocabularyLearningItem;
  onGrade: (rating: ReviewRating) => void;
  onToggleBookmark: () => void;
}) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState<boolean | null>(null);

  const check = () => setChecked(looksCorrect(value, item.meaning_vi));

  return (
    <div className="space-y-4">
      <div className="relative flex h-96 w-full flex-col items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <BookmarkToggle active={item.is_bookmarked} onToggle={onToggleBookmark} />
        <span lang="ja" className="text-4xl font-bold text-gray-800 dark:text-white/90">
          {item.word}
        </span>
        {item.reading && (
          <span lang="ja" className="text-base text-gray-500 dark:text-gray-400">
            {item.reading}
          </span>
        )}

        <input
          type="text"
          value={value}
          disabled={checked !== null}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && checked === null && check()}
          placeholder="Gõ nghĩa tiếng Việt..."
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-center text-sm text-gray-700 outline-none focus:border-brand-500 disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 disabled:dark:bg-gray-800"
        />

        {checked !== null && (
          <div className={`text-sm font-medium ${checked ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
            {checked ? "Chính xác!" : "Chưa đúng."} Đáp án: {item.meaning_vi}
          </div>
        )}
      </div>

      {checked === null ? (
        <button
          type="button"
          onClick={check}
          disabled={!value.trim()}
          className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-200"
        >
          Kiểm tra
        </button>
      ) : (
        <SimpleGradeButtons onGrade={onGrade} rememberedLabel="Tiếp tục" forgotLabel="Cần ôn lại" />
      )}
    </div>
  );
}
