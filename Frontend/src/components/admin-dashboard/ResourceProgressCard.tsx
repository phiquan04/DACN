import { ResourceBar } from "../../services/adminDashboardApi";

const BAR_COLORS = ["#315DCE", "#5E6BC4", "#15988E"];

interface Props {
  resources: ResourceBar[];
}

export default function ResourceProgressCard({ resources }: Props) {
  return (
    <div className="rounded-2xl border border-admin-border bg-white p-6 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
      <div>
        <h3 className="text-base font-semibold text-admin-ink">Kho tài nguyên</h3>
        <p className="text-sm text-admin-body">Trạng thái nội dung hiện tại</p>
      </div>

      <ul className="mt-5 flex flex-col gap-5">
        {resources.map((r, i) => {
          const percent = r.total > 0 ? Math.min(100, Math.round((r.current / r.total) * 100)) : 0;
          return (
            <li key={r.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-admin-body">{r.label}</span>
                <span className="font-medium text-admin-ink">
                  {r.current.toLocaleString("vi-VN")} / {r.total.toLocaleString("vi-VN")}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-admin-fill">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${percent}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
