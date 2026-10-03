import { useState } from "react";
import type { ReviewRating, VocabularyLearningItem } from "../../../services/vocabularyLearningApi";
import BookmarkToggle from "../BookmarkToggle";
import SimpleGradeButtons from "../SimpleGradeButtons";

function buildBlanked(sentence: string, word: string): string | null {
  if (!sentence.includes(word)) return null;
  return sentence.replace(word, "＿＿＿");
}

export default function FillBlankCard({
  item,
  onGrade,
  onToggleBookmark,
}: {
  item: VocabularyLearningItem;
  onGrade: (rating: ReviewRating) => void;
  onToggleBookmark: () => void;
}) {
  const blanked = item.example_sentence_ja ? buildBlanked(item.example_sentence_ja, item.word) : null;
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState<boolean | null>(null);

  const check = () => setChecked(value.trim() === item.word || value.trim() === item.reading);

  if (!blanked) {
    return (
      <div className="space-y-4">
        <div className="relative flex h-96 w-full flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <BookmarkToggle active={item.is_bookmarked} onToggle={onToggleBookmark} />
          <p className="text-xs text-gray-400 dark:text-gray-500">Từ này chưa có câu ví dụ phù hợp để điền khuyết</p>
          <span lang="ja" className="text-3xl font-bold text-gray-800 dark:text-white/90">
            {item.word}
          </span>
          {item.reading && (
            <span lang="ja" className="text-base text-gray-500 dark:text-gray-400">
              {item.reading}
            </span>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">{item.meaning_vi}</span>
        </div>
        <SimpleGradeButtons onGrade={onGrade} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative flex h-96 w-full flex-col items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <BookmarkToggle active={item.is_bookmarked} onToggle={onToggleBookmark} />
        <p lang="ja" className="text-lg text-gray-800 dark:text-white/90">
          {blanked}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{item.meaning_vi}</p>

        <input
          type="text"
          value={value}
          disabled={checked !== null}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && checked === null && check()}
          placeholder="Điền từ còn thiếu..."
          lang="ja"
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-center text-sm outline-none focus:border-brand-500 disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 disabled:dark:bg-gray-800"
        />

        {checked !== null && (
          <div className={`text-sm font-medium ${checked ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
            {checked ? "Chính xác!" : `Đáp án: ${item.word}`}
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
