import { useCallback, useEffect, useMemo, useState } from "react";
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
import ScenarioCard from "../../components/admin-chat-scenarios/ScenarioCard";
import StatCard from "../../components/admin-vocabulary/StatCard";
import { PlusIcon, ChatIcon, CheckCircleIcon, TaskIcon } from "../../icons";
import { SearchIcon, EyeOffIcon } from "../../icons/custom";
import { ADMIN_PRIMARY_GRADIENT } from "../../utils/adminStyles";

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

type StatusFilter = "" | "active" | "inactive";

export default function ChatScenarios() {
  const { setPageHeader } = usePageHeader();
  const { showToast } = useToast();

  const [items, setItems] = useState<AdminScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [formTarget, setFormTarget] = useState<AdminScenario | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");

  useEffect(() => {
    setPageHeader("Kịch bản chat", "Thiết kế các tình huống hội thoại giúp học viên luyện tập thực tế.");
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

  const activeCount = items.filter((i) => i.is_active).length;
  const withContextFormCount = items.filter((i) => i.context_fields.length > 0).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !i.title.toLowerCase().includes(q) && !(i.description ?? "").toLowerCase().includes(q)) return false;
      if (level && i.level !== level) return false;
      if (status === "active" && !i.is_active) return false;
      if (status === "inactive" && i.is_active) return false;
      return true;
    });
  }, [items, search, level, status]);

  return (
    <>
      <PageMeta title="Kịch bản chat | Manabi AI" description="Quản lý kịch bản hội thoại." />

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-admin-body">
            Thiết kế các tình huống hội thoại giúp học viên luyện tập thực tế.
          </p>
          <button
            type="button"
            onClick={() => setFormTarget("new")}
            className={`flex items-center gap-1.5 rounded-[9px] px-4 py-2.5 text-sm font-medium text-white shadow-[0_5px_12px_rgba(49,93,206,0.22)] ${ADMIN_PRIMARY_GRADIENT}`}
          >
            <PlusIcon className="h-4 w-4" /> Tạo kịch bản
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tổng kịch bản" value={items.length} icon={<ChatIcon />} tone="neutral" />
          <StatCard label="Đang hiển thị" value={activeCount} icon={<CheckCircleIcon />} tone="success" />
          <StatCard label="Đã ẩn" value={items.length - activeCount} icon={<EyeOffIcon />} tone="pending" />
          <StatCard label="Có form bối cảnh" value={withContextFormCount} icon={<TaskIcon />} tone="info" />
        </div>

        <div className="rounded-2xl border border-admin-border bg-white shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-border p-4">
            <div className="relative w-full max-w-xs">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-body" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm kịch bản..."
                className="w-full rounded-[9px] border border-admin-border-input bg-admin-fill py-2.5 pl-10 pr-3.5 text-sm text-admin-ink outline-none placeholder:text-admin-meta focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="rounded-[9px] border border-admin-border-input bg-white px-3.5 py-2.5 text-sm text-admin-body outline-none focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
              >
                <option value="">Tất cả cấp độ</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                className="rounded-[9px] border border-admin-border-input bg-white px-3.5 py-2.5 text-sm text-admin-body outline-none focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang hiển thị</option>
                <option value="inactive">Đã ẩn</option>
              </select>
            </div>
          </div>

          <div className="p-5">
            {loading && <p className="py-10 text-center text-sm text-admin-meta">Đang tải...</p>}
            {!loading && items.length === 0 && (
              <p className="py-10 text-center text-sm text-admin-meta">Chưa có tình huống nào.</p>
            )}
            {!loading && items.length > 0 && filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-admin-meta">Không tìm thấy kịch bản phù hợp.</p>
            )}
            {filtered.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {filtered.map((item, index) => (
                  <ScenarioCard
                    key={item.id}
                    scenario={item}
                    index={index}
                    toggling={togglingId === item.id}
                    onToggle={() => toggleActive(item)}
                    onEdit={() => setFormTarget(item)}
                  />
                ))}
              </div>
            )}
          </div>
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
