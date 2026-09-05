import { useEffect, useState } from "react";
import UserMetaCard from "../components/UserProfile/UserMetaCard";
import UserInfoCard from "../components/UserProfile/UserInfoCard";
import UserAddressCard from "../components/UserProfile/UserAddressCard";
import LevelProgressCard from "../components/UserProfile/LevelProgressCard";
import ActivityHeatmapCard from "../components/UserProfile/ActivityHeatmapCard";
import SecurityCard from "../components/UserProfile/SecurityCard";
import EmailVerificationCard from "../components/UserProfile/EmailVerificationCard";
import SettingsCard from "../components/UserProfile/SettingsCard";
import PageMeta from "../components/common/PageMeta";
import { getUserProfile, updateUserProfile, type UserProfile, type UserProfileUpdate } from "../services/api";
import { fetchStudyOverview, StudyOverview } from "../services/vocabularyLearningApi";

export default function UserProfiles() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [overview, setOverview] = useState<StudyOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const data = await getUserProfile();
        setProfile(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Không thể tải thông tin người dùng"
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
    fetchStudyOverview()
      .then(setOverview)
      .catch(() => {})
      .finally(() => setLoadingOverview(false));
  }, []);

  const handleSaveProfile = async (data: UserProfileUpdate) => {
    if (!profile) return;

    try {
      const updated = await updateUserProfile(data);
      setProfile(updated);
    } catch (err: unknown) {
      console.error(err);
      alert("Lưu thông tin thất bại. Vui lòng thử lại.");
    }
  };

  return (
    <>
      <PageMeta
        title="Hồ sơ cá nhân"
        description="Thông tin hồ sơ người dùng"
      />
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
          <p>Đang tải...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : profile ? (
        <div className="space-y-6">
          <EmailVerificationCard />

          <UserMetaCard
            profile={profile}
            overview={overview}
            loadingOverview={loadingOverview}
            onSave={handleSaveProfile}
            onSetCurrentLevel={(level) => handleSaveProfile({ current_jlpt_level: level })}
            onSetTargetLevel={(level) => handleSaveProfile({ target_jlpt_level: level })}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <LevelProgressCard overview={overview} loading={loadingOverview} />
            <ActivityHeatmapCard overview={overview} loading={loadingOverview} />
          </div>

          <UserInfoCard profile={profile} onSave={handleSaveProfile} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <UserAddressCard profile={profile} onSave={handleSaveProfile} />
            <SecurityCard />
            <SettingsCard />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
          <p>Không có thông tin hồ sơ.</p>
        </div>
      )}
    </>
  );
}
