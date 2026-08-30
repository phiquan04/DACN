import { useEffect, useState } from "react";
import { generateMiniStory } from "../../../services/vocabularyLearningApi";
import type { MiniStoryResult, ReviewRating, VocabularyLearningItem } from "../../../services/vocabularyLearningApi";

export default function MiniStoryPanel({
  items,
  onGradeItem,
  onFinish,
}: {
  items: VocabularyLearningItem[];
  onGradeItem: (itemId: number, rating: ReviewRating) => void;
  onFinish: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [story, setStory] = useState<MiniStoryResult | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    generateMiniStory(items.map((i) => i.id))
      .then(setStory)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFinish = () => {
    items.forEach((i) => onGradeItem(i.id, "good"));
    onFinish();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span
            key={i.id}
            lang="ja"
            className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-700 dark:bg-teal-500/20 dark:text-teal-300"
          >
            {i.word}
          </span>
        ))}
      </div>

      <div className="min-h-[220px] rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">AI đang soạn đoạn văn...</p>}
        {!loading && error && (
          <p className="text-sm text-rose-500">Không thể tạo đoạn văn lúc này, vui lòng thử lại sau.</p>
        )}
        {!loading && story && (
          <div className="space-y-3">
            <p lang="ja" className="text-base leading-relaxed text-gray-800 dark:text-white/90">
              {story.story_ja}
            </p>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{story.story_vi}</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleFinish}
        disabled={loading}
        className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Đã đọc xong, đánh dấu đã ôn tất cả
      </button>
    </div>
  );
}
