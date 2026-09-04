import type { GrammarErrorExplanation } from "../../../services/grammarApi";
import { ArrowRightIcon } from "../../../icons/custom";

/** Renders the per-error explanation the LLM generated for a grammar correction (why it was wrong, why it was fixed that way). */
export default function ExplanationList({ errors }: { errors: GrammarErrorExplanation[] }) {
  if (errors.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Giải thích lỗi</h3>
      {errors.map((err, index) => (
        <div
          key={index}
          className="rounded-md border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-500/30 dark:text-rose-300">
              {err.error_type}
            </span>
            <span lang="ja" className="text-sm text-rose-500 line-through">
              {err.original_fragment}
            </span>
            <ArrowRightIcon className="h-3.5 w-3.5 text-gray-400" />
            <span lang="ja" className="text-sm font-medium text-teal-700 dark:text-teal-400">
              {err.corrected_fragment}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">Vì sao sai:</span> {err.why_wrong}
          </p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">Vì sao sửa vậy:</span> {err.why_fixed}
          </p>
        </div>
      ))}
    </div>
  );
}
