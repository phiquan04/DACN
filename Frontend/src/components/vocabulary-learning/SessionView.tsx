import { useEffect, useRef, useState } from "react";
import { AngleLeftIcon, AngleRightIcon, CloseIcon, FolderIcon, ShootingStarIcon } from "../../icons";
import {
  ReviewRating,
  VocabularyLearningItem,
  copyItemToMine,
  submitReview,
  toggleBookmark,
} from "../../services/vocabularyLearningApi";
import AddToMineModal from "./AddToMineModal";
import Confetti from "./Confetti";
import FillBlankCard from "./modes/FillBlankCard";
import FlashcardSrsCard from "./modes/FlashcardSrsCard";
import HanVietHintCard from "./modes/HanVietHintCard";
import ListenGuessCard from "./modes/ListenGuessCard";
import MatchPairsGame from "./modes/MatchPairsGame";
import MiniStoryPanel from "./modes/MiniStoryPanel";
import PronounceCard from "./modes/PronounceCard";
import QuizCard from "./modes/QuizCard";
import TypeMeaningCard from "./modes/TypeMeaningCard";
import { SessionResult, STUDY_MODE_ICONS, STUDY_MODES, StudyMode } from "./types";
import WordCarousel from "./WordCarousel";

type ChipOutcome = "good" | "again";

export default function SessionView({
  batch: initialBatch,
  mode,
  onExit,
  onComplete,
}: {
  batch: VocabularyLearningItem[];
  mode: StudyMode;
  onExit: () => void;
  onComplete: (result: SessionResult) => void;
}) {
  const [batch, setBatch] = useState(initialBatch);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<number, ChipOutcome>>({});
  const [xpFlash, setXpFlash] = useState<{ amount: number; key: number } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [showAddToMine, setShowAddToMine] = useState(false);
  const startTimeRef = useRef(Date.now());
  // Source of truth for the session tally — kept in a ref (not state) so `finish()` always reads
  // the latest count even though it's invoked from a stale closure right after the last grade.
  const tallyRef = useRef<SessionResult>({
    total: initialBatch.length,
    learnedCount: 0,
    reviewingCount: 0,
    againCount: 0,
    elapsedSeconds: 0,
  });
  // Mirrors tallyRef purely so the live "Đã thuộc / Cần ôn" chips in the header can re-render.
  const [tallyDisplay, setTallyDisplay] = useState(tallyRef.current);

  const modeDef = STUDY_MODES.find((m) => m.id === mode);
  const ModeIcon = STUDY_MODE_ICONS[mode];
  const isWholeBatch = mode === "match" || mode === "story";

  useEffect(() => {
    if (levelUp === null) return;
    const timer = setTimeout(() => setLevelUp(null), 2500);
    return () => clearTimeout(timer);
  }, [levelUp]);

  const finish = () => {
    onComplete({
      ...tallyRef.current,
      elapsedSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
    });
  };

  const handleGrade = async (itemId: number, rating: ReviewRating) => {
    setOutcomes((prev) => ({ ...prev, [itemId]: rating === "again" ? "again" : "good" }));
    if (rating === "again") tallyRef.current.againCount += 1;
    try {
      const res = await submitReview(itemId, rating);
      if (res.status === "learned") tallyRef.current.learnedCount += 1;
      else tallyRef.current.reviewingCount += 1;
      setXpFlash({ amount: res.xp_gained, key: Date.now() });
      if (res.leveled_up) setLevelUp(res.new_level);
    } catch {
      tallyRef.current.reviewingCount += 1;
    } finally {
      setTallyDisplay({ ...tallyRef.current });
    }
  };

  const handleToggleBookmark = async (itemId: number) => {
    try {
      const res = await toggleBookmark(itemId);
      setBatch((prev) => prev.map((it) => (it.id === itemId ? { ...it, is_bookmarked: res.is_bookmarked } : it)));
    } catch {
      // reported globally by the http client
    }
  };

  const current = batch[index];

  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  const goNext = () => {
    if (index + 1 >= batch.length) {
      finish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handleCardGrade = async (rating: ReviewRating) => {
    await handleGrade(current.id, rating);
    goNext();
  };

  const progressPct = isWholeBatch ? 100 : (index / batch.length) * 100;

  const renderCard = () => {
    switch (mode) {
      case "flashcard":
        return (
          <FlashcardSrsCard
            key={current.id}
            item={current}
            onGrade={handleCardGrade}
            onToggleBookmark={() => handleToggleBookmark(current.id)}
          />
        );
      case "hanviet":
        return (
          <HanVietHintCard
            key={current.id}
            item={current}
            onGrade={handleCardGrade}
            onToggleBookmark={() => handleToggleBookmark(current.id)}
          />
        );
      case "listen":
        return (
          <ListenGuessCard
            key={current.id}
            item={current}
            onGrade={handleCardGrade}
            onToggleBookmark={() => handleToggleBookmark(current.id)}
          />
        );
      case "pronounce":
        return (
          <PronounceCard
            key={current.id}
            item={current}
            onGrade={handleCardGrade}
            onToggleBookmark={() => handleToggleBookmark(current.id)}
          />
        );
      case "type-meaning":
        return (
          <TypeMeaningCard
            key={current.id}
            item={current}
            onGrade={handleCardGrade}
            onToggleBookmark={() => handleToggleBookmark(current.id)}
          />
        );
      case "fill-blank":
        return (
          <FillBlankCard
            key={current.id}
            item={current}
            onGrade={handleCardGrade}
            onToggleBookmark={() => handleToggleBookmark(current.id)}
          />
        );
      case "quiz":
        return (
          <QuizCard
            key={current.id}
            item={current}
            pool={batch}
            onGrade={handleCardGrade}
            onToggleBookmark={() => handleToggleBookmark(current.id)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {levelUp !== null && <Confetti />}

      {/* ===== Mode badge + exit ===== */}
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
          <ModeIcon className="h-3.5 w-3.5" />
          {modeDef?.name ?? "Học từ vựng"}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          {!isWholeBatch && (
            <button
              type="button"
              onClick={() => setShowAddToMine(true)}
              aria-label="Thêm từ này vào bộ của tôi"
              title="Thêm vào bộ của tôi"
              className="text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
            >
              <FolderIcon className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            aria-label="Đóng phiên học"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {showAddToMine && current && (
        <AddToMineModal onPick={(setId) => copyItemToMine(current.id, setId)} onClose={() => setShowAddToMine(false)} />
      )}

      {/* ===== Progress bar ===== */}
      <div className="relative mx-auto flex max-w-2xl items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: isWholeBatch ? "100%" : `${progressPct}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
          {isWholeBatch ? `${batch.length} từ` : `${index + 1}/${batch.length}`}
        </span>
        {xpFlash && (
          <span
            key={xpFlash.key}
            className="vocab-xp-flash pointer-events-none absolute right-8 top-full text-xs font-bold text-teal-600 dark:text-teal-400"
          >
            +{xpFlash.amount} XP
          </span>
        )}
      </div>

      {/* ===== Live tally for this round ===== */}
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Đã thuộc <span className="font-semibold text-gray-700 dark:text-gray-200">{tallyDisplay.learnedCount}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          Cần ôn lại{" "}
          <span className="font-semibold text-gray-700 dark:text-gray-200">{tallyDisplay.reviewingCount}</span>
        </span>
        {tallyDisplay.againCount > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            Quên hẳn <span className="font-semibold text-gray-700 dark:text-gray-200">{tallyDisplay.againCount}</span>
          </span>
        )}
      </div>

      {/* ===== Word roadmap: coverflow of every word this round, current/done/upcoming ===== */}
      {!isWholeBatch && (
        <WordCarousel items={batch} currentIndex={index} outcomes={outcomes} onJump={setIndex} />
      )}

      {levelUp !== null && (
        <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-teal-600 dark:text-teal-400">
          <ShootingStarIcon className="h-4 w-4" />
          Lên cấp {levelUp}!
        </p>
      )}

      {isWholeBatch ? (
        <div className="mx-auto max-w-2xl">
          {mode === "match" && <MatchPairsGame items={batch} onGradeItem={handleGrade} onFinish={finish} />}
          {mode === "story" && <MiniStoryPanel items={batch} onGradeItem={handleGrade} onFinish={finish} />}
        </div>
      ) : (
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            aria-label="Từ trước"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-teal-500 hover:text-teal-600 disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
          >
            <AngleLeftIcon className="h-5 w-5" />
          </button>
          <div key={current.id} className="min-w-0 flex-1 vocab-card-enter">
            {renderCard()}
          </div>
          <button
            type="button"
            onClick={goNext}
            aria-label="Từ tiếp theo"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-teal-500 hover:text-teal-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
          >
            <AngleRightIcon className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
