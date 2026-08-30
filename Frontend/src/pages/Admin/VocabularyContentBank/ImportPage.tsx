import { useEffect } from "react";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";
import ImportVocabularySetPanel from "../../../components/admin-vocabulary/ImportVocabularySetPanel";

export default function ImportPage() {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      "Import bộ từ vựng",
      "Tải lên file PDF từ vựng để AI tách từ, tự sinh nghĩa/câu ví dụ nếu file gốc chưa có."
    );
  }, [setPageHeader]);

  return (
    <>
      <PageMeta title="Import bộ từ vựng | Manabi AI" description="Import bộ từ vựng JLPT từ file PDF." />
      <div className="space-y-5">
        <ImportVocabularySetPanel />
      </div>
    </>
  );
}
