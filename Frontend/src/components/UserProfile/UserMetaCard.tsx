import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { UserProfile, UserProfileUpdate } from "../../services/api";
import { uploadAvatar, deleteAvatar } from "../../services/api";
import type { StudyOverview } from "../../services/vocabularyLearningApi";
import { BoltIcon, DocsIcon, MailIcon, PencilIcon, ShootingStarIcon, TaskIcon, TrashBinIcon } from "../../icons";
import { GlobeIcon } from "../../icons/custom";

const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

interface UserMetaCardProps {
  profile: UserProfile;
  overview: StudyOverview | null;
  loadingOverview: boolean;
  onSave?: (data: UserProfileUpdate) => Promise<void>;
  onSetCurrentLevel?: (level: string) => Promise<void>;
  onSetTargetLevel?: (level: string) => Promise<void>;
}

export default function UserMetaCard({
  profile,
  overview,
  loadingOverview,
  onSave,
  onSetCurrentLevel,
  onSetTargetLevel,
}: UserMetaCardProps) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingJlpt, setEditingJlpt] = useState(false);
  const [savingJlpt, setSavingJlpt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh (jpg, png, ...)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Kích thước ảnh không được vượt quá 2MB");
      return;
    }
    setUploading(true);
    try {
      const { avatar_url } = await uploadAvatar(file);
      setAvatarUrl(avatar_url);
      if (onSave) {
        await onSave({ avatar_url });
        window.dispatchEvent(new CustomEvent("avatar-updated", { detail: { avatar_url } }));
      }
    } catch (err) {
      console.error(err);
      alert("Upload ảnh thất bại, vui lòng thử lại");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAvatar = async () => {
    if (!avatarUrl || deleting) return;
    setDeleting(true);
    try {
      await deleteAvatar();
      setAvatarUrl("");
      window.dispatchEvent(new CustomEvent("avatar-updated", { detail: { avatar_url: "" } }));
    } catch (err) {
      console.error(err);
      alert("Xóa ảnh đại diện thất bại, vui lòng thử lại");
    } finally {
      setDeleting(false);
    }
  };

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.username;

  const remainingToday = overview ? Math.max(0, overview.daily_goal - overview.studied_today_count) : 0;
  const jlptLabel = `${profile.current_jlpt_level ?? "—"} → ${profile.target_jlpt_level ?? "chưa đặt"}`;
  const canEditJlpt = Boolean(onSetCurrentLevel || onSetTargetLevel);

  const handlePickCurrent = async (level: string) => {
    if (!onSetCurrentLevel) return;
    setSavingJlpt(true);
    try {
      await onSetCurrentLevel(level);
    } finally {
      setSavingJlpt(false);
    }
  };

  const handlePickTarget = async (level: string) => {
    if (!onSetTargetLevel) return;
    setSavingJlpt(true);
    try {
      await onSetTargetLevel(level);
    } finally {
      setSavingJlpt(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {/* Avatar chữ nhật, icon máy ảnh (sửa) và thùng rác (xóa) đè ở hai góc dưới */}
        <div
          className={`relative h-40 w-32 shrink-0 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 ${
            uploading ? "opacity-50" : ""
          }`}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-brand-100 text-brand-400 dark:bg-brand-500/20 dark:text-brand-300">
              <svg width="36" height="36" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M6.5 3.75a.75.75 0 0 0-.67.415L5.19 5.5H3.25A1.75 1.75 0 0 0 1.5 7.25v8A1.75 1.75 0 0 0 3.25 17h13.5a1.75 1.75 0 0 0 1.75-1.75v-8A1.75 1.75 0 0 0 16.75 5.5h-1.94l-.64-1.335a.75.75 0 0 0-.67-.415h-7Zm3.5 4.5a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Zm0 1.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />

          {overview && (
            <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-brand-500/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
              <ShootingStarIcon className="h-3 w-3" /> Lv.{overview.level}
            </span>
          )}

          {avatarUrl && (
            <button
              type="button"
              onClick={handleDeleteAvatar}
              disabled={deleting}
              title="Xóa ảnh đại diện"
              className="absolute bottom-1.5 left-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-error-500 shadow-theme-xs hover:bg-error-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800"
            >
              <TrashBinIcon className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploading}
            title="Đổi ảnh đại diện"
            className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-current">
              <path d="M6.5 3.75a.75.75 0 0 0-.67.415L5.19 5.5H3.25A1.75 1.75 0 0 0 1.5 7.25v8A1.75 1.75 0 0 0 3.25 17h13.5a1.75 1.75 0 0 0 1.75-1.75v-8A1.75 1.75 0 0 0 16.75 5.5h-1.94l-.64-1.335a.75.75 0 0 0-.67-.415h-7Zm3.5 4.5a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Zm0 1.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
            </svg>
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">{fullName}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <MailIcon className="h-3.5 w-3.5" /> {profile.email}
            </span>
            <span className="flex items-center gap-1.5">
              <GlobeIcon className="h-3.5 w-3.5" /> {profile.country || "Chưa cập nhật"}
            </span>
          </div>

          {overview && remainingToday > 0 && (
            <div
              className={`mt-4 flex items-center gap-3 rounded-xl border p-3.5 text-sm ${
                overview.streak_days > 0
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                  : "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300"
              }`}
            >
              <BoltIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                {overview.streak_days > 0
                  ? `Đừng để mất chuỗi! Bạn còn ${remainingToday} từ vựng cần ôn tập hôm nay.`
                  : `Học ${remainingToday} từ hôm nay để bắt đầu một streak mới!`}
              </span>
              <Link
                to="/vocabulary"
                className="shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600"
              >
                Học ngay
              </Link>
            </div>
          )}
        </div>
      </div>

      {loadingOverview ? (
        <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
      ) : overview ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-800/60">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300">
              <BoltIcon />
            </div>
            <p className="text-lg font-bold text-gray-800 dark:text-white/90">{overview.streak_days}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Chuỗi ngày học</p>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-800/60">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
              <ShootingStarIcon />
            </div>
            <p className="text-lg font-bold text-gray-800 dark:text-white/90">
              Lv.{overview.level} · {overview.xp}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">XP</p>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-800/60">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
              <TaskIcon />
            </div>
            <p className="text-lg font-bold text-gray-800 dark:text-white/90">{overview.due_today_count}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Cần ôn hôm nay</p>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-800/60">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
              <DocsIcon />
            </div>
            {editingJlpt ? (
              <div className="flex items-center justify-center gap-1">
                <select
                  autoFocus
                  disabled={savingJlpt || !onSetCurrentLevel}
                  defaultValue={profile.current_jlpt_level ?? ""}
                  onChange={(e) => handlePickCurrent(e.target.value)}
                  title="Trình độ hiện tại"
                  className="rounded-lg border border-gray-200 bg-white px-1 py-0.5 text-xs text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="">—</option>
                  {JLPT_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">→</span>
                <select
                  disabled={savingJlpt || !onSetTargetLevel}
                  defaultValue={profile.target_jlpt_level ?? ""}
                  onChange={(e) => handlePickTarget(e.target.value)}
                  onBlur={() => setEditingJlpt(false)}
                  title="Mục tiêu"
                  className="rounded-lg border border-gray-200 bg-white px-1 py-0.5 text-xs text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                >
                  <option value="">—</option>
                  {JLPT_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => canEditJlpt && setEditingJlpt(true)}
                className="flex items-center justify-center gap-1 text-lg font-bold text-gray-800 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400"
                title={canEditJlpt ? "Đổi trình độ / mục tiêu JLPT" : undefined}
              >
                {jlptLabel}
                {canEditJlpt && <PencilIcon className="h-3 w-3 text-gray-400" />}
              </button>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500">Mục tiêu JLPT</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
