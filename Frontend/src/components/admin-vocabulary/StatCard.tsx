import { ReactNode } from "react";

export type StatTone = "teal" | "rose" | "emerald" | "brand" | "amber";

const TONE_STYLES: Record<StatTone, string> = {
  teal: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  brand: "bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
};

interface Props {
  label: string;
  value: number;
  icon: ReactNode;
  /** Overrides the default teal icon circle — use to make a stat's meaning
   * obvious at a glance (e.g. a "locked" count in rose, an "active" count
   * in emerald), not tied to the brand color roles used elsewhere. */
  tone?: StatTone;
}

export default function StatCard({ label, value, icon, tone = "teal" }: Props) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full [&>svg]:h-5 [&>svg]:w-5 ${TONE_STYLES[tone]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-0.5 text-3xl font-bold text-gray-800 dark:text-white/90">{value}</p>
      </div>
    </div>
  );
}
