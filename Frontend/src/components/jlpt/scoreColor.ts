export type ScoreTone = "emerald" | "amber" | "rose";

export function percentTone(percent: number): ScoreTone {
  if (percent >= 80) return "emerald";
  if (percent >= 60) return "amber";
  return "rose";
}

export const PERCENT_BADGE_CLASSES: Record<ScoreTone, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};
