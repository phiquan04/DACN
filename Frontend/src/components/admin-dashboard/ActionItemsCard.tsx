import { Link } from "react-router";
import { ActionItem, ActionItemKind } from "../../services/adminDashboardApi";
import { ChatIcon, DocsIcon, FileIcon } from "../../icons";

const KIND_ICON: Record<ActionItemKind, React.ReactNode> = {
  vocabulary_set: <DocsIcon />,
  jlpt_exam: <FileIcon />,
  chat_scenario: <ChatIcon />,
};

const KIND_LINK: Record<ActionItemKind, string> = {
  vocabulary_set: "/admin/vocabulary-content/review",
  jlpt_exam: "/admin/jlpt-content/review",
  chat_scenario: "/admin/chat-scenarios",
};

const BADGE_STYLE: Record<string, string> = {
  "Chờ duyệt": "bg-amber-100 text-amber-700",
  "Tạm ngưng": "bg-gray-100 text-gray-600",
};

interface Props {
  items: ActionItem[];
}

export default function ActionItemsCard({ items }: Props) {
  return (
    <div className="rounded-2xl border border-admin-border bg-white p-6 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-admin-ink">Cần xử lý</h3>
          <p className="text-sm text-admin-body">Danh sách công việc gần đây</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex h-[180px] items-center justify-center text-sm text-admin-meta">
          Không có công việc nào đang chờ xử lý.
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Link
                to={KIND_LINK[item.kind]}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-admin-fill"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-admin-50 text-admin-500 [&>svg]:h-4.5 [&>svg]:w-4.5">
                  {KIND_ICON[item.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span lang="ja" className="block truncate text-sm font-medium text-admin-ink" title={item.title}>
                    {item.title}
                  </span>
                  <span className="block text-xs text-admin-meta">{item.subtitle}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    BADGE_STYLE[item.badge] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {item.badge}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
