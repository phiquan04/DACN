import { useEffect, useState } from "react";
import { AudioIcon } from "../../../icons";
import { speakJapanese } from "../../../services/vocabularyLearningApi";
import type { ReviewRating, VocabularyLearningItem } from "../../../services/vocabularyLearningApi";
import BookmarkToggle from "../BookmarkToggle";
import SimpleGradeButtons from "../SimpleGradeButtons";

export default function ListenGuessCard({
  item,
  onGrade,
  onToggleBookmark,
}: {
  item: VocabularyLearningItem;
  onGrade: (rating: ReviewRating) => void;
  onToggleBookmark: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    setPlaying(true);
    speakJapanese(item.word)
      .catch(() => {})
      .finally(() => setPlaying(false));
  };

  useEffect(() => {
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <div className="space-y-4">
      <div className="relative flex h-96 w-full flex-col items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <BookmarkToggle active={item.is_bookmarked} onToggle={onToggleBookmark} />
        <button
          type="button"
          onClick={play}
          disabled={playing}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-teal-600 text-white transition hover:from-teal-600 hover:to-teal-700 disabled:opacity-60"
        >
          <AudioIcon className="h-7 w-7" />
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500">Nghe và đoán nghĩa của từ trước khi lộ đáp án</p>

        {revealed && (
          <div className="space-y-1">
            <p lang="ja" className="text-2xl font-bold text-gray-800 dark:text-white/90">
              {item.word}
              {item.reading && (
                <span className="ml-2 text-base font-normal text-gray-500 dark:text-gray-400">{item.reading}</span>
              )}
            </p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{item.meaning_vi}</p>
            {item.example_sentence_ja && (
              <p lang="ja" className="text-sm text-gray-600 dark:text-gray-300">
                {item.example_sentence_ja}
              </p>
            )}
          </div>
        )}
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
        >
          Lộ đáp án
        </button>
      ) : (
        <SimpleGradeButtons onGrade={onGrade} />
      )}
    </div>
  );
}
