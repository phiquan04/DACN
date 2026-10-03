import { ReactNode } from "react";
import { EyeIcon, TrashBinIcon } from "../../icons";
import { CheckIcon, ClockIcon, FlagIcon } from "../../icons/custom";
import { formatRelativeTime } from "../../utils/datetime";
import RowActionsMenu, { RowAction } from "../admin-users/RowActionsMenu";
import ModerationStatusBadge from "./ModerationStatusBadge";
import type { ModerationStatus } from "../../services/adminDictionaryApi";

interface Props {
  thumbnail: ReactNode;
  wordJa: string;
  subtitle: string;
  status: ModerationStatus;
  uploaderName: string;
  createdAt: string;
  score: number;
  onView: () => void;
  onDelete: () => void;
  onSetStatus: (status: ModerationStatus) => void;
}

const STATUS_ACTIONS: { status: ModerationStatus; label: string; icon: ReactNode }[] = [
  { status: "approved", label: "Duyệt nội dung", icon: <CheckIcon /> },
  { status: "flagged", label: "Đánh dấu cảnh báo", icon: <FlagIcon /> },
  { status: "pending", label: "Đặt lại chờ duyệt", icon: <ClockIcon /> },
];

export default function ModerationRow({
  thumbnail, wordJa, subtitle, status, uploaderName, createdAt, score, onView, onDelete, onSetStatus,
}: Props) {
  const scoreClass = score > 0 ? "text-[#15988E]" : score < 0 ? "text-[#C94D5C]" : "text-admin-meta";

  const actions: RowAction[] = [
    ...STATUS_ACTIONS.filter((a) => a.status !== status).map((a) => ({
      label: a.label,
      icon: a.icon,
      onClick: () => onSetStatus(a.status),
    })),
  ];

  return (
    <div className="flex items-center gap-3 border-b border-admin-border px-4 py-3.5 last:border-b-0">
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-admin-fill">{thumbnail}</span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span lang="ja" className="truncate text-sm font-semibold text-admin-ink" title={wordJa}>
            {wordJa}
          </span>
          <ModerationStatusBadge status={status} />
        </div>
        <p className="mt-0.5 truncate text-sm text-admin-body" title={subtitle}>
          {subtitle}
        </p>
        <p className="mt-0.5 text-xs text-admin-meta">
          Đăng bởi <span className="font-medium text-admin-body">{uploaderName}</span> · {formatRelativeTime(createdAt)}
        </p>
      </div>

      <div className={`shrink-0 text-right text-sm font-semibold ${scoreClass}`}>
        {score > 0 ? `+${score}` : score}
        <p className="text-[10px] font-normal uppercase tracking-[1px] text-admin-meta">votes</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onView}
          title="Xem chi tiết"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-admin-body hover:bg-admin-fill hover:text-admin-ink"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Xóa"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-admin-body hover:bg-[#FDEBEC] hover:text-[#C94D5C]"
        >
          <TrashBinIcon className="h-4 w-4" />
        </button>
        <RowActionsMenu actions={actions} />
      </div>
    </div>
  );
}
