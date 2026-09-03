import { useEffect, useMemo, useState } from "react";
import type { ReviewRating, VocabularyLearningItem } from "../../../services/vocabularyLearningApi";

interface Tile {
  key: string;
  itemId: number;
  text: string;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const MAX_PAIRS = 8;

export default function MatchPairsGame({
  items,
  onGradeItem,
  onFinish,
}: {
  items: VocabularyLearningItem[];
  onGradeItem: (itemId: number, rating: ReviewRating) => void;
  onFinish: () => void;
}) {
  const pairItems = useMemo(() => items.slice(0, MAX_PAIRS), [items]);
  const [wordTiles] = useState<Tile[]>(() =>
    shuffle(pairItems.map((i) => ({ key: `w-${i.id}`, itemId: i.id, text: i.word })))
  );
  const [meaningTiles] = useState<Tile[]>(() =>
    shuffle(pairItems.map((i) => ({ key: `m-${i.id}`, itemId: i.id, text: i.meaning_vi })))
  );
  const [matchedIds, setMatchedIds] = useState<Set<number>>(new Set());
  const [selectedWord, setSelectedWord] = useState<number | null>(null);
  const [selectedMeaning, setSelectedMeaning] = useState<number | null>(null);
  const [wrongFlash, setWrongFlash] = useState<{ word: number; meaning: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);

  useEffect(() => {
    if (selectedWord === null || selectedMeaning === null) return;
    if (selectedWord === selectedMeaning) {
      const matchedId = selectedWord;
      setMatchedIds((prev) => new Set(prev).add(matchedId));
      onGradeItem(matchedId, "good");
      setSelectedWord(null);
      setSelectedMeaning(null);
    } else {
      setWrongFlash({ word: selectedWord, meaning: selectedMeaning });
      setMistakes((m) => m + 1);
      const timer = setTimeout(() => {
        setWrongFlash(null);
        setSelectedWord(null);
        setSelectedMeaning(null);
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWord, selectedMeaning]);

  const allMatched = matchedIds.size === pairItems.length;

  const tileClass = (matched: boolean, selected: boolean, wrong: boolean) =>
    `w-full rounded-lg border p-3 text-center text-sm font-medium transition-colors ${
      matched
        ? "border-emerald-200 bg-emerald-50 text-emerald-400 dark:border-emerald-500/20 dark:bg-emerald-500/10"
        : wrong
        ? "border-rose-400 bg-rose-50 text-rose-600 dark:bg-rose-500/10"
        : selected
        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
    }`;

  return (
    <div className="space-y-4">
      {items.length > MAX_PAIRS && (
        <p className="text-xs text-gray-400 dark:text-gray-500">Chỉ hiển thị {MAX_PAIRS} cặp mỗi lượt cho dễ chơi.</p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {wordTiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              disabled={matchedIds.has(tile.itemId)}
              onClick={() => setSelectedWord(tile.itemId)}
              lang="ja"
              className={tileClass(
                matchedIds.has(tile.itemId),
                selectedWord === tile.itemId,
                wrongFlash?.word === tile.itemId
              )}
            >
              {tile.text}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {meaningTiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              disabled={matchedIds.has(tile.itemId)}
              onClick={() => setSelectedMeaning(tile.itemId)}
              className={tileClass(
                matchedIds.has(tile.itemId),
                selectedMeaning === tile.itemId,
                wrongFlash?.meaning === tile.itemId
              )}
            >
              {tile.text}
            </button>
          ))}
        </div>
      </div>

      {allMatched && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Hoàn thành! {mistakes === 0 ? "Không sai lần nào." : `Sai ${mistakes} lần.`}
          </p>
          <button
            type="button"
            onClick={onFinish}
            className="mt-3 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2 text-sm font-medium text-white hover:from-brand-600 hover:to-brand-700"
          >
            Xem kết quả
          </button>
        </div>
      )}
    </div>
  );
}
