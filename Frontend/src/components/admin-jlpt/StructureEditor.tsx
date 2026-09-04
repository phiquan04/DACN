import { useEffect, useState } from "react";
import { useToast } from "../../context/ToastContext";
import {
  JLPT_LEVELS,
  JlptLevel,
  LevelStructureSummary,
  MondaiTemplate,
  SectionStructure,
  SectionType,
  deleteStructure,
  fetchStructure,
  fetchStructureSummaries,
  saveStructure,
} from "../../services/jlptApi";
import { AlertIcon, PlusIcon, TrashIcon } from "./icons";
import { CheckIcon } from "../../icons/custom";

const SECTION_TYPES: SectionType[] = ["kotoba", "dokkai", "choukai"];

const SECTION_META: Record<SectionType, { glyph: string; title: string; subtitle: string }> = {
  kotoba: { glyph: "語彙", title: "Từ vựng - Ngữ pháp", subtitle: "文字・語彙・文法 (Moji-Goi-Bunpou)" },
  dokkai: { glyph: "読解", title: "Đọc hiểu", subtitle: "読解 (Dokkai)" },
  choukai: { glyph: "聴解", title: "Nghe hiểu", subtitle: "聴解 (Choukai)" },
};

function emptySection(type: SectionType, order: number): SectionStructure {
  return { section_type: type, name: SECTION_META[type].title, order_no: order, time_minutes: null, mondai: [] };
}

function emptyMondai(mondaiNo: number): MondaiTemplate {
  return { mondai_no: mondaiNo, name: "", description: "", tips: "", question_count: null, time_minutes: null };
}

