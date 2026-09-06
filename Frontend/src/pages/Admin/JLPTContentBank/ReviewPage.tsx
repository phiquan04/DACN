import { useEffect } from "react";
import { useSearchParams } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";
import ReviewExams from "../../../components/admin-jlpt/ReviewExams";

export default function ReviewPage() {
  const { setPageHeader } = usePageHeader();
  const [searchParams] = useSearchParams();
  const examIdParam = searchParams.get("examId");
  const focusExamId = examIdParam ? Number(examIdParam) : null;

  useEffect(() => {
    setPageHeader("Duyệt đề thi", "Kiểm tra lại câu hỏi do AI tách từ đề PDF, sửa đáp án nếu cần rồi publish cho học viên.");
  }, [setPageHeader]);

  return (
    <>
      <PageMeta title="Duyệt đề thi | Manabi AI" description="Duyệt và publish đề thi JLPT." />
      <div className="space-y-5">
        <ReviewExams focusExamId={focusExamId} />
      </div>
    </>
  );
}
