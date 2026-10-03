import { useEffect, useState } from "react";
import {
  BoxIconLine, CheckCircleIcon, ChevronLeftIcon, ListIcon, PlusIcon, TaskIcon, TrashBinIcon,
} from "../../icons";
import {
  MyCurriculum, MySet, createMySet, deleteMyCurriculum,
} from "../../services/vocabularyLearningApi";
import { CreateModal } from "./MyVocabularyShared";
import ProgressBar from "./ProgressBar";

export default function MyCurriculumDetailView({
  curriculum,
  onBack,
  onOpenSet,
  onDeleted,
}: {
  curriculum: MyCurriculum;
  onBack: () => void;
  onOpenSet: (set: MySet) => void;
  onDeleted: () => void;
}) {
  const [sets, setSets] = useState<MySet[]>(curriculum.sets);
  const [showCreateSet, setShowCreateSet] = useState(false);

  // The parent refetches the curriculum when the learner comes back from a
  // bài (see VocabularyLearningHome.handleBackFromMySet), and that response
  // lands after this view has already mounted with the old snapshot — follow
  // the prop so new/deleted bài and updated counts actually show up.
  useEffect(() => {
    setSets(curriculum.sets);
  }, [curriculum.sets]);

  const totalLearnedWords = sets.reduce((acc, s) => acc + s.learned_count, 0);
  const totalReviewingWords = sets.reduce((acc, s) => acc + s.reviewing_count, 0);
  const totalTouchedWords = totalLearnedWords + totalReviewingWords;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Quay lại thư viện
      </button>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white/90">{curriculum.name}</h2>
        <button
          type="button"
          onClick={() => setShowCreateSet(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-xs font-medium text-white hover:from-brand-600 hover:to-brand-700"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Thêm danh mục
        </button>
      </div>
      {curriculum.description && (
        <p className="-mt-3 text-sm text-gray-500 dark:text-gray-400">{curriculum.description}</p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ===== LEFT: all "bài" in this bộ ===== */}
        <div className="flex flex-col gap-2.5 lg:col-span-2">
          {sets.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Bộ này chưa có danh mục nào. Bấm "Thêm danh mục" để tạo (vd. Bài 1).
            </p>
          )}
          {sets.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-500 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{s.set_name}</span>
                </div>
                {s.description && (
                  <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{s.description}</p>
                )}
                <div className="mt-2 flex max-w-xs items-center gap-2">
                  <div className="flex-1">
                    <ProgressBar learned={s.learned_count} reviewing={s.reviewing_count} total={s.item_count} />
                  </div>
                  <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{s.item_count} từ</span>
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {s.learned_count} thuộc
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {s.reviewing_count} cần ôn
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" /> {s.new_count} mới
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenSet(s)}
                className="shrink-0 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-xs font-medium text-white hover:from-brand-600 hover:to-brand-700"
              >
                Xem từ vựng
              </button>
            </div>
          ))}
        </div>

        {/* ===== RIGHT: bộ summary ===== */}
        <div className="space-y-5">
          <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <BoxIconLine className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold">Tổng kết bộ từ vựng</h3>
            </div>
            <p className="text-4xl font-bold">{sets.length}</p>
            <p className="mt-1 text-sm text-white/80">danh mục trong bộ này</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <ListIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Tổng số từ đã học</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">{totalTouchedWords} từ</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircleIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Đã thuộc</span>
              </div>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">{totalLearnedWords} từ</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <TaskIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Cần ôn</span>
              </div>
              <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-300">{totalReviewingWords} từ</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Chú thích tiến độ</h3>
            <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                Đã thuộc
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" />
                Cần ôn
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                Từ mới
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">Quản lý bộ</h3>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Xóa bộ sẽ xóa luôn toàn bộ danh mục và từ vựng bên trong.
            </p>
            <button
              type="button"
              onClick={async () => {
                if (
                  !window.confirm(
                    `Xóa bộ "${curriculum.name}"? Toàn bộ danh mục, từ vựng và tiến độ học bên trong sẽ bị xóa vĩnh viễn.`
                  )
                )
                  return;
                await deleteMyCurriculum(curriculum.id);
                onDeleted();
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-600"
            >
              <TrashBinIcon className="h-3.5 w-3.5" /> Xóa bộ này
            </button>
          </div>
        </div>
      </div>

      {showCreateSet && (
        <CreateModal
          title="Thêm danh mục (vd. Bài 1)"
          nameLabel="Tên danh mục"
          onCancel={() => setShowCreateSet(false)}
          onSubmit={async (name, description) => {
            const created = await createMySet(curriculum.id, name, description || undefined);
            setSets((prev) => [...prev, created]);
            setShowCreateSet(false);
            onOpenSet(created);
          }}
        />
      )}
    </div>
  );
}
