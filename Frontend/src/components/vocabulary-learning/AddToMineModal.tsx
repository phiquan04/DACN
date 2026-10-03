import { useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import { FolderIcon } from "../../icons";
import { MyCurriculum, fetchMyCurriculums } from "../../services/vocabularyLearningApi";

export default function AddToMineModal({
  onPick,
  onClose,
}: {
  /** Adds the word to the chosen 'bài' (VocabularySet id) — either copyItemToMine (an
   * existing public VocabularyItem, e.g. from a study session) or createMyItem (a word
   * built from dictionary-lookup data, which has no VocabularyItem id of its own). */
  onPick: (setId: number) => Promise<unknown>;
  onClose: () => void;
}) {
  const [curriculums, setCurriculums] = useState<MyCurriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedSetId, setAddedSetId] = useState<number | null>(null);

  useEffect(() => {
    fetchMyCurriculums()
      .then(setCurriculums)
      .finally(() => setLoading(false));
  }, []);

  const handlePick = async (setId: number) => {
    try {
      await onPick(setId);
      setAddedSetId(setId);
    } catch {
      // reported globally by the http client
    }
  };

  return (
    <Modal isOpen onClose={onClose} className="max-w-md p-6">
      <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">Thêm vào bộ của tôi</h3>

      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}

      {!loading && curriculums.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Bạn chưa có bộ từ vựng nào. Hãy tạo một bộ ở tab "Bộ từ của tôi" trước.
        </p>
      )}

      <div className="max-h-80 space-y-4 overflow-y-auto">
        {curriculums.map((c) => (
          <div key={c.id}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {c.name}
            </p>
            {c.sets.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">Chưa có danh mục nào</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {c.sets.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handlePick(s.id)}
                    disabled={addedSetId === s.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      addedSetId === s.id
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "border-gray-200 text-gray-700 hover:border-teal-400 dark:border-gray-700 dark:text-gray-200"
                    }`}
                  >
                    <FolderIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{s.set_name}</span>
                    {addedSetId === s.id && <span className="ml-auto shrink-0 text-xs">Đã thêm</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
