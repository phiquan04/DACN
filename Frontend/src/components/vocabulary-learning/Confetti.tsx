import { useMemo } from "react";

const COLORS = ["#2563eb", "#10b981", "#f43f5e", "#f59e0b", "#14b8a6", "#8b5cf6"];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Lightweight, dependency-free confetti burst — a handful of colored strips
 * that fall and rotate once via a CSS keyframe, then stay unmounted by the
 * caller after a few seconds. Celebrates finishing a study session. */
export default function Confetti({ count = 70 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: randomBetween(0, 100),
        delay: randomBetween(0, 0.5),
        duration: randomBetween(2.2, 3.6),
        color: COLORS[i % COLORS.length],
        rotate: randomBetween(0, 360),
        width: randomBetween(6, 11),
      })),
    [count]
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes vocab-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.width,
            height: p.width * 0.4,
            backgroundColor: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rotate}deg)`,
            animation: `vocab-confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
