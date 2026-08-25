import { useState } from "react";
import type { KanjiInfo } from "../../../services/api";
import { kanjiVgUrl } from "../dictionaryUtils";

/** Stroke-order diagram for one kanji (numbered strokes, from KanjiVG), falling back to the plain glyph if unavailable. */
function KanjiStrokeDiagram({ literal }: { literal: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="flex h-28 w-28 shrink-0 items-center justify-center text-6xl font-bold leading-none text-gray-900 dark:text-white">
        {literal}
      </span>
    );
  }

  return (
    <img
      src={kanjiVgUrl(literal)}
      alt={literal}
      title={`Thứ tự nét chữ "${literal}" — dữ liệu từ KanjiVG`}
      onError={() => setFailed(true)}
      className="h-28 w-28 shrink-0 rounded-lg bg-white p-1 dark:bg-gray-50"
    />
  );
}

interface KanjiTabProps {
  kanji: KanjiInfo[];
  onPlayPronunciation: (text: string) => void;
}

export default function KanjiTab({ kanji, onPlayPronunciation }: KanjiTabProps) {
  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
      {kanji.length > 0 ? (
        kanji.map((k, kIdx) => (
          <div
            key={k.literal}
            className={`py-5 ${kIdx > 0 ? "border-t border-outline-variant/60 dark:border-gray-700" : "pt-0"}`}
          >
            <div className="flex items-start gap-4">
              <KanjiStrokeDiagram literal={k.literal} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {k.hanviet.length > 0 && (
                    <span className="rounded-full bg-primary-fixed px-3 py-1 text-sm font-semibold text-on-primary-fixed break-words">
                      {k.hanviet.join(", ")}
                    </span>
                  )}
                  {k.jlpt && (
                    <span className="inline-block rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                      JLPT {k.jlpt}
                    </span>
                  )}
                  {k.grade && (
                    <span className="inline-block rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                      Lớp {k.grade}
                    </span>
                  )}
                  {k.stroke_count != null && (
                    <span className="inline-block rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                      {k.stroke_count} nét
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onPlayPronunciation(k.literal)}
                    title="Nghe âm đọc"
                    className="shrink-0 rounded-full p-1.5 text-outline hover:bg-surface-container-high hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.79L4.117 13.5H2a1 1 0 01-1-1v-5a1 1 0 011-1h2.117l4.266-3.29a1 1 0 011-.134zM14.657 5.343a1 1 0 011.414 0A7.975 7.975 0 0118 10a7.975 7.975 0 01-1.929 5.657 1 1 0 11-1.414-1.414A5.975 5.975 0 0016 10a5.975 5.975 0 00-1.343-4.243 1 1 0 010-1.414z" />
                    </svg>
                  </button>
                </div>

                {k.on_yomi.length > 0 && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                    <span className="font-medium text-gray-500 dark:text-gray-400">On: </span>
                    {k.on_yomi.join("、")}
                  </p>
                )}
                {k.kun_yomi.length > 0 && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                    <span className="font-medium text-gray-500 dark:text-gray-400">Kun: </span>
                    {k.kun_yomi.join("、")}
                  </p>
                )}
                {k.meaning && (
                  <p className="text-sm text-gray-800 dark:text-gray-200 break-words">{k.meaning}</p>
                )}
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className="py-6 text-center text-xs italic text-outline dark:text-gray-500">
          Từ này không có Hán tự.
        </p>
      )}
      {kanji.length > 0 && (
        <p className="mt-2 border-t border-outline-variant/60 pt-3 text-right text-[11px] text-outline dark:border-gray-700 dark:text-gray-500">
          Nét chữ:{" "}
          <a href="https://kanjivg.tagaini.net/" target="_blank" rel="noreferrer" className="hover:underline">
            KanjiVG
          </a>{" "}
          (CC BY-SA 3.0)
        </p>
      )}
    </div>
  );
}
