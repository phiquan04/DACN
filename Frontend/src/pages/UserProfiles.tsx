import { useEffect, useState } from "react";
import UserMetaCard from "../components/UserProfile/UserMetaCard";
import UserInfoCard from "../components/UserProfile/UserInfoCard";
import UserAddressCard from "../components/UserProfile/UserAddressCard";
import PageMeta from "../components/common/PageMeta";
import { getUserProfile, updateUserProfile, type UserProfile } from "../services/api";

export default function UserProfiles() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
  }, []);

  const handleSaveProfile = async (data: Partial<UserProfile>) => {
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
        title="User Profile"
        description="Thông tin hồ sơ người dùng"
      />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        {loading ? (
          <p>Đang tải...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : profile ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <UserMetaCard profile={profile} onSave={handleSaveProfile} />
            </div>
            <div className="space-y-6 lg:col-span-2">
              <UserInfoCard profile={profile} onSave={handleSaveProfile} />
              <UserAddressCard profile={profile} onSave={handleSaveProfile} />
            </div>
          </div>
        ) : (
          <p>Không có thông tin hồ sơ.</p>
        )}
      </div>
    </>
  );
}