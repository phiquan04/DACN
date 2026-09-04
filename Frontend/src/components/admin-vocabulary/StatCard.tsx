import { ReactNode } from "react";

export type StatTone = "neutral" | "success" | "pending" | "danger" | "info";

// Fill/ink pairs straight from CLAUDE.md's admin "Status colors" table, plus
// a lavender "neutral" pair for plain counts that carry no status meaning.
// Exported so other admin components (e.g. the activity feed on the user
// detail page) can color their own icon tiles from the same palette.
export const TONE_COLORS: Record<StatTone, { fill: string; ink: string }> = {
  neutral: { fill: "#E8EFFF", ink: "#5E6BC4" },
  success: { fill: "#E4F5F1", ink: "#15988E" },
  pending: { fill: "#FFF3D9", ink: "#B47A1B" },
  danger: { fill: "#FDEBEC", ink: "#C94D5C" },
  info: { fill: "#E6F1FC", ink: "#4B91D2" },
};

interface Props {
  label: string;
  value: number | string;
  icon: ReactNode;
  /** Icon tile color — pick the tone matching this stat's status meaning
   * (see CLAUDE.md admin "Status colors"), not for visual variety. */
  tone?: StatTone;
  /** Short context chip in the top-right corner, e.g. "+12 trong 7 ngày qua". */
  hint?: ReactNode;
}

export default function StatCard({ label, value, icon, tone = "neutral", hint }: Props) {
  const { fill, ink } = TONE_COLORS[tone];
  return (
    <div className="rounded-2xl border border-admin-border bg-white p-6 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] [&>svg]:h-5 [&>svg]:w-5"
          style={{ backgroundColor: fill, color: ink }}
        >
          {icon}
        </span>
        {hint && (
          <span className="shrink-0 rounded-full bg-admin-fill px-2.5 py-1 text-[11px] font-medium text-admin-body">
            {hint}
          </span>
        )}
      </div>
      <p className="mt-4 text-sm font-medium text-admin-body">{label}</p>
      <p className="mt-1 text-[28px] font-bold leading-tight text-admin-ink">
        {typeof value === "number" ? value.toLocaleString("vi-VN") : value}
      </p>
    </div>
  );
}
