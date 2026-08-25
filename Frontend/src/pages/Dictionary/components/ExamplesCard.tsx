import { highlightWord } from "../dictionaryUtils";

interface ExamplesCardProps {
  word: string;
  examples: { japanese: string; vietnamese: string }[];
  loading: boolean;
}

export default function ExamplesCard({ word, examples, loading }: ExamplesCardProps) {
  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
      <h4 className="mb-4 text-base font-semibold text-on-surface dark:text-gray-100">Ví dụ</h4>

      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-1/2" />
          <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-3/4 mt-2" />
          <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-1/2" />
        </div>
      )}

      {!loading && examples.length > 0 && (
        <div>
          {examples.slice(0, 3).map((ex, exIdx) => (
            <div
              key={exIdx}
              className={exIdx > 0 ? "mt-4 border-t border-outline-variant/60 pt-4 dark:border-gray-700" : ""}
            >
              <p lang="ja" className="text-base text-on-surface font-medium dark:text-gray-200 break-words">
                {highlightWord(ex.japanese, word)}
              </p>
              <p className="mt-1 text-sm text-on-surface-variant dark:text-gray-400 break-words">{ex.vietnamese}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && examples.length === 0 && (
        <p className="text-xs text-outline italic">Không tìm được ví dụ.</p>
      )}
    </div>
  );
}
