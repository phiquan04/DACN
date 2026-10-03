import { useEffect, useState } from "react";
import { MyCurriculum, createMyCurriculum, fetchMyCurriculums } from "../../services/vocabularyLearningApi";
import { FolderIcon } from "../../icons";
import { CreateModal, NewCardButton } from "./MyVocabularyShared";
import ProgressBar from "./ProgressBar";

export default function MyVocabularyPanel({ onOpenCurriculum }: { onOpenCurriculum: (curriculum: MyCurriculum) => void }) {
  const [curriculums, setCurriculums] = useState<MyCurriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchMyCurriculums()
      .then(setCurriculums)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>;

  return (
    <div className="space-y-4">
      {curriculums.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Bạn chưa có bộ từ vựng nào do mình tạo. Bấm "Tạo bộ mới" để bắt đầu.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {curriculums.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpenCurriculum(c)}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-500 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                <FolderIcon className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{c.name}</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {c.sets.length} bộ · {c.item_count} từ
            </p>
            <div>
              <ProgressBar learned={c.learned_count} reviewing={c.reviewing_count} total={c.item_count} />
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {c.learned_count} thuộc
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {c.reviewing_count} cần ôn
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" /> {c.new_count} mới
                </span>
              </div>
            </div>
          </button>
        ))}
        <NewCardButton
          label="Tạo bộ mới"
          subtitle="Thêm từ vựng của riêng bạn"
          onClick={() => setShowCreate(true)}
        />
      </div>

      {showCreate && (
        <CreateModal
          title="Tạo bộ từ vựng mới"
          nameLabel="Tên bộ từ vựng"
          onCancel={() => setShowCreate(false)}
          onSubmit={async (name, description) => {
            const created = await createMyCurriculum(name, description || undefined);
            setCurriculums((prev) => [created, ...prev]);
            setShowCreate(false);
            onOpenCurriculum(created);
          }}
        />
      )}
    </div>
  );
}
