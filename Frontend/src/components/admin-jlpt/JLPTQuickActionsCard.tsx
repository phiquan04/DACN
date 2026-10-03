import { Link } from "react-router";
import { CheckIcon, LayersIcon } from "../../icons/custom";
import { UploadIcon } from "./icons";

interface Step {
  no: string;
  title: string;
  description: string;
  linkLabel: string;
  linkTo: string;
  icon: React.ReactNode;
  badge?: string;
}

interface Props {
  configuredLevels: number;
  totalLevels: number;
  pendingReviewExams: number;
}

/** The three-step workflow (cấu trúc -> import -> duyệt) shown on the JLPT
 * Content Bank overview tab, each card linking straight into the matching
 * sibling tab. */
export default function JLPTQuickActionsCard({ configuredLevels, totalLevels, pendingReviewExams }: Props) {
  const steps: Step[] = [
    {
      no: "01",
      title: "Cấu trúc đề",
      description: "Thiết lập mondai, số câu hỏi và thời lượng cho từng cấp độ.",
      linkLabel: "Xem cấu trúc",
      linkTo: "/admin/jlpt-content/structure",
      icon: <LayersIcon className="h-5 w-5" />,
      badge: `${configuredLevels}/${totalLevels} cấp độ`,
    },
    {
      no: "02",
      title: "Import đề",
      description: "Tải lên câu hỏi từ file PDF hoặc nhập thủ công theo template.",
      linkLabel: "Import câu hỏi",
      linkTo: "/admin/jlpt-content/import",
      icon: <UploadIcon className="h-5 w-5" />,
    },
    {
      no: "03",
      title: "Duyệt & xuất bản",
      description: "Kiểm tra nội dung, sửa đáp án và xuất bản đề thi cho học viên.",
      linkLabel: "Mở hàng chờ",
      linkTo: "/admin/jlpt-content/review",
      icon: <CheckIcon className="h-5 w-5" />,
      badge: pendingReviewExams > 0 ? `${pendingReviewExams} đề chờ` : undefined,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {steps.map((step) => (
        <Link
          key={step.no}
          to={step.linkTo}
          className="group flex flex-col rounded-2xl border border-admin-border bg-white p-5 shadow-[0_4px_16px_rgba(35,67,110,0.05)] transition-colors hover:border-admin-200"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-admin-meta">{step.no}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-admin-50 text-admin-500">
                {step.icon}
              </span>
            </div>
            {step.badge && (
              <span className="shrink-0 rounded-full bg-admin-fill px-2.5 py-1 text-[11px] font-medium text-admin-body">
                {step.badge}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm font-semibold text-admin-ink">{step.title}</p>
          <p className="mt-1 text-xs text-admin-body">{step.description}</p>
          <span className="mt-3 text-sm font-medium text-admin-500 group-hover:text-admin-600">
            {step.linkLabel} →
          </span>
        </Link>
      ))}
    </div>
  );
}
