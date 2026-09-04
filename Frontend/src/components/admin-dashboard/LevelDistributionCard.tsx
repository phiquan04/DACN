import { LevelDistributionItem } from "../../services/adminDashboardApi";

const LEVEL_COLORS: Record<string, string> = {
  N1: "#142B52",
  N2: "#315DCE",
  N3: "#F0B429",
  N4: "#15988E",
  N5: "#5E6BC4",
};

const RADIUS = 60;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
  items: LevelDistributionItem[];
}

export default function LevelDistributionCard({ items }: Props) {
  const totalClassified = items.reduce((sum, i) => sum + i.count, 0);

  let offsetSoFar = 0;
  const segments = items.map((item) => {
    const length = (item.percent / 100) * CIRCUMFERENCE;
    const segment = { ...item, dashArray: `${length} ${CIRCUMFERENCE - length}`, dashOffset: -offsetSoFar };
    offsetSoFar += length;
    return segment;
  });

  return (
    <div className="rounded-2xl border border-admin-border bg-white p-6 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-admin-ink">Phân bổ trình độ người dùng</h3>
          <p className="text-sm text-admin-body">Tỉ lệ người dùng theo từng cấp độ JLPT</p>
        </div>
      </div>

      {totalClassified === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-admin-meta">
          Chưa có người dùng nào khai báo trình độ JLPT.
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
          <svg width="180" height="180" viewBox="0 0 180 180" className="shrink-0 -rotate-90">
            <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#EEF2F7" strokeWidth={STROKE} />
            {segments.map((s) =>
              s.count > 0 ? (
                <circle
                  key={s.level}
                  cx="90"
                  cy="90"
                  r={RADIUS}
                  fill="none"
                  stroke={LEVEL_COLORS[s.level] ?? "#8294AF"}
                  strokeWidth={STROKE}
                  strokeDasharray={s.dashArray}
                  strokeDashoffset={s.dashOffset}
                />
              ) : null
            )}
            <text x="90" y="90" textAnchor="middle" dominantBaseline="middle" style={{ transform: "rotate(90deg)", transformOrigin: "90px 90px" }}>
              <tspan x="90" dy="-4" className="fill-admin-ink text-2xl font-bold">
                {totalClassified.toLocaleString("vi-VN")}
              </tspan>
              <tspan x="90" dy="20" className="fill-admin-meta text-[11px]">
                người dùng
              </tspan>
            </text>
          </svg>

          <ul className="flex w-full flex-col gap-2.5 sm:w-auto">
            {items.map((item) => (
              <li key={item.level} className="flex items-center gap-2.5 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: LEVEL_COLORS[item.level] }} />
                <span className="w-8 font-medium text-admin-ink">{item.level}</span>
                <span className="text-admin-body">{item.percent}%</span>
                <span className="text-xs text-admin-meta">({item.count.toLocaleString("vi-VN")})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
