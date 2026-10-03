import type { ReviewRating } from "../../services/vocabularyLearningApi";

const OPTIONS: { rating: ReviewRating; label: string; sub: string; className: string }[] = [
  {
    rating: "again",
    label: "Quên hẳn",
    sub: "~10 phút",
    className:
      "border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  },
  {
    rating: "hard",
    label: "Khó",
    sub: "~1 ngày",
    className:
      "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  {
    rating: "good",
    label: "Bình thường",
    sub: "vài ngày",
    className:
      "border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300",
  },
  {
    rating: "easy",
    label: "Dễ",
    sub: "1+ tuần",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
];

export default function RatingButtons({ onRate }: { onRate: (rating: ReviewRating) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {OPTIONS.map((opt) => (
        <button
          key={opt.rating}
          type="button"
          onClick={() => onRate(opt.rating)}
          className={`rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors ${opt.className}`}
        >
          <span className="block">{opt.label}</span>
          <span className="block text-[11px] font-normal opacity-70">{opt.sub}</span>
        </button>
      ))}
    </div>
  );
}
