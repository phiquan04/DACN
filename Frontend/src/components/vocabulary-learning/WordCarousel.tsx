import type { CSSProperties } from "react";
import type { VocabularyLearningItem } from "../../services/vocabularyLearningApi";

const HALF_WINDOW = 2; // 2 neighbor words shown on each side of the current one — 5 tiles total
const TILE_WIDTH = 104;

interface Slot {
  absoluteIndex: number;
  offset: number;
}

/** Builds the fixed 5-slot window (current word centered, up to 2 neighbors each side),
 * wrapping circularly around the batch — so even the very first word still has two words
 * to its left, pulled from the end of the sequence, like beads around a wheel. Slots are
 * deduped by absolute index so a short batch (< 5 words) never repeats the same word twice. */
function buildSlots(total: number, index: number): Slot[] {
  const slots: Slot[] = [];
  const seen = new Set<number>();
  for (let offset = -HALF_WINDOW; offset <= HALF_WINDOW; offset++) {
    const absoluteIndex = ((index + offset) % total + total) % total;
    if (seen.has(absoluteIndex)) continue;
    seen.add(absoluteIndex);
    slots.push({ absoluteIndex, offset });
  }
  return slots;
}

// Depth ring per |offset| from center — front tile is biggest and flat; each ring further
// out rotates away in 3D and sinks back in Z, like a wheel curving front-to-back.
const DEPTH_RINGS = [
  { rotateY: 0, translateX: 0, translateZ: 0, scale: 1.18, opacity: 1 },
  { rotateY: 32, translateX: 86, translateZ: -70, scale: 0.84, opacity: 0.72 },
  { rotateY: 48, translateX: 144, translateZ: -130, scale: 0.62, opacity: 0.38 },
];

function slotStyle(offset: number): CSSProperties {
  const ring = DEPTH_RINGS[Math.min(Math.abs(offset), DEPTH_RINGS.length - 1)];
  const side = Math.sign(offset);
  return {
    left: "50%",
    top: "50%",
    width: TILE_WIDTH,
    zIndex: 10 - Math.abs(offset),
    opacity: ring.opacity,
    transform: `translate(-50%, -50%) translateX(${side * ring.translateX}px) translateZ(${
      ring.translateZ
    }px) rotateY(${-side * ring.rotateY}deg) scale(${ring.scale})`,
  };
}

/** Circular, front-to-back "wheel" roadmap of the words in this study round — always shows
 * exactly 5 tiles (current word + 2 neighbors on each side), wrapping around the batch at the
 * edges. Click any tile to jump straight to that word. */
export default function WordCarousel({
  items,
  currentIndex,
  outcomes,
  onJump,
}: {
  items: VocabularyLearningItem[];
  currentIndex: number;
  outcomes: Record<number, "good" | "again">;
  onJump: (index: number) => void;
}) {
  if (items.length === 0) return null;
  const slots = buildSlots(items.length, currentIndex);

  return (
    <div className="relative mx-auto h-32 max-w-2xl" style={{ perspective: 900 }}>
      {slots.map(({ absoluteIndex, offset }) => {
        const item = items[absoluteIndex];
        const isCurrent = offset === 0;
        const outcome = outcomes[item.id];
        const toneClass = isCurrent
          ? "border-brand-500 bg-brand-50 text-brand-700 shadow-lg shadow-brand-500/20 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200"
          : outcome === "again"
          ? "border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          : outcome === "good"
          ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500";
        return (
          <button
            key={item.id}
            type="button"
            lang="ja"
            title={item.word}
            onClick={() => onJump(absoluteIndex)}
            style={slotStyle(offset)}
            className={`absolute flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 text-center transition-[transform,opacity,box-shadow] duration-300 ease-out ${toneClass}`}
          >
            <span className={`w-full truncate ${isCurrent ? "text-base font-bold" : "text-sm font-semibold"}`}>
              {item.word}
            </span>
            {isCurrent && item.reading && (
              <span className="w-full truncate text-[11px] font-normal opacity-70">{item.reading}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
