import { useEffect, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { ExamSchedule, JlptLevel, UpcomingExam, fetchSchedules, saveExamPlan } from "../../services/jlptApi";
import { CalenderIcon, TimeIcon } from "../../icons";

const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const LOCATIONS = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Huế", "Cần Thơ", "Hải Phòng"];

function formatVietnameseDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${WEEKDAYS[d.getDay()]} ${dd}/${mm}/${d.getFullYear()}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function PickTargetExam({ level, onSaved }: { level: JlptLevel; onSaved: () => void }) {
  const { showToast } = useToast();
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [scheduleId, setScheduleId] = useState<number | "">("");
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchedules(level).then((list) => {
      setSchedules(list);
      if (list.length > 0) setScheduleId(list[0].id);
    });
  }, [level]);

  const handleSave = async () => {
    if (!scheduleId) return;
    setSaving(true);
    try {
      await saveExamPlan({ level, schedule_id: scheduleId, location });
      onSaved();
    } catch {
      showToast("Không thể lưu kỳ thi mục tiêu", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col justify-center gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Chọn kỳ thi mục tiêu</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Chọn kỳ thi {level} bạn đang hướng tới để theo dõi tiến độ ôn luyện.
      </p>
      {schedules.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">Chưa có lịch thi sắp tới.</p>
      ) : (
        <>
          <select
            value={scheduleId}
            onChange={(e) => setScheduleId(Number(e.target.value))}
            className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-400/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {formatVietnameseDate(s.exam_date)}
              </option>
            ))}
          </select>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-400/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-11 rounded-lg bg-brand-500 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu mục tiêu"}
          </button>
        </>
      )}
    </div>
  );
}

export default function UpcomingExamCard({
  level,
  upcoming,
  totalTimeMinutes,
  onChanged,
}: {
  level: JlptLevel;
  upcoming: UpcomingExam | null;
  totalTimeMinutes?: number | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!upcoming || editing) {
    return <PickTargetExam level={level} onSaved={() => { setEditing(false); onChanged(); }} />;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Kỳ thi sắp tới
        </p>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          <TimeIcon className="h-3 w-3" />
          Còn {upcoming.days_left} ngày
        </span>
      </div>

      <p className="mt-2 text-base font-semibold text-gray-800 dark:text-white/90">
        {formatVietnameseDate(upcoming.schedule.exam_date)} · {level}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-gray-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Hạn đăng ký (ước tính)
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
            <CalenderIcon className="h-3.5 w-3.5 shrink-0" />
            {formatShortDate(upcoming.schedule.registration_deadline)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-gray-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Địa điểm đã chọn</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-gray-700 dark:text-gray-200">
            {upcoming.location ?? "Chưa chọn"}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-gray-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Thời lượng đề</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
            {totalTimeMinutes ? `${totalTimeMinutes} phút` : "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
        {upcoming.study_pace_message}
      </div>

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-2 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
      >
        Đổi kỳ thi mục tiêu
      </button>
    </div>
  );
}
