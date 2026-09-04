import { ActivityPoint } from "../../services/adminDashboardApi";

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const CHART_WIDTH = 640;
const CHART_HEIGHT = 200;
const PADDING_LEFT = 32;
const PADDING_RIGHT = 20;
const PADDING_BOTTOM = 24;
const PADDING_TOP = 12;

function niceMax(value: number): number {
  if (value <= 5) return Math.max(1, value);
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

/** Weekday abbreviation for an "YYYY-MM-DD" date, parsed as local calendar
 * date rather than `new Date(iso)` — the latter reads as UTC midnight and
 * can land on the wrong local day depending on the viewer's timezone. */
function weekdayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
}

interface Props {
  points: ActivityPoint[];
}

export default function NewUsersTrendCard({ points }: Props) {
  const maxValue = niceMax(Math.max(...points.map((p) => p.new_users), 1));
  const plotWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = CHART_HEIGHT - PADDING_BOTTOM - PADDING_TOP;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = PADDING_LEFT + i * stepX;
    const y = PADDING_TOP + plotHeight - (p.new_users / maxValue) * plotHeight;
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1]?.x ?? 0},${PADDING_TOP + plotHeight} L${PADDING_LEFT},${
    PADDING_TOP + plotHeight
  } Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  let lastLabel: number | null = null;

  return (
    <div className="rounded-2xl border border-admin-border bg-white p-6 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-admin-ink">Hoạt động hệ thống</h3>
          <p className="text-sm text-admin-body">Người dùng mới trong 7 ngày qua</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-admin-body">
          <span className="h-2 w-2 rounded-full bg-admin-500" /> Người dùng mới
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full min-w-[480px]">
          <defs>
            <linearGradient id="newUsersFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#315DCE" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#315DCE" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridLines.map((g) => {
            const y = PADDING_TOP + plotHeight * (1 - g);
            const label = Math.round(maxValue * g);
            const showLabel = label !== lastLabel;
            lastLabel = label;
            return (
              <g key={g}>
                <line x1={PADDING_LEFT} y1={y} x2={CHART_WIDTH} y2={y} stroke="#E1E8F2" strokeWidth={1} />
                {showLabel && (
                  <text x={0} y={y + 4} className="fill-admin-meta text-[10px]">
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          <path d={areaPath} fill="url(#newUsersFill)" />
          <path d={linePath} fill="none" stroke="#315DCE" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {coords.map((c) => (
            <circle key={c.iso_date} cx={c.x} cy={c.y} r={3.5} fill="#315DCE" stroke="white" strokeWidth={1.5} />
          ))}

          {coords.map((c) => (
            <text key={c.iso_date} x={c.x} y={CHART_HEIGHT - 6} textAnchor="middle" className="fill-admin-meta text-[10px]">
              {weekdayLabel(c.iso_date)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
