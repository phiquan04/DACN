import { useEffect, useState } from "react";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useToast } from "../../context/ToastContext";
import { getReminderSettings, updateReminderSettings } from "../../services/userApi";

const MAX_TIMES = 5;

/** "HH:MM:SS" (from the backend) -> "HH:MM" (what an <input type="time"> wants). */
function toInputTime(value: string): string {
  return value.slice(0, 5);
}

/** Opt-in toggle plus up to 5 time-of-day slots for study-reminder emails.
 * Mirrors the wording promised in the welcome email sent at signup ("vào Hồ
 * sơ cá nhân để đặt lịch nhắc nhở"). */
export default function ReminderSettingsCard() {
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [times, setTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getReminderSettings()
      .then((data) => {
        if (cancelled) return;
        setEnabled(data.enabled);
        setTimes(data.times.map(toInputTime));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddTime = () => {
    if (times.length >= MAX_TIMES) return;
    setTimes([...times, "20:00"]);
  };

  const handleChangeTime = (index: number, value: string) => {
    setTimes(times.map((t, i) => (i === index ? value : t)));
  };

  const handleRemoveTime = (index: number) => {
    setTimes(times.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateReminderSettings({ enabled, times });
      setEnabled(result.enabled);
      setTimes(result.times.map(toInputTime));
      showToast("Đã lưu cài đặt nhắc nhở học tập.", "success");
    } catch {
      // reported globally by the http client
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">Nhắc nhở học tập qua email</h4>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Chọn tối đa {MAX_TIMES} mốc giờ trong ngày để nhận email nhắc bạn vào học.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 p-0 transition-colors duration-150 focus:outline-none focus-visible:ring-3 focus-visible:ring-brand-400/40 ${
            enabled ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          <span
            className={`absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-150 ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-5 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          {times.map((t, index) => (
            <div key={index} className="flex items-end gap-3">
              <div className="w-40">
                <Label>Mốc giờ {index + 1}</Label>
                <Input type="time" value={t} onChange={(e) => handleChangeTime(index, e.target.value)} />
              </div>
              <Button size="sm" variant="outline" onClick={() => handleRemoveTime(index)}>
                Xóa
              </Button>
            </div>
          ))}

          {times.length < MAX_TIMES && (
            <Button size="sm" variant="outline" onClick={handleAddTime}>
              Thêm mốc giờ
            </Button>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </Button>
      </div>
    </div>
  );
}
