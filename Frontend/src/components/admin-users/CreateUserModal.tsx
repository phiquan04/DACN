import { useState } from "react";
import { Modal } from "../ui/modal";
import { CreateUserPayload } from "../../services/adminUserApi";
import { GroupIcon, MailIcon, UserIcon } from "../../icons";
import { KeyIcon } from "../../icons/custom";

interface Props {
  saving: boolean;
  onConfirm: (payload: CreateUserPayload) => void;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90";
const labelClass = "mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 [&>svg]:h-3.5 [&>svg]:w-3.5";

export default function CreateUserModal({ saving, onConfirm, onClose }: Props) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const valid = username.trim().length >= 3 && /\S+@\S+\.\S+/.test(email) && password.length >= 8;

  const handleSubmit = () => {
    if (!valid) return;
    onConfirm({
      username: username.trim(),
      email: email.trim(),
      password,
      role,
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
    });
  };

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-w-lg p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Thêm người dùng mới</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Tài khoản được tạo sẽ hoạt động ngay, người dùng đăng nhập bằng mật khẩu bạn đặt bên dưới.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            <UserIcon /> Username <span className="text-rose-500">*</span>
          </label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>
            <MailIcon /> Email <span className="text-rose-500">*</span>
          </label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
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
            <KeyIcon /> Mật khẩu <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tối thiểu 8 ký tự"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>
            <GroupIcon /> Vai trò
          </label>
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "user")} className={inputClass}>
            <option value="user">Người dùng</option>
            <option value="admin">Quản trị viên</option>
          </select>
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
          disabled={saving || !valid}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Đang tạo..." : "Tạo tài khoản"}
        </button>
      </div>
    </Modal>
  );
}
