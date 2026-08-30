import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";
import LookupManager from "../../../components/admin-vocabulary/LookupManager";
import StatCard from "../../../components/admin-vocabulary/StatCard";
import { FolderIcon, ListIcon } from "../../../icons";
import {
  Curriculum,
  VocabCategory,
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
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [loadingCurriculums, setLoadingCurriculums] = useState(true);
  const [categories, setCategories] = useState<VocabCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const loadCurriculums = useCallback(async () => {
    setLoadingCurriculums(true);
    try {
      setCurriculums(await fetchCurriculums());
    } finally {
      setLoadingCurriculums(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      setCategories(await fetchCategories());
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    setPageHeader(
      "Giáo trình & Danh mục",
      "Quản lý danh sách bộ giáo trình và danh mục nội dung dùng để phân loại các bộ từ vựng."
    );
  }, [setPageHeader]);

  useEffect(() => {
    loadCurriculums();
    loadCategories();
  }, [loadCurriculums, loadCategories]);

  return (
    <>
      <PageMeta title="Giáo trình & Danh mục | Manabi AI" description="Quản lý bộ giáo trình và danh mục từ vựng." />
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Tổng bộ giáo trình" value={curriculums.length} icon={<FolderIcon />} />
          <StatCard label="Tổng danh mục nội dung" value={categories.length} icon={<ListIcon />} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <LookupManager
            title="Bộ giáo trình"
            hint="Ví dụ: Mimikara Oboeru N2, Shinkanzen Master N3..."
            icon={<FolderIcon />}
            hasDescription
            items={curriculums}
            loading={loadingCurriculums}
            onCreate={async (payload) => {
              await createCurriculum(payload);
              await loadCurriculums();
            }}
            onUpdate={async (id, payload) => {
              await updateCurriculum(id, payload);
              await loadCurriculums();
            }}
            onDelete={async (id) => {
              await deleteCurriculum(id);
              await loadCurriculums();
            }}
          />
          <LookupManager
            title="Danh mục nội dung"
            hint="Ví dụ: Đời sống, Môi trường, Kinh doanh..."
            icon={<ListIcon />}
            items={categories}
            loading={loadingCategories}
            onCreate={async (payload) => {
              await createCategory({ name: payload.name });
              await loadCategories();
            }}
            onUpdate={async (id, payload) => {
              await updateCategory(id, { name: payload.name });
              await loadCategories();
            }}
            onDelete={async (id) => {
              await deleteCategory(id);
              await loadCategories();
            }}
          />
        </div>
      </div>
    </>
  );
}
