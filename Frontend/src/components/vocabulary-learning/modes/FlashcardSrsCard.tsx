import { useState } from "react";
import { AudioIcon } from "../../../icons";
import type { ReviewRating, VocabularyLearningItem } from "../../../services/vocabularyLearningApi";
import { speakJapanese } from "../../../services/vocabularyLearningApi";
import BookmarkToggle from "../BookmarkToggle";
import FlipCard from "../FlipCard";
import RatingButtons from "../RatingButtons";

export default function FlashcardSrsCard({
  item,
  onGrade,
  onToggleBookmark,
}: {
  item: VocabularyLearningItem;
  onGrade: (rating: ReviewRating) => void;
  onToggleBookmark: () => void;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="space-y-4">
      <div className="relative">
        <BookmarkToggle active={item.is_bookmarked} onToggle={onToggleBookmark} />
        <FlipCard
          flipped={flipped}
          onClick={() => setFlipped((f) => !f)}
          front={
            <>
              <span lang="ja" className="text-4xl font-bold text-gray-800 dark:text-white/90">
                {item.word}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  speakJapanese(item.word).catch(() => {});
                }}
                className="mt-2 flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:border-teal-500 hover:text-teal-600 dark:border-gray-700 dark:text-gray-400"
              >
                <AudioIcon className="h-4 w-4" />
                Nghe
              </button>
              <span className="mt-4 text-xs text-gray-400 dark:text-gray-500">Bấm để xem đáp án</span>
            </>
          }
          back={
            <>
              {item.reading && (
                <span lang="ja" className="text-lg text-gray-500 dark:text-gray-400">
                  {item.reading}
                </span>
              )}
              {item.han_viet && (
                <span className="text-sm font-medium text-teal-600 dark:text-teal-400">{item.han_viet}</span>
              )}
              <span className="text-xl font-semibold text-gray-800 dark:text-white/90">{item.meaning_vi}</span>
              {item.example_sentence_ja && (
                <div className="mt-2 max-w-full">
                  <p lang="ja" className="text-sm text-gray-600 dark:text-gray-300">
                    {item.example_sentence_ja}
                  </p>
                  {item.example_sentence_vi && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.example_sentence_vi}</p>
                  )}
                </div>
              )}
            </>
          }
        />
      </div>

      {flipped ? (
        <RatingButtons onRate={onGrade} />
      ) : (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Hãy nhớ lại nghĩa của từ trước khi lật thẻ.
        </p>
      )}
    </div>
  );
}
