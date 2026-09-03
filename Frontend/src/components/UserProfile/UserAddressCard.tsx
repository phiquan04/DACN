import { useEffect, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import type { UserProfile, UserProfileUpdate } from "../../services/api";
import { GlobeIcon } from "../../icons/custom";

interface UserAddressCardProps {
  profile: UserProfile;
  onSave?: (data: UserProfileUpdate) => Promise<void>;
}

export default function UserAddressCard({ profile, onSave }: UserAddressCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const [country, setCountry] = useState(profile.country ?? "");
  const [city, setCity] = useState(profile.city ?? "");

  useEffect(() => {
    setCountry(profile.country ?? "");
    setCity(profile.city ?? "");
  }, [profile]);

  const handleSave = async () => {
    if (onSave) {
      await onSave({
        country,
        city,
      });
    }
    closeModal();
  };

  return (
    <>
      {/* Layout header luôn cùng hàng (không phụ thuộc breakpoint viewport) vì
          card này thường nằm trong cột hẹp (grid 3 cột) — dùng lg:flex-row ở
          đây từng khiến tiêu đề/nút bị bóp chật khi container hẹp hơn viewport. */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">Địa chỉ</h4>
          <button
            onClick={openModal}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
          >
            Chỉnh sửa
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
              <GlobeIcon className="h-3.5 w-3.5 shrink-0" /> Quốc gia
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{profile.country || "-"}</p>
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
              <GlobeIcon className="h-3.5 w-3.5 shrink-0" /> Thành phố
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{profile.city || "-"}</p>
          </div>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        <div className="relative w-full p-4 overflow-y-auto bg-white no-scrollbar rounded-3xl dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Chỉnh sửa địa chỉ
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Cập nhật thông tin để hồ sơ của bạn luôn mới nhất.
            </p>
          </div>

          <form className="flex flex-col">
            <div className="px-2 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <GlobeIcon className="h-3.5 w-3.5" /> Quốc gia
                  </Label>
                  <Input
                    type="text"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                  />
                </div>

                <div>
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

            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={closeModal}>
                Đóng
              </Button>
              <Button size="sm" onClick={handleSave}>
                Lưu thay đổi
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
