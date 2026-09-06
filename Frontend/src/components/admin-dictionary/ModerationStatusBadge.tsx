import type { ModerationStatus } from "../../services/adminDictionaryApi";

const STATUS_META: Record<ModerationStatus, { label: string; fill: string; ink: string }> = {
  pending: { label: "Chờ duyệt", fill: "#FFF3D9", ink: "#B47A1B" },
  approved: { label: "Đã duyệt", fill: "#E4F5F1", ink: "#15988E" },
  flagged: { label: "Cảnh báo", fill: "#FBE9ED", ink: "#C26678" },
};

export default function ModerationStatusBadge({ status }: { status: ModerationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: meta.fill, color: meta.ink }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.ink }} />
      {meta.label}
    </span>
  );
}
