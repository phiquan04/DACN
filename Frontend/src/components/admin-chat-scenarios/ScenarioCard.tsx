import type { AdminScenario } from "../../services/adminScenarioApi";
import { JlptLevelBadge } from "../admin-users/badges";
import { PencilIcon } from "../../icons";
import { DEFAULT_SCENARIO_ICON } from "./IconPicker";

// Rotates the icon-tile color across cards purely for visual variety in the
// grid (there's no per-scenario "color" field) — cycles the same fill/ink
// pairs the admin status table already uses elsewhere, so it stays inside
// the palette instead of inventing new colors.
const TILE_COLORS = [
  { fill: "#E6F1FC", ink: "#4B91D2" },
  { fill: "#E4F5F1", ink: "#15988E" },
  { fill: "#E8EFFF", ink: "#5E6BC4" },
  { fill: "#FFF3D9", ink: "#B47A1B" },
];

interface Props {
  scenario: AdminScenario;
  index: number;
  toggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
}

export default function ScenarioCard({ scenario, index, toggling, onToggle, onEdit }: Props) {
  const tile = TILE_COLORS[index % TILE_COLORS.length];

  return (
    <div className="flex flex-col rounded-2xl border border-admin-border bg-white p-5 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-xl"
          style={{ backgroundColor: tile.fill, color: tile.ink }}
        >
          {scenario.icon || DEFAULT_SCENARIO_ICON}
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={scenario.is_active}
          onClick={onToggle}
          disabled={toggling}
          title={scenario.is_active ? "Đang hiển thị — bấm để ẩn" : "Đã ẩn — bấm để hiển thị"}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 p-0 transition-colors duration-150 focus:outline-none focus-visible:ring-3 focus-visible:ring-admin-500/40 disabled:opacity-50 ${
            scenario.is_active ? "bg-admin-500" : "bg-admin-count-bg"
          }`}
        >
          <span
            className={`absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-150 ${
              scenario.is_active ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <p className="mt-4 truncate text-base font-semibold text-admin-ink" title={scenario.title}>
        {scenario.title}
      </p>
      <p className="mt-1 line-clamp-2 min-h-[2.5em] text-sm text-admin-body">
        {scenario.description || "Chưa có mô tả."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <JlptLevelBadge level={scenario.level} />
        <span
          className={`inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-xs font-semibold ${
            scenario.is_active ? "bg-[#E4F5F1] text-[#15988E]" : "bg-admin-count-bg text-admin-count-ink"
          }`}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: scenario.is_active ? "#15988E" : "#64748B" }}
          />
          {scenario.is_active ? "Đang hiển thị" : "Đã ẩn"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-admin-border pt-3">
        <p className="text-xs text-admin-meta">
          {scenario.context_fields.length > 0
            ? `Form bối cảnh · ${scenario.context_fields.length} trường`
            : "Bối cảnh: nhập tự do"}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="flex shrink-0 items-center gap-1.5 rounded-[9px] border border-admin-border-input px-3 py-1.5 text-xs font-medium text-admin-body outline-none hover:bg-admin-fill focus-visible:border-admin-200 focus-visible:ring-[3px] focus-visible:ring-admin-500/18"
        >
          <PencilIcon className="h-3.5 w-3.5" /> Chỉnh sửa
        </button>
      </div>
    </div>
  );
}
