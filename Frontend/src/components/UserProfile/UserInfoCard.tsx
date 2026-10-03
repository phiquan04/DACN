import { useEffect, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Select from "../form/Select";
import { useToast } from "../../context/ToastContext";
import { changePassword } from "../../services/api";
import type { UserProfile, UserProfileUpdate } from "../../services/api";
import { CalenderIcon, MailIcon, UserCircleIcon, UserIcon } from "../../icons";
import { GlobeIcon, KeyIcon, PhoneIcon } from "../../icons/custom";

const GENDER_OPTIONS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Khác" },
];
const GENDER_LABELS: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" };

interface UserInfoCardProps {
  profile: UserProfile;
  onSave?: (data: UserProfileUpdate) => Promise<void>;
}

export default function UserInfoCard({ profile, onSave }: UserInfoCardProps) {
  const { isOpen: isEditOpen, openModal: openEditModal, closeModal: closeEditModal } = useModal();
  const { isOpen: isPasswordOpen, openModal: openPasswordModal, closeModal: closePasswordModal } = useModal();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(profile.date_of_birth ?? "");
  const [gender, setGender] = useState(profile.gender ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setPhone(profile.phone ?? "");
    setDateOfBirth(profile.date_of_birth ?? "");
    setGender(profile.gender ?? "");
    setCountry(profile.country ?? "");
    setCity(profile.city ?? "");
  }, [profile]);

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave({
          first_name: firstName,
          last_name: lastName,
          phone,
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
          country,
          city,
        });
      } finally {
        setSaving(false);
      }
    }
    closeEditModal();
  };

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleClosePasswordModal = () => {
    resetPasswordForm();
    closePasswordModal();
  };

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const passwordValid = currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  const handleSavePassword = async () => {
    if (!passwordValid) return;
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      showToast("Đã đổi mật khẩu thành công", "success");
      handleClosePasswordModal();
    } catch {
      // reported globally by the http client
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
            Thông tin cá nhân
          </h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
                <UserIcon className="h-3.5 w-3.5" /> Họ
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {profile.first_name || "-"}
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
                <UserIcon className="h-3.5 w-3.5" /> Tên
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {profile.last_name || "-"}
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
                <MailIcon className="h-3.5 w-3.5" /> Địa chỉ email
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {profile.email}
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
                <PhoneIcon className="h-3.5 w-3.5" /> Số điện thoại
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {profile.phone || "-"}
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
                <CalenderIcon className="h-3.5 w-3.5" /> Ngày sinh
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {profile.date_of_birth ? new Date(`${profile.date_of_birth}T00:00:00`).toLocaleDateString("vi-VN") : "-"}
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
                <UserCircleIcon className="h-3.5 w-3.5" /> Giới tính
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {profile.gender ? GENDER_LABELS[profile.gender] ?? profile.gender : "-"}
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
                <GlobeIcon className="h-3.5 w-3.5" /> Quốc gia
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {profile.country || "-"}
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
                <GlobeIcon className="h-3.5 w-3.5" /> Tỉnh/Thành phố
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {profile.city || "-"}
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
                <KeyIcon className="h-3.5 w-3.5" /> Mật khẩu
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">••••••••</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <button
            onClick={openEditModal}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 sm:w-auto"
          >
            Chỉnh sửa
          </button>
          <button
            onClick={openPasswordModal}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 sm:w-auto"
          >
            Đổi mật khẩu
          </button>
        </div>
      </div>

      <Modal isOpen={isEditOpen} onClose={closeEditModal} className="max-w-[700px] m-4">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Chỉnh sửa thông tin cá nhân
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Cập nhật thông tin để hồ sơ của bạn luôn mới nhất.
            </p>
          </div>

          <form className="flex flex-col">
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
              <div>
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Thông tin cá nhân
                </h5>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5" /> Họ
                    </Label>
                    <Input
                      type="text"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5" /> Tên
                    </Label>
                    <Input
                      type="text"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="flex items-center gap-1.5">
                      <MailIcon className="h-3.5 w-3.5" /> Địa chỉ email
                    </Label>
                    <Input type="text" value={profile.email} disabled />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="flex items-center gap-1.5">
                      <PhoneIcon className="h-3.5 w-3.5" /> Số điện thoại
                    </Label>
                    <Input
                      type="text"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="flex items-center gap-1.5">
                      <CalenderIcon className="h-3.5 w-3.5" /> Ngày sinh
                    </Label>
                    <Input
                      type="date"
                      value={dateOfBirth}
                      onChange={(event) => setDateOfBirth(event.target.value)}
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="flex items-center gap-1.5">
                      <UserCircleIcon className="h-3.5 w-3.5" /> Giới tính
                    </Label>
                    <Select
                      options={GENDER_OPTIONS}
                      placeholder="Chọn giới tính"
                      defaultValue={gender}
                      onChange={setGender}
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="flex items-center gap-1.5">
                      <GlobeIcon className="h-3.5 w-3.5" /> Quốc gia
                    </Label>
                    <Input
                      type="text"
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="flex items-center gap-1.5">
                      <GlobeIcon className="h-3.5 w-3.5" /> Tỉnh/Thành phố
                    </Label>
                    <Input
                      type="text"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={closeEditModal}>
                Đóng
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal isOpen={isPasswordOpen} onClose={handleClosePasswordModal} className="max-w-[500px] m-4">
        <div className="no-scrollbar relative w-full max-w-[500px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Đổi mật khẩu</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 8 ký tự).
            </p>
          </div>

          <form className="flex flex-col">
            <div className="space-y-5 px-2">
              <div>
                <Label>Mật khẩu hiện tại</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div>
                <Label>Mật khẩu mới</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  hint={newPassword && newPassword.length < 8 ? "Tối thiểu 8 ký tự" : undefined}
                  error={Boolean(newPassword && newPassword.length < 8)}
                />
              </div>
              <div>
                <Label>Xác nhận mật khẩu mới</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  hint={passwordMismatch ? "Mật khẩu xác nhận không khớp" : undefined}
                  error={passwordMismatch}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={handleClosePasswordModal}>
                Đóng
              </Button>
              <Button size="sm" onClick={handleSavePassword} disabled={savingPassword || !passwordValid}>
                {savingPassword ? "Đang lưu..." : "Đổi mật khẩu"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
