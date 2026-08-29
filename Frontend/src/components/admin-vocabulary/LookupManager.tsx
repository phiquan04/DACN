import { useEffect, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { PencilIcon, PlusIcon, TrashIcon } from "../admin-jlpt/icons";

export interface LookupItem {
  id: number;
  name: string;
  description?: string | null;
  set_count: number;
}

interface Props {
  title: string;
  hint: string;
  /** Category has no free-text description (only name + auto slug); curriculum does. */
  hasDescription?: boolean;
  fetchItems: () => Promise<LookupItem[]>;
  onCreate: (payload: { name: string; description?: string }) => Promise<LookupItem>;
  onUpdate: (id: number, payload: { name?: string; description?: string }) => Promise<LookupItem>;
  onDelete: (id: number) => Promise<void>;
}

/** Shared list+CRUD UI for the two vocabulary lookup tables (curriculum,
 * category) — both are simple name(+description) lists reused across many
 * vocabulary sets, so admins manage them here instead of free-typing on
 * every import. */
export default function LookupManager({ title, hint, hasDescription, fetchItems, onCreate, onUpdate, onDelete }: Props) {
  const { showToast } = useToast();
  const [items, setItems] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setItems(await fetchItems());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetCreateForm = () => {
    setCreating(false);
    setNewName("");
    setNewDescription("");
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onCreate({ name: newName.trim(), description: newDescription || undefined });
      showToast("Đã thêm mới", "success");
      resetCreateForm();
      await load();
    } catch {
      // reported globally
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: LookupItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description ?? "");
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await onUpdate(id, { name: editName.trim(), description: editDescription || undefined });
      showToast("Đã lưu", "success");
      setEditingId(null);
      await load();
    } catch {
      // reported globally
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: LookupItem) => {
    if (item.set_count > 0) {
      showToast(`Không thể xóa vì đang được ${item.set_count} bộ từ vựng sử dụng`, "warning");
      return;
    }
    if (!window.confirm(`Xóa "${item.name}"?`)) return;
    try {
      await onDelete(item.id);
      showToast("Đã xóa", "success");
      await load();
    } catch {
      // reported globally
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Thêm mới
        </button>
      </div>

      {creating && (
        <div className="border-b border-dashed border-teal-300 bg-teal-50/30 p-4 dark:border-teal-500/40 dark:bg-teal-500/5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên"
            className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
          />
          {hasDescription && (
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              placeholder="Mô tả (tùy chọn)"
              className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            />
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetCreateForm}
              disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5 p-4">
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có dữ liệu.</p>
        )}
        {items.map((item) =>
          editingId === item.id ? (
            <div
              key={item.id}
              className="rounded-lg border border-teal-300 bg-teal-50/30 p-3 dark:border-teal-500/40 dark:bg-teal-500/5"
            >
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              />
              {hasDescription && (
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                />
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate(item.id)}
                  disabled={saving || !editName.trim()}
                  className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          ) : (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3.5 py-2.5 transition hover:border-teal-500 dark:border-gray-700"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{item.name}</p>
                {item.description && (
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {item.set_count} bộ từ vựng
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="text-gray-400 hover:text-brand-500"
                  title="Sửa"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  className="text-gray-400 hover:text-rose-500"
                  title="Xóa"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
