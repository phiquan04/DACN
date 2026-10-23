import { useEffect } from "react";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";
import ImportGrammarSetPanel from "../../../components/admin-grammar/ImportGrammarSetPanel";

export default function ImportPage() {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      "Import bộ ngữ pháp",
      "Tải lên file PDF ngữ pháp để AI tách mẫu câu, tự sinh nghĩa/câu ví dụ nếu file gốc chưa có."
    );
  }, [setPageHeader]);

  return (
    <>
      <PageMeta title="Import bộ ngữ pháp | Manabi AI" description="Import bộ ngữ pháp JLPT từ file PDF." />
      <div className="space-y-5">
        <ImportGrammarSetPanel />
      </div>
    </>
  );
}
