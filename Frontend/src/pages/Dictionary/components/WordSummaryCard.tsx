import type { DictionaryResult } from "../../../services/api";
import { classifyPos, POS_BADGE_CLASSES, uniquePosLabels } from "../dictionaryUtils";

interface WordSummaryCardProps {
  item: DictionaryResult;
  onPlayPronunciation: (text: string) => void;
  onPracticePronunciation: (word: string, reading: string, meaning: string) => void;
}

export default function WordSummaryCard({ item, onPlayPronunciation, onPracticePronunciation }: WordSummaryCardProps) {
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
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${POS_BADGE_CLASSES[classifyPos(pos)]}`}
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
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onPlayPronunciation(item.reading || item.word)}
            className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/60 px-4 py-2 text-sm font-medium text-on-surface-variant hover:border-brand-500 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.79L4.117 13.5H2a1 1 0 01-1-1v-5a1 1 0 011-1h2.117l4.266-3.29a1 1 0 011-.134zM14.657 5.343a1 1 0 011.414 0A7.975 7.975 0 0118 10a7.975 7.975 0 01-1.929 5.657 1 1 0 11-1.414-1.414A5.975 5.975 0 0016 10a5.975 5.975 0 00-1.343-4.243 1 1 0 010-1.414z" />
            </svg>
            Phát âm
          </button>
          <button
            type="button"
            onClick={() =>
              onPracticePronunciation(item.word, item.reading, item.definitions[0]?.meaning ?? "")
            }
            className="shrink-0 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Luyện phát âm
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

      {/* Kanji breakdown (compact preview — full detail lives in the "Hán tự" tab) */}
      {item.kanji.length > 0 && (
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
