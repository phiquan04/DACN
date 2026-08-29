import { useEffect } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";
import VocabularyTabs from "../../../components/admin-vocabulary/VocabularyTabs";
import ImportVocabularySetPanel from "../../../components/admin-vocabulary/ImportVocabularySetPanel";

export default function ImportPage() {
  const { setPageHeader } = usePageHeader();
  const navigate = useNavigate();

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
        <VocabularyTabs current="Import bộ từ vựng" />
        <ImportVocabularySetPanel onImported={(setId) => navigate(`/admin/vocabulary-content/review?setId=${setId}`)} />
      </div>
    </>
  );
}