export default function StructureEditor() {
  const { showToast } = useToast();
  const [summaries, setSummaries] = useState<LevelStructureSummary[]>([]);
  const [level, setLevel] = useState<JlptLevel>("N5");
  const [totalTime, setTotalTime] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [sections, setSections] = useState<SectionStructure[]>(
    SECTION_TYPES.map((t, i) => emptySection(t, i + 1))
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  const loadSummaries = async () => {
    setSummaries(await fetchStructureSummaries());
  };

  useEffect(() => {
    loadSummaries();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchStructure(level).then((structure) => {
      if (cancelled) return;
      if (structure) {
        setTotalTime(structure.total_time_minutes ?? "");
        setNotes(structure.notes ?? "");
        const byType = new Map(structure.sections.map((s) => [s.section_type, s]));
        setSections(SECTION_TYPES.map((t, i) => byType.get(t) ?? emptySection(t, i + 1)));
      } else {
        setTotalTime("");
        setNotes("");
        setSections(SECTION_TYPES.map((t, i) => emptySection(t, i + 1)));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [level]);

  const updateSection = (type: SectionType, patch: Partial<SectionStructure>) => {
    setSections((prev) => prev.map((s) => (s.section_type === type ? { ...s, ...patch } : s)));
  };

  const addMondai = (type: SectionType) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.section_type !== type) return s;
        const nextNo = s.mondai.length > 0 ? Math.max(...s.mondai.map((m) => m.mondai_no)) + 1 : 1;
        return { ...s, mondai: [...s.mondai, emptyMondai(nextNo)] };
      })
    );
  };

  const updateMondai = (type: SectionType, mondaiNo: number, patch: Partial<MondaiTemplate>) => {
    setSections((prev) =>
      prev.map((s) =>
        s.section_type !== type
          ? s
          : { ...s, mondai: s.mondai.map((m) => (m.mondai_no === mondaiNo ? { ...m, ...patch } : m)) }
      )
    );
  };

  const removeMondai = (type: SectionType, mondaiNo: number) => {
    setSections((prev) =>
      prev.map((s) =>
        s.section_type !== type ? s : { ...s, mondai: s.mondai.filter((m) => m.mondai_no !== mondaiNo) }
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const nonEmptySections = sections.filter((s) => s.mondai.length > 0 || s.time_minutes);
      await saveStructure(level, {
        total_time_minutes: totalTime === "" ? null : Number(totalTime),
        notes: notes || null,
        sections: nonEmptySections,
      });
      showToast(`Đã lưu cấu trúc đề ${level}`, "success");
      await loadSummaries();
    } catch {
      // errors already reported via the global toast reporter
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Xóa toàn bộ cấu trúc đề ${level}? Hành động này không thể hoàn tác.`)) return;
    try {
      await deleteStructure(level);
      showToast(`Đã xóa cấu trúc đề ${level}`, "success");
      setTotalTime("");
      setNotes("");
      setSections(SECTION_TYPES.map((t, i) => emptySection(t, i + 1)));
      await loadSummaries();
    } catch {
      // reported globally
    }
  };

  const handleCopyFrom = async (sourceLevel: JlptLevel) => {
    setCopying(true);
    try {
      const structure = await fetchStructure(sourceLevel);
      if (!structure) {
        showToast(`Level ${sourceLevel} chưa có cấu trúc để nhân bản`, "error");
        return;
      }
      setTotalTime(structure.total_time_minutes ?? "");
      setNotes(structure.notes ?? "");
      const byType = new Map(structure.sections.map((s) => [s.section_type, s]));
      setSections(
        SECTION_TYPES.map((t, i) => {
          const src = byType.get(t);
          if (!src) return emptySection(t, i + 1);
          return { ...src, id: undefined, mondai: src.mondai.map((m) => ({ ...m, id: undefined })) };
        })
      );
      showToast(`Đã nhân bản cấu trúc từ ${sourceLevel} — bấm "Lưu cấu trúc" để áp dụng cho ${level}`, "success");
    } finally {
      setCopying(false);
    }
  };

  const summaryByLevel = new Map(summaries.map((s) => [s.level, s]));

  const totalQuestions = sections.reduce(
    (sum, s) => sum + s.mondai.reduce((a, m) => a + (m.question_count || 0), 0),
    0
  );
  const totalMondaiCount = sections.reduce((sum, s) => sum + s.mondai.length, 0);
  const configuredTimeSum = sections.reduce(
    (sum, s) => sum + s.mondai.reduce((a, m) => a + (m.time_minutes || 0), 0),
    0
  );
  const numericTotalTime = totalTime === "" ? 0 : Number(totalTime);
  const isBalanced = totalMondaiCount > 0 && numericTotalTime > 0 && configuredTimeSum === numericTotalTime;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {JLPT_LEVELS.map((lv) => {
            const summary = summaryByLevel.get(lv);
            const isActive = lv === level;
            return (
              <button
                key={lv}
                type="button"
                onClick={() => setLevel(lv)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "border border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
                }`}
              >
                {lv}
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    summary?.is_configured ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <select
            value=""
            disabled={copying}
            onChange={(e) => {
              if (e.target.value) handleCopyFrom(e.target.value as JlptLevel);
              e.target.value = "";
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="" disabled>
              {copying ? "Đang nhân bản..." : "Nhân bản từ cấp khác"}
            </option>
            {JLPT_LEVELS.filter((lv) => lv !== level).map((lv) => (
              <option key={lv} value={lv}>
                {lv}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            <CheckIcon className="h-4 w-4" /> {saving ? "Đang lưu..." : "Lưu cấu trúc"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs text-gray-500 dark:text-gray-400">Tổng số câu</p>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">{totalQuestions}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs text-gray-500 dark:text-gray-400">Tổng thời gian</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={totalTime}
                  onChange={(e) => setTotalTime(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                  className="w-16 bg-transparent text-2xl font-bold text-gray-800 outline-none dark:text-white/90"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">phút</span>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs text-gray-500 dark:text-gray-400">Số mondai</p>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">{totalMondaiCount}</p>
            </div>
            <div
              className={`rounded-xl border p-4 shadow-sm ${
                totalMondaiCount === 0
                  ? "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                  : isBalanced
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                  : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
              }`}
            >
              <p
                className={`text-xs ${
                  totalMondaiCount === 0
                    ? "text-gray-500 dark:text-gray-400"
                    : isBalanced
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-700 dark:text-amber-400"
                }`}
              >
                Trạng thái mẫu
              </p>
              <p
                className={`mt-1 flex items-center gap-1.5 text-sm font-bold ${
                  totalMondaiCount === 0
                    ? "text-gray-500 dark:text-gray-400"
                    : isBalanced
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-700 dark:text-amber-400"
                }`}
              >
                {totalMondaiCount > 0 && (isBalanced ? <CheckIcon className="h-3.5 w-3.5" /> : <AlertIcon className="h-3.5 w-3.5" />)}
                {totalMondaiCount === 0
                  ? "Chưa cấu hình"
                  : isBalanced
                  ? `Đã cân đối · ${totalMondaiCount} mondai / ${numericTotalTime} phút`
                  : `Lệch thời gian · ${configuredTimeSum}/${numericTotalTime || "?"} phút`}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Ghi chú chung (tùy chọn)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full max-w-md rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              placeholder="VD: đề tham khảo theo mẫu JLPT chính thức 2023"
            />
          </div>

          {sections.map((section) => {
            const meta = SECTION_META[section.section_type];
            const sectionQuestions = section.mondai.reduce((a, m) => a + (m.question_count || 0), 0);
            const sectionTime = section.mondai.reduce((a, m) => a + (m.time_minutes || 0), 0);
            return (
              <div
                key={section.section_type}
                className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <span
                      lang="ja"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white dark:bg-gray-700"
                    >
                      {meta.glyph}
                    </span>
                    <div>
                      <input
                        type="text"
                        value={section.name}
                        onChange={(e) => updateSection(section.section_type, { name: e.target.value })}
                        className="block rounded-md bg-transparent text-sm font-bold text-gray-800 outline-none focus:bg-gray-50 dark:text-white/90 dark:focus:bg-gray-800"
                      />
                      <p lang="ja" className="text-xs text-gray-400 dark:text-gray-500">
                        {meta.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                      {sectionQuestions} câu · {sectionTime} phút
                    </span>
                    <div className="w-24">
                      <input
                        type="number"
                        min={0}
                        value={section.time_minutes ?? ""}
                        onChange={(e) =>
                          updateSection(section.section_type, {
                            time_minutes: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="Phút"
                        title="Thời gian riêng cho phần này (tùy chọn)"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                      />
                    </div>
                  </div>
                </div>

                {section.mondai.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          <th className="px-4 py-2 font-semibold">Mondai</th>
                          <th className="px-4 py-2 font-semibold">Dạng câu hỏi</th>
                          <th className="w-24 px-4 py-2 font-semibold">Số câu</th>
                          <th className="w-32 px-4 py-2 font-semibold">Thời gian (phút)</th>
                          <th className="w-10 px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {section.mondai.map((m) => (
                          <tr
                            key={m.mondai_no}
                            className="border-t border-gray-100 align-top dark:border-gray-800"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-800 dark:text-white/90">
                              M{m.mondai_no}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Mô tả dạng câu hỏi (VD: Kanji đọc âm)"
                                  value={m.description ?? ""}
                                  onChange={(e) =>
                                    updateMondai(section.section_type, m.mondai_no, { description: e.target.value })
                                  }
                                  className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                                />
                                <input
                                  type="text"
                                  lang="ja"
                                  placeholder="Tên tiếng Nhật (VD: 漢字読み)"
                                  value={m.name ?? ""}
                                  onChange={(e) =>
                                    updateMondai(section.section_type, m.mondai_no, { name: e.target.value })
                                  }
                                  className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                />
                                <input
                                  type="text"
                                  placeholder="Mẹo làm bài (tùy chọn)"
                                  value={m.tips ?? ""}
                                  onChange={(e) =>
                                    updateMondai(section.section_type, m.mondai_no, { tips: e.target.value })
                                  }
                                  className="rounded-lg border border-dashed border-gray-200 bg-transparent px-2.5 py-1.5 text-xs text-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:text-gray-500"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min={0}
                                value={m.question_count ?? ""}
                                onChange={(e) =>
                                  updateMondai(section.section_type, m.mondai_no, {
                                    question_count: e.target.value === "" ? null : Number(e.target.value),
                                  })
                                }
                                className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min={0}
                                value={m.time_minutes ?? ""}
                                onChange={(e) =>
                                  updateMondai(section.section_type, m.mondai_no, {
                                    time_minutes: e.target.value === "" ? null : Number(e.target.value),
                                  })
                                }
                                className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => removeMondai(section.section_type, m.mondai_no)}
                                className="text-gray-400 hover:text-error-500"
                                title="Xóa mondai"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="p-4 pt-3">
                  <button
                    type="button"
                    onClick={() => addMondai(section.section_type)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:border-teal-500 hover:text-teal-600 dark:border-gray-600 dark:text-gray-400 dark:hover:text-teal-400"
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> Thêm mondai vào {meta.title}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-sm font-medium text-error-500 hover:text-error-600 hover:underline"
            >
              <TrashIcon className="h-4 w-4" /> Xóa toàn bộ cấu trúc đề {level}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
