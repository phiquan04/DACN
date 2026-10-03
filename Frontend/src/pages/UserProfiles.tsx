import { useEffect, useState } from "react";
import UserMetaCard from "../components/UserProfile/UserMetaCard";
import UserInfoCard from "../components/UserProfile/UserInfoCard";
import LevelProgressCard from "../components/UserProfile/LevelProgressCard";
import ActivityHeatmapCard from "../components/UserProfile/ActivityHeatmapCard";
import WeeklyOverviewCard from "../components/UserProfile/WeeklyOverviewCard";
import JlptGoalCard from "../components/UserProfile/JlptGoalCard";
import VocabularyBreakdownCard from "../components/UserProfile/VocabularyBreakdownCard";
import RecentTestResultsCard from "../components/UserProfile/RecentTestResultsCard";
import EmailVerificationCard from "../components/UserProfile/EmailVerificationCard";
import ReminderSettingsCard from "../components/UserProfile/ReminderSettingsCard";
import PageMeta from "../components/common/PageMeta";
import { getUserProfile, updateUserProfile, type UserProfile, type UserProfileUpdate } from "../services/api";
import { fetchStudyOverview, fetchLibrarySets, StudyOverview, VocabularySetProgress } from "../services/vocabularyLearningApi";
import { fetchDashboard, fetchMyAttempts, JLPT_LEVELS, AttemptHistoryItem, JlptDashboard, JlptLevel } from "../services/jlptApi";

function isJlptLevel(value?: string | null): value is JlptLevel {
  return !!value && (JLPT_LEVELS as string[]).includes(value);
}
const DEFAULT_JLPT_LEVEL: JlptLevel = "N3";

export default function UserProfiles() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [overview, setOverview] = useState<StudyOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<JlptDashboard | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [vocabSets, setVocabSets] = useState<VocabularySetProgress[]>([]);
  const [loadingVocabSets, setLoadingVocabSets] = useState(true);

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
    fetchMyAttempts()
      .then(setAttempts)
      .catch(() => {})
      .finally(() => setLoadingAttempts(false));
    fetchLibrarySets()
      .then(setVocabSets)
      .catch(() => {})
      .finally(() => setLoadingVocabSets(false));
  }, []);

  const jlptLevel = isJlptLevel(profile?.target_jlpt_level)
    ? (profile!.target_jlpt_level as JlptLevel)
    : isJlptLevel(profile?.current_jlpt_level)
      ? (profile!.current_jlpt_level as JlptLevel)
      : DEFAULT_JLPT_LEVEL;

  useEffect(() => {
    if (!profile) return;
    setLoadingDashboard(true);
    fetchDashboard(jlptLevel)
      .then(setDashboard)
      .finally(() => setLoadingDashboard(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.username, jlptLevel]);

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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <WeeklyOverviewCard overview={overview} loading={loadingOverview} />
            <JlptGoalCard
              level={jlptLevel}
              upcoming={dashboard?.upcoming_exam ?? null}
              predicted={dashboard?.predicted ?? null}
              loading={loadingDashboard}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <VocabularyBreakdownCard sets={vocabSets} loading={loadingVocabSets} />
            <RecentTestResultsCard attempts={attempts} loading={loadingAttempts} />
          </div>

          <ReminderSettingsCard />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
          <p>Không có thông tin hồ sơ.</p>
        </div>
      )}
    </>
  );
}
