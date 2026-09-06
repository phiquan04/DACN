import { Link } from "react-router";
import { JlptLevel } from "../../services/jlptApi";

// Same level -> color mapping as LevelDistributionCard on the admin home
// dashboard, so a given JLPT level reads as the same color everywhere in
// the admin console.
const LEVEL_COLORS: Record<JlptLevel, string> = {
  N1: "#142B52",
  N2: "#315DCE",
  N3: "#F0B429",
  N4: "#15988E",
  N5: "#5E6BC4",
};

const LEVEL_LABELS: Record<JlptLevel, string> = {
  N5: "Cơ bản",
  N4: "Sơ cấp",
  N3: "Trung cấp",
  N2: "Trung cao cấp",
  N1: "Cao cấp",
};

const LEVELS_DISPLAY: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export interface LevelProgressItem {
  level: JlptLevel;
  totalQuestions: number;
  percentReady: number;
}

interface Props {
  items: LevelProgressItem[];
}

export default function JLPTLevelProgressCard({ items }: Props) {
  const byLevel = new Map(items.map((i) => [i.level, i]));

  return (
    <div className="rounded-2xl border border-admin-border bg-white p-6 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-admin-ink">Tiến độ theo cấp độ</h3>
          <p className="text-sm text-admin-body">Số lượng câu hỏi đã sẵn sàng sử dụng</p>
        </div>
        <Link to="/admin/jlpt-content/structure" className="text-sm font-medium text-admin-500 hover:text-admin-600">
          Xem chi tiết
        </Link>
      </div>

      <ul className="mt-5 flex flex-col gap-4">
        {LEVELS_DISPLAY.map((level) => {
          const item = byLevel.get(level);
          const total = item?.totalQuestions ?? 0;
          const percent = item?.percentReady ?? 0;
          return (
            <li key={level} className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold text-white"
                style={{ backgroundColor: LEVEL_COLORS[level] }}
              >
                {level}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-admin-ink">{LEVEL_LABELS[level]}</span>
                  <span className="shrink-0 text-xs font-semibold text-admin-ink">{percent}%</span>
                </div>
                <p className="text-xs text-admin-meta">{total.toLocaleString("vi-VN")} câu hỏi</p>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-admin-fill">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${percent}%`, backgroundColor: LEVEL_COLORS[level] }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
