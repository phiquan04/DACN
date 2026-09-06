import { useEffect } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";
import ImportExamPanel from "../../../components/admin-jlpt/ImportExamPanel";

export default function ImportPage() {
  const { setPageHeader } = usePageHeader();
  const navigate = useNavigate();

  useEffect(() => {
    setPageHeader("Import đề thi", "Tải lên file PDF đề thi (kèm đáp án nếu có) để AI tách câu hỏi theo đúng cấu trúc đã thiết lập.");
  }, [setPageHeader]);

  return (
    <>
      <PageMeta title="Import đề thi | Manabi AI" description="Import đề thi JLPT từ file PDF." />
      <div className="space-y-5">
        <ImportExamPanel onImported={(examId) => navigate(`/admin/jlpt-content/review?examId=${examId}`)} />
      </div>
    </>
  );
}
