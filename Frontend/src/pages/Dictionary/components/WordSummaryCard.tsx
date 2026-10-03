import type { DictionaryResult } from "../../../services/api";
import { FolderIcon } from "../../../icons";
import { classifyPos, POS_BADGE_CLASSES, uniquePosLabels } from "../dictionaryUtils";

interface WordSummaryCardProps {
  item: DictionaryResult;
  onPlayPronunciation: (text: string) => void;
  onPracticePronunciation: (word: string, reading: string, meaning: string) => void;
  onAddToMine: () => void;
  /** Hide the compact kanji breakdown preview — redundant once the Hán tự tab shows the same kanji in full detail. */
  showKanjiPreview?: boolean;
}

export default function WordSummaryCard({
  item,
  onPlayPronunciation,
  onPracticePronunciation,
  onAddToMine,
  showKanjiPreview = true,
}: WordSummaryCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 lang="ja" className="text-3xl font-bold text-gray-900 dark:text-white break-words">
            {item.word}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {item.reading && (
              <span className="text-sm text-outline dark:text-gray-400 break-words">
                {item.reading}
              </span>
            )}
            {uniquePosLabels(item.definitions).map((pos) => (
              <span
                key={pos}
                className={`inline-block px-2.5 py-1 text-xs font-semibold ${POS_BADGE_CLASSES[classifyPos(pos)]}`}
              >
                {pos}
              </span>
            ))}
            {item.jlpt && item.jlpt !== "N/A" && (
              <span className="inline-block rounded-full bg-primary-fixed px-2.5 py-1 text-xs font-medium text-on-primary-fixed">
                JLPT {item.jlpt}
              </span>
            )}
            {item.frequency && item.frequency !== "N/A" && (
              <span className="inline-block rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant dark:bg-gray-800 dark:text-gray-300">
                #{item.frequency}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onPlayPronunciation(item.reading || item.word)}
            title="Phát âm"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/60 text-on-surface-variant hover:border-brand-500 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.79L4.117 13.5H2a1 1 0 01-1-1v-5a1 1 0 011-1h2.117l4.266-3.29a1 1 0 011-.134zM14.657 5.343a1 1 0 011.414 0A7.975 7.975 0 0118 10a7.975 7.975 0 01-1.929 5.657 1 1 0 11-1.414-1.414A5.975 5.975 0 0016 10a5.975 5.975 0 00-1.343-4.243 1 1 0 010-1.414z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() =>
              onPracticePronunciation(item.word, item.reading, item.definitions[0]?.meaning ?? "")
            }
            title="Luyện phát âm"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/60 text-on-surface-variant hover:border-brand-500 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 4a3 3 0 116 0v6a3 3 0 11-6 0V4z" />
              <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onAddToMine}
            disabled={item.definitions.length === 0}
            title="Thêm vào bộ của tôi"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/60 text-on-surface-variant hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 transition-colors"
          >
            <FolderIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Meaning: primary sense large, remaining senses listed below. Part-of-speech is
          shown once already (the colored badges next to furigana above) — not repeated here. */}
      {item.definitions.length > 0 && (
        <div className="space-y-1">
          <p className="text-lg text-gray-900 dark:text-gray-100 break-words">
            {item.definitions[0].meaning}
          </p>
          {item.definitions.slice(1).map((def, defIdx) => (
            <p key={defIdx} className="text-sm text-gray-600 dark:text-gray-400 break-words">
              {def.meaning}
            </p>
          ))}
        </div>
      )}

      {/* Kanji breakdown (compact preview — hidden on the "Hán tự" tab, which already shows the same kanji in full detail) */}
      {showKanjiPreview && item.kanji.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {item.kanji.map((k) => (
            <div key={k.literal} className="rounded-xl bg-surface-container p-4 dark:bg-gray-800">
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-5xl font-bold leading-none text-gray-900 dark:text-white">
                  {k.literal}
                </span>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  {k.on_yomi.length > 0 && (
                    <p className="text-gray-700 dark:text-gray-300 break-words">
                      <span className="font-medium text-gray-500 dark:text-gray-400">On: </span>
                      {k.on_yomi.join("、")}
                    </p>
                  )}
                  {k.kun_yomi.length > 0 && (
                    <p className="text-gray-700 dark:text-gray-300 break-words">
                      <span className="font-medium text-gray-500 dark:text-gray-400">Kun: </span>
                      {k.kun_yomi.join("、")}
                    </p>
                  )}
                  {k.hanviet.length > 0 && (
                    <p className="text-gray-500 dark:text-gray-400 break-words">
                      <span className="font-medium capitalize text-gray-700 dark:text-gray-300">
                        {k.hanviet[0]}
                      </span>
                      {k.meaning ? `: ${k.meaning}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
