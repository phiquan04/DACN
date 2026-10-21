import { useEffect } from "react";
import { useSearchParams } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";
import ReviewGrammarSets from "../../../components/admin-grammar/ReviewGrammarSets";

export default function ReviewPage() {
  const { setPageHeader } = usePageHeader();
  const [searchParams] = useSearchParams();
  const setIdParam = searchParams.get("setId");
  const focusSetId = setIdParam ? Number(setIdParam) : null;

  useEffect(() => {
    setPageHeader(
      "Duyệt bộ ngữ pháp",
      "Kiểm tra lại mẫu ngữ pháp do AI tách từ file PDF, sửa nghĩa/câu ví dụ nếu cần rồi publish cho học viên."
    );
  }, [setPageHeader]);

  return (
    <>
      <PageMeta title="Duyệt bộ ngữ pháp | Manabi AI" description="Duyệt và publish bộ ngữ pháp." />
      <div className="space-y-5">
        <ReviewGrammarSets focusSetId={focusSetId} />
      </div>
    </>
  );
}
