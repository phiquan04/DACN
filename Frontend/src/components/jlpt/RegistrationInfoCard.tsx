import { useEffect, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { ExamSchedule, JlptLevel, UpcomingExam, fetchSchedules, saveExamPlan } from "../../services/jlptApi";
import { CalenderIcon, TimeIcon } from "../../icons";
import { FlagIcon, GlobeIcon } from "../../icons/custom";
import { formatShortDate, formatVietnameseDate } from "./dateFormat";

const LOCATIONS = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Huế", "Cần Thơ", "Hải Phòng"];

function PickTargetExam({
  level,
  initialScheduleId,
  initialLocation,
  onSaved,
}: {
  level: JlptLevel;
  initialScheduleId?: number;
  initialLocation?: string | null;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [scheduleId, setScheduleId] = useState<number | "">(initialScheduleId ?? "");
  const [location, setLocation] = useState(initialLocation || LOCATIONS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchedules(level).then((list) => {
      setSchedules(list);
      setScheduleId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        return list.length > 0 ? list[0].id : "";
      });
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
      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <FlagIcon className="h-4 w-4 text-brand-500" />
        Kỳ thi mục tiêu
      </p>
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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-300">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
        <p className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">{value}</p>
      </div>
    </div>
  );
}

export default function RegistrationInfoCard({
  level,
  upcoming,
  onChanged,
}: {
  level: JlptLevel;
  upcoming: UpcomingExam | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!upcoming || editing) {
    return (
      <PickTargetExam
        level={level}
        initialScheduleId={upcoming?.schedule.id}
        initialLocation={upcoming?.location}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <FlagIcon className="h-4.5 w-4.5" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Kỳ thi mục tiêu
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          <TimeIcon className="h-3 w-3" />
          Còn {upcoming.days_left} ngày
        </span>
      </div>

      <p className="mt-2.5 flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-white/90">
        {formatVietnameseDate(upcoming.schedule.exam_date)}
        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
          {level}
        </span>
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <InfoRow
          icon={<CalenderIcon className="h-3.5 w-3.5" />}
          label="Hạn đăng ký (ước tính)"
          value={formatShortDate(upcoming.schedule.registration_deadline)}
        />
        <InfoRow icon={<GlobeIcon className="h-3.5 w-3.5" />} label="Địa điểm" value={upcoming.location ?? "Chưa chọn"} />
      </div>

      <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
        {upcoming.study_pace_message}
      </div>

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-auto pt-2 text-left text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
      >
        Đổi kỳ thi mục tiêu
      </button>
    </div>
  );
}
