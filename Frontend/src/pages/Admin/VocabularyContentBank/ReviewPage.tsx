import { useEffect } from "react";
import { useSearchParams } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";
import ReviewVocabularySets from "../../../components/admin-vocabulary/ReviewVocabularySets";

export default function ReviewPage() {
  const { setPageHeader } = usePageHeader();
  const [searchParams] = useSearchParams();
  const setIdParam = searchParams.get("setId");
  const focusSetId = setIdParam ? Number(setIdParam) : null;

  useEffect(() => {
    setPageHeader(
      "Duyệt bộ từ vựng",
      "Kiểm tra lại từ vựng do AI tách từ file PDF, sửa nghĩa/câu ví dụ nếu cần rồi publish cho học viên."
    );
  }, [setPageHeader]);

  return (
    <>
      <PageMeta title="Duyệt bộ từ vựng | Manabi AI" description="Duyệt và publish bộ từ vựng." />
      <div className="space-y-5">
        <ReviewVocabularySets focusSetId={focusSetId} />
      </div>
    </>
  );
}
