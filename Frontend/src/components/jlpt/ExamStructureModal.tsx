import { useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import { JlptLevel, LevelStructure, SECTION_LABELS, fetchStructure } from "../../services/jlptApi";

export default function ExamStructureModal({ level, onClose }: { level: JlptLevel; onClose: () => void }) {
  const [structure, setStructure] = useState<LevelStructure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchStructure(level)
      .then(setStructure)
      .finally(() => setLoading(false));
  }, [level]);

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-w-lg p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Cấu trúc đề {level}</h2>

      {loading && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
      {!loading && !structure && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Chưa có cấu trúc cho level này.</p>
      )}

      {structure && (
        <div className="mt-3 flex flex-col gap-3">
          {structure.total_time_minutes && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tổng thời lượng: {structure.total_time_minutes} phút
            </p>
          )}
          {structure.sections.map((s) => (
            <div key={s.section_type} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {SECTION_LABELS[s.section_type]}
                {s.time_minutes ? ` · ${s.time_minutes} phút` : ""}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {s.mondai.map((m) => (
                  <div key={m.mondai_no} className="flex items-center justify-between text-xs">
                    <span lang="ja" className="text-gray-600 dark:text-gray-300">
                      問題{m.mondai_no} {m.name ? `— ${m.name}` : ""}
                    </span>
                    <span className="shrink-0 text-gray-400 dark:text-gray-500">
                      {m.question_count ? `${m.question_count} câu` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Đóng
        </button>
      </div>
    </Modal>
  );
}
