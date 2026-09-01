import { useState } from "react";
import { Modal } from "../ui/modal";
import { AdminUserDetail, UpdateUserPayload } from "../../services/adminUserApi";
import { GlobeIcon, PhoneIcon } from "../../icons/custom";
import { CalenderIcon, DocsIcon, GroupIcon, TaskIcon, UserCircleIcon, UserIcon } from "../../icons";

interface Props {
  user: AdminUserDetail;
  isSelf: boolean;
  saving: boolean;
  onConfirm: (payload: UpdateUserPayload) => void;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90 disabled:opacity-50";
const labelClass = "mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 [&>svg]:h-3.5 [&>svg]:w-3.5";

export default function EditUserModal({ user, isSelf, saving, onConfirm, onClose }: Props) {
  const [role, setRole] = useState<"admin" | "user">(user.role === "admin" ? "admin" : "user");
  const [firstName, setFirstName] = useState(user.first_name ?? "");
  const [lastName, setLastName] = useState(user.last_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [country, setCountry] = useState(user.country ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user.date_of_birth ?? "");
  const [gender, setGender] = useState(user.gender ?? "");
  const [currentLevel, setCurrentLevel] = useState(user.current_jlpt_level ?? "");
  const [targetLevel, setTargetLevel] = useState(user.target_jlpt_level ?? "");
  const [dailyGoal, setDailyGoal] = useState(user.daily_vocab_goal != null ? String(user.daily_vocab_goal) : "");

  const handleSubmit = () => {
    const payload: UpdateUserPayload = {
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      phone: phone.trim() || null,
      country: country.trim() || null,
      city: city.trim() || null,
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      current_jlpt_level: currentLevel || null,
      target_jlpt_level: targetLevel || null,
      daily_vocab_goal: dailyGoal.trim() ? Number(dailyGoal) : null,
    };
    if (!isSelf) payload.role = role;
    onConfirm(payload);
  };

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-h-[85vh] max-w-2xl overflow-y-auto p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Sửa thông tin người dùng</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        @{user.username} · {user.email}
      </p>

      <div className="mt-4 space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Hồ sơ cá nhân
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                <UserIcon /> Họ
              </label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>
                <UserIcon /> Tên
              </label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>
                <PhoneIcon /> Số điện thoại
              </label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>
                <CalenderIcon /> Ngày sinh
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                <UserCircleIcon /> Giới tính
              </label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
                <option value="">— Không chọn —</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                <GroupIcon /> Vai trò
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "user")}
                disabled={isSelf}
                title={isSelf ? "Không thể tự đổi vai trò của chính mình" : undefined}
                className={inputClass}
              >
                <option value="user">Người dùng</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                <GlobeIcon /> Quốc gia
              </label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>
                <GlobeIcon /> Thành phố
              </label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Học tập & mục tiêu
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>
                <DocsIcon /> Trình độ hiện tại
              </label>
              <select value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)} className={inputClass}>
                <option value="">—</option>
                {["N5", "N4", "N3", "N2", "N1"].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                <DocsIcon /> Trình độ mục tiêu
              </label>
              <select value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)} className={inputClass}>
                <option value="">—</option>
                {["N5", "N4", "N3", "N2", "N1"].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                <TaskIcon /> Mục tiêu từ/ngày
              </label>
              <input
                type="number"
                min={1}
                value={dailyGoal}
                onChange={(e) => setDailyGoal(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </Modal>
  );
}
