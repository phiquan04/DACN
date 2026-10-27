import { useState } from "react";
import type { KanjiInfo } from "../../../services/api";
import { kanjiVgUrl } from "../dictionaryUtils";

/** Stroke-order diagram for one kanji (numbered strokes, from KanjiVG), falling back to the plain glyph if unavailable. */
function KanjiStrokeDiagram({ literal }: { literal: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="flex h-48 w-48 shrink-0 items-center justify-center text-[7rem] font-bold sm:h-64 sm:w-64 sm:text-[9rem] leading-none text-gray-900 dark:text-white">
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
      className="h-48 w-48 shrink-0 rounded-lg bg-white p-1 dark:bg-gray-50 sm:h-64 sm:w-64"
    />
  );
}

/** Detail panel for a single kanji — same info layout as before, just reused per-tab now. */
function KanjiDetail({ k }: { k: KanjiInfo }) {
  return (
    // Phone: the stroke diagram sits above the details (side by side it would leave the text ~60px).
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <KanjiStrokeDiagram literal={k.literal} />
      <div className="w-full min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {k.hanviet.length > 0 && (
            <span className="rounded-lg bg-primary-fixed px-3 py-1 text-sm font-semibold text-on-primary-fixed break-words">
              {k.hanviet.join(", ")}
            </span>
          )}
          {k.jlpt && (
            <span className="inline-block rounded-lg bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant">
              JLPT {k.jlpt}
            </span>
          )}
          {k.stroke_count != null && (
            <span className="inline-block rounded-lg bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant">
              {k.stroke_count} nét
            </span>
          )}
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
        {k.meaning && <p className="text-sm text-gray-800 dark:text-gray-200 break-words">{k.meaning}</p>}
      </div>
    </div>
  );
}

interface KanjiTabProps {
  kanji: KanjiInfo[];
}

/** Hán tự tab: when a word has more than one kanji, each becomes its own sub-tab (glyph as the tab label)
 * instead of a long stacked list — the selected kanji's detail renders larger below. */
export default function KanjiTab({ kanji }: KanjiTabProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = kanji[Math.min(activeIndex, kanji.length - 1)];

  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
      {kanji.length > 0 ? (
        <>
          {kanji.length > 1 && (
            <div className="mb-5 flex flex-wrap gap-2 border-b border-outline-variant/60 pb-4 dark:border-gray-700">
              {kanji.map((k, idx) => (
                <button
                  key={k.literal}
                  type="button"
                  lang="ja"
                  onClick={() => setActiveIndex(idx)}
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl font-bold transition-colors ${
                    idx === activeIndex
                      ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-theme-xs"
                      : "bg-surface-container text-on-surface hover:bg-surface-container-high dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {k.literal}
                </button>
              ))}
            </div>
          )}
          {active && <KanjiDetail k={active} />}
        </>
      ) : (
        <p className="py-6 text-center text-xs italic text-outline dark:text-gray-500">
          Từ này không có Hán tự.
        </p>
      )}
      {kanji.length > 0 && (
        <p className="mt-4 border-t border-outline-variant/60 pt-3 text-right text-[11px] text-outline dark:border-gray-700 dark:text-gray-500">
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
