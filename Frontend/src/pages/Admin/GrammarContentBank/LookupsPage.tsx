import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";
import LookupManager from "../../../components/admin-vocabulary/LookupManager";
import StatCard from "../../../components/admin-vocabulary/StatCard";
import { FolderIcon, ListIcon } from "../../../icons";
import {
  GrammarCurriculum,
  GrammarCategory,
  createGrammarCategory,
  createGrammarCurriculum,
  deleteGrammarCategory,
  deleteGrammarCurriculum,
  fetchGrammarCategories,
  fetchGrammarCurriculums,
  updateGrammarCategory,
  updateGrammarCurriculum,
} from "../../../services/grammarContentApi";

export default function LookupsPage() {
  const { setPageHeader } = usePageHeader();
  const [curriculums, setCurriculums] = useState<GrammarCurriculum[]>([]);
  const [loadingCurriculums, setLoadingCurriculums] = useState(true);
  const [categories, setCategories] = useState<GrammarCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const loadCurriculums = useCallback(async () => {
    setLoadingCurriculums(true);
    try {
      setCurriculums(await fetchGrammarCurriculums());
    } finally {
      setLoadingCurriculums(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      setCategories(await fetchGrammarCategories());
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    setPageHeader(
      "Giáo trình & Danh mục",
      "Quản lý danh sách bộ giáo trình và danh mục nội dung dùng để phân loại các bộ ngữ pháp."
    );
  }, [setPageHeader]);

  useEffect(() => {
    loadCurriculums();
    loadCategories();
  }, [loadCurriculums, loadCategories]);

  return (
    <>
      <PageMeta title="Giáo trình & Danh mục | Manabi AI" description="Quản lý bộ giáo trình và danh mục ngữ pháp." />
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Tổng bộ giáo trình" value={curriculums.length} icon={<FolderIcon />} />
          <StatCard label="Tổng danh mục nội dung" value={categories.length} icon={<ListIcon />} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <LookupManager
            title="Bộ giáo trình"
            hint="Ví dụ: Shinkanzen Master N3 Ngữ pháp, Try N4..."
            icon={<FolderIcon />}
            hasDescription
            items={curriculums}
            loading={loadingCurriculums}
            onCreate={async (payload) => {
              await createGrammarCurriculum(payload);
              await loadCurriculums();
            }}
            onUpdate={async (id, payload) => {
              await updateGrammarCurriculum(id, payload);
              await loadCurriculums();
            }}
            onDelete={async (id) => {
              await deleteGrammarCurriculum(id);
              await loadCurriculums();
            }}
          />
          <LookupManager
            title="Danh mục nội dung"
            hint="Ví dụ: Ngữ pháp giao tiếp, Ngữ pháp văn viết..."
            icon={<ListIcon />}
            items={categories}
            loading={loadingCategories}
            onCreate={async (payload) => {
              await createGrammarCategory({ name: payload.name });
              await loadCategories();
            }}
            onUpdate={async (id, payload) => {
              await updateGrammarCategory(id, { name: payload.name });
              await loadCategories();
            }}
            onDelete={async (id) => {
              await deleteGrammarCategory(id);
              await loadCategories();
            }}
          />
        </div>
      </div>
    </>
  );
}
