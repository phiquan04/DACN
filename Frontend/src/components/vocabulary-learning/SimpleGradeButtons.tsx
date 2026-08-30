import type { ReviewRating } from "../../services/vocabularyLearningApi";

export default function SimpleGradeButtons({
  onGrade,
  rememberedLabel = "Nhớ rồi",
  forgotLabel = "Chưa nhớ",
}: {
  onGrade: (rating: ReviewRating) => void;
  rememberedLabel?: string;
  forgotLabel?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button
        type="button"
        onClick={() => onGrade("again")}
        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-600 hover:border-rose-300 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
      >
        {forgotLabel}
      </button>
      <button
        type="button"
        // These modes only offer a binary "nhớ / chưa nhớ" choice, so a
        // remembered answer should count as mastered right away — map it to
        // the SM-2 "easy" rating (immediate long interval) rather than
        // "good" (which needs several repeat reviews before it counts as
        // learned) so it matches the "đã thuộc" bucket shown in the summary.
        onClick={() => onGrade("easy")}
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 hover:border-emerald-300 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      >
        {rememberedLabel}
      </button>
    </div>
  );
}
