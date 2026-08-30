import { useState } from "react";
import type { ReviewRating, VocabularyLearningItem } from "../../../services/vocabularyLearningApi";
import BookmarkToggle from "../BookmarkToggle";
import FlipCard from "../FlipCard";
import SimpleGradeButtons from "../SimpleGradeButtons";

export default function HanVietHintCard({
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
            item.han_viet ? (
              <>
                <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Âm Hán Việt</span>
                <span className="text-3xl font-bold text-teal-600 dark:text-teal-400">{item.han_viet}</span>
                <span className="mt-4 text-xs text-gray-400 dark:text-gray-500">Đoán nghĩa rồi bấm để xem đáp án</span>
              </>
            ) : (
              <>
                <span lang="ja" className="text-4xl font-bold text-gray-800 dark:text-white/90">
                  {item.word}
                </span>
                <span className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                  Từ này chưa có âm Hán Việt — đoán nghĩa rồi bấm để xem đáp án
                </span>
              </>
            )
          }
          back={
            <>
              <span lang="ja" className="text-2xl font-bold text-gray-800 dark:text-white/90">
                {item.word}
              </span>
              {item.reading && (
                <span lang="ja" className="text-base text-gray-500 dark:text-gray-400">
                  {item.reading}
                </span>
              )}
              <span className="text-lg font-semibold text-gray-800 dark:text-white/90">{item.meaning_vi}</span>
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
        <SimpleGradeButtons onGrade={onGrade} />
      ) : (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          Liên tưởng âm Hán Việt để đoán nghĩa trước khi lật thẻ.
        </p>
      )}
    </div>
  );
}
