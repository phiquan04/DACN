import { useEffect } from "react";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";
import VocabularyTabs from "../../../components/admin-vocabulary/VocabularyTabs";
import LookupManager from "../../../components/admin-vocabulary/LookupManager";
import {
  createCategory,
  createCurriculum,
  deleteCategory,
  deleteCurriculum,
  fetchCategories,
  fetchCurriculums,
  updateCategory,
  updateCurriculum,
} from "../../../services/vocabularyApi";

export default function LookupsPage() {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      "Giáo trình & Danh mục",
      "Quản lý danh sách bộ giáo trình và danh mục nội dung dùng để phân loại các bộ từ vựng."
    );
  }, [setPageHeader]);

  return (
    <>
      <PageMeta title="Giáo trình & Danh mục | Manabi AI" description="Quản lý bộ giáo trình và danh mục từ vựng." />
      <div className="space-y-5">
        <VocabularyTabs current="Giáo trình & Danh mục" />
        <div className="grid gap-5 lg:grid-cols-2">
          <LookupManager
            title="Bộ giáo trình"
            hint="Ví dụ: Mimikara Oboeru N2, Shinkanzen Master N3..."
            hasDescription
            fetchItems={fetchCurriculums}
            onCreate={createCurriculum}
            onUpdate={updateCurriculum}
            onDelete={deleteCurriculum}
          />
          <LookupManager
            title="Danh mục nội dung"
            hint="Ví dụ: Đời sống, Môi trường, Kinh doanh..."
            fetchItems={fetchCategories}
            onCreate={createCategory}
            onUpdate={updateCategory}
            onDelete={deleteCategory}
          />
        </div>
      </div>
    </>
  );
}
