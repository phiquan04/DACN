import type { EvaluationResult } from "../pronunciationUtils";
import { scoreBarColor, scoreRingColor } from "../pronunciationUtils";

export interface ScoreMetric {
  label: string;
  value: number;
  /** Predefined mode's intonation metric turns red below 75; the others never highlight. */
  highlightLow?: boolean;
}

interface ScoreCardProps {
  evaluation: EvaluationResult | null;
  metrics: ScoreMetric[];
  /** lg = PredefinedMode's larger ring (h-28/text-3xl); md = VoiceMode's (h-24/text-2xl). */
  size?: "lg" | "md";
  minHeightClass?: string;
  wrongWordMessage: string;
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 40;

export default function ScoreCard({
  evaluation,
  metrics,
  size = "lg",
  minHeightClass = "min-h-[220px]",
  wrongWordMessage,
}: ScoreCardProps) {
  const ringSizeClass = size === "lg" ? "h-28 w-28" : "h-24 w-24";
  const scoreTextClass = size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 text-center shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-base font-semibold text-on-surface dark:text-white/90">Điểm tổng quan</h3>
      {evaluation && !evaluation.wrong_word ? (
        <>
          <div className="mb-5 flex justify-center">
            <div className={`relative flex items-center justify-center ${ringSizeClass}`}>
              <svg className={`-rotate-90 ${ringSizeClass}`} viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="40" fill="none" strokeWidth="8" className="stroke-surface-container-high dark:stroke-gray-700" />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={RING_CIRCUMFERENCE - (Math.min(evaluation.overall, 100) / 100) * RING_CIRCUMFERENCE}
                  className={`${scoreRingColor(evaluation.overall)} stroke-current transition-all duration-500`}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className={`font-bold text-on-surface dark:text-white ${scoreTextClass}`}>{evaluation.overall}</span>
                <span className="text-xs text-on-surface-variant dark:text-gray-400">/ 100</span>
              </div>
            </div>
          </div>
          <div className="space-y-3 text-left">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-sm text-on-surface dark:text-gray-200">
                  <span>{m.label}</span>
                  <span className={`font-semibold ${m.highlightLow && m.value < 75 ? "text-error dark:text-red-400" : ""}`}>
                    {m.value}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-surface-container-high dark:bg-gray-700">
                  <div className={`h-2 rounded-full ${scoreBarColor(m.value)}`} style={{ width: `${m.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div
          className={`flex flex-col items-center justify-center text-sm text-on-surface-variant dark:text-gray-400 ${minHeightClass} ${
            size === "lg" ? "h-full" : ""
          }`}
        >
          {evaluation?.wrong_word ? wrongWordMessage : "Ghi âm để xem điểm số của bạn."}
        </div>
      )}
    </div>
  );
}
