import { Link } from "react-router";
import { ExamSummary } from "../../services/jlptApi";
import { formatRelativeTime } from "../../utils/datetime";

// Status fill/ink pairs from CLAUDE.md's admin "Status colors" table.
const STATUS_STYLE: Record<string, { label: string; fill: string; ink: string }> = {
  published: { label: "Đã xuất bản", fill: "#E4F5F1", ink: "#15988E" },
  draft: { label: "Bản nháp", fill: "#EEF2F7", ink: "#64748B" },
};

interface Props {
  exams: ExamSummary[];
}

export default function JLPTRecentExamsCard({ exams }: Props) {
  return (
    <div className="rounded-2xl border border-admin-border bg-white p-6 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-admin-ink">Đề thi gần đây</h3>
          <p className="text-sm text-admin-body">Các đề được cập nhật mới nhất</p>
        </div>
        <Link to="/admin/jlpt-content/review" className="text-sm font-medium text-admin-500 hover:text-admin-600">
          Tất cả
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="flex h-[180px] items-center justify-center text-sm text-admin-meta">
          Chưa có đề thi nào được import.
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {exams.map((exam) => {
            const status = STATUS_STYLE[exam.status] ?? STATUS_STYLE.draft;
            return (
              <li key={exam.id}>
                <Link
                  to={`/admin/jlpt-content/review?examId=${exam.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-admin-fill"
                >
                  <span className="min-w-0 flex-1">
                    <span lang="ja" className="block truncate text-sm font-medium text-admin-ink" title={exam.title}>
                      {exam.title}
                    </span>
                    <span className="block text-xs text-admin-meta">
                      {exam.level} · {exam.question_count.toLocaleString("vi-VN")} câu hỏi · {formatRelativeTime(exam.created_at)}
                    </span>
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ backgroundColor: status.fill, color: status.ink }}
                  >
                    {status.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
