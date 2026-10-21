import { useState } from "react";
import {
  GrammarCurriculum,
  GrammarCategory,
  GrammarSetPatch,
  GrammarSetSummary,
} from "../../services/grammarContentApi";
import { LockIcon, PencilIcon, TrashIcon, UnlockIcon } from "../admin-jlpt/icons";
import { formatApiDate } from "../../utils/datetime";

const STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  processing: "Đang xử lý",
  failed: "Lỗi",
  published: "Đã publish",
};

const STATUS_STYLES: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  draft: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}


interface Props {
  set: GrammarSetSummary;
  curriculums: GrammarCurriculum[];
  categories: GrammarCategory[];
  onOpen: () => void;
  onUpdate: (patch: GrammarSetPatch) => Promise<void>;
  onToggleLock: () => Promise<void>;
  onDelete: () => void;
}

export default function GrammarSetRow({ set, curriculums, categories, onOpen, onUpdate, onToggleLock, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [setName, setSetName] = useState(set.set_name);
  const [description, setDescription] = useState(set.description ?? "");
  const [curriculumId, setCurriculumId] = useState<number | "">(set.curriculum_id ?? "");
  const [categoryId, setCategoryId] = useState<number | "">(set.category_id ?? "");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSetName(set.set_name);
    setDescription(set.description ?? "");
    setCurriculumId(set.curriculum_id ?? "");
    setCategoryId(set.category_id ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!setName.trim()) return;
    setSaving(true);
    try {
      await onUpdate({
        set_name: setName.trim(),
        description: description.trim() || null,
        curriculum_id: curriculumId === "" ? null : curriculumId,
        category_id: categoryId === "" ? null : categoryId,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    try {
      await onToggleLock();
    } finally {
      setToggling(false);
    }
  };

  if (editing) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl border border-teal-300 bg-teal-50/30 p-4 dark:border-teal-500/40 dark:bg-teal-500/5"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Tên bộ ngữ pháp</label>
            <input
              type="text"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Bộ giáo trình</label>
            <select
              value={curriculumId}
              onChange={(e) => setCurriculumId(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            >
              <option value="">— Không chọn —</option>
              {curriculums.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Danh mục nội dung</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            >
              <option value="">— Không chọn —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Mô tả</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !setName.trim()}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => set.status !== "processing" && onOpen()}
      role="button"
      tabIndex={0}
      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-500 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="min-w-0 flex-1 cursor-pointer">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{set.set_name}</span>
          <StatusBadge status={set.status} />
          {set.is_locked && (
            <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
              <LockIcon className="h-2.5 w-2.5" /> Đã khóa
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {set.level}
          {set.curriculum_name && ` · ${set.curriculum_name}`}
          {set.category_name && ` · ${set.category_name}`} · {set.reviewed_count}/{set.item_count} mẫu đã duyệt
        </p>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          Tạo: {formatApiDate(set.created_at)} · Sửa: {formatApiDate(set.updated_at)}
        </p>
        {set.status === "failed" && set.error_message && (
          <p className="mt-1 truncate text-xs text-rose-600 dark:text-rose-400" title={set.error_message}>
            {set.error_message}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={handleToggleLock}
          disabled={toggling}
          title={set.is_locked ? "Mở khóa (hiện lại cho học viên)" : "Khóa (ẩn khỏi học viên)"}
          className={`disabled:opacity-60 ${
            set.is_locked ? "text-emerald-500 hover:text-emerald-600" : "text-gray-400 hover:text-rose-500"
          }`}
        >
          {set.is_locked ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={startEdit}
          title="Sửa bộ ngữ pháp"
          className="text-gray-400 hover:text-brand-500"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Xóa bộ ngữ pháp"
          className="text-gray-400 hover:text-error-500"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
