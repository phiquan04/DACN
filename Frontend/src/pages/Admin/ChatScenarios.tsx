import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useToast } from "../../context/ToastContext";
import {
  AdminScenario,
  ScenarioPayload,
  createScenario,
  fetchAdminScenarios,
  updateScenario,
} from "../../services/adminScenarioApi";
import ScenarioFormModal from "../../components/admin-chat-scenarios/ScenarioFormModal";
import { PencilIcon, PlusIcon } from "../../icons";

export default function ChatScenarios() {
  const { setPageHeader } = usePageHeader();
  const { showToast } = useToast();

  const [items, setItems] = useState<AdminScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [formTarget, setFormTarget] = useState<AdminScenario | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    setPageHeader("Kịch bản hội thoại", "Quản lý các tình huống nhập vai và form nhập bối cảnh cho từng tình huống.");
  }, [setPageHeader]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchAdminScenarios());
    } catch {
      showToast("Không tải được danh sách tình huống.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (payload: ScenarioPayload) => {
    setSaving(true);
    try {
      if (formTarget && formTarget !== "new") {
        await updateScenario(formTarget.id, payload);
        showToast("Đã cập nhật tình huống.", "success");
      } else {
        await createScenario(payload);
        showToast("Đã tạo tình huống mới.", "success");
      }
      setFormTarget(null);
      await load();
    } catch {
      showToast("Lưu tình huống thất bại.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: AdminScenario) => {
    setTogglingId(item.id);
    try {
      await updateScenario(item.id, { is_active: !item.is_active });
      await load();
    } catch {
      showToast("Không thể cập nhật trạng thái.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <PageMeta title="Kịch bản hội thoại | Manabi AI" description="Quản lý kịch bản hội thoại." />

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {items.length} tình huống · {items.filter((i) => i.is_active).length} đang hiển thị cho người dùng
          </p>
          <button
            type="button"
            onClick={() => setFormTarget("new")}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            <PlusIcon className="h-4 w-4" /> Thêm tình huống
          </button>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {loading && <p className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">Đang tải...</p>}
          {!loading && items.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">Chưa có tình huống nào.</p>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg dark:bg-brand-500/10">
                {item.icon || "💬"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{item.title}</p>
                  {item.level && (
                    <span className="shrink-0 rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                      {item.level}
                    </span>
                  )}
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      item.is_active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {item.is_active ? "Đang hiển thị" : "Đã ẩn"}
                  </span>
                </div>
                {item.description && (
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                )}
                <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                  {item.context_fields.length > 0
                    ? `Form bối cảnh: ${item.context_fields.length} trường`
                    : "Bối cảnh: nhập tự do"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(item)}
                disabled={togglingId === item.id}
                className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {item.is_active ? "Ẩn" : "Hiện"}
              </button>
              <button
                type="button"
                onClick={() => setFormTarget(item)}
                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <PencilIcon className="h-3.5 w-3.5" /> Sửa
              </button>
            </div>
          ))}
        </div>
      </div>

      {formTarget && (
        <ScenarioFormModal
          scenario={formTarget === "new" ? null : formTarget}
          saving={saving}
          onConfirm={handleSubmit}
          onClose={() => setFormTarget(null)}
        />
      )}
    </>
  );
}
