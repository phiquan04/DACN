import { useEffect, useMemo, useState } from "react";
import { JLPT_LEVELS, JlptLevel } from "../../services/jlptApi";
import {
  MyCurriculum,
  StudyOverview,
  VocabularyLearningItem,
  VocabularySetProgress,
  fetchBookmarked,
  fetchLibrarySets,
  fetchStudyOverview,
  toggleBookmark,
  updateDailyGoal,
} from "../../services/vocabularyLearningApi";
import { BoltIcon, CalenderIcon, FolderIcon, PencilIcon, ShootingStarIcon, TaskIcon } from "../../icons";
import AchievementsPanel from "./AchievementsPanel";
import BookmarkToggle from "./BookmarkToggle";
import MyVocabularyPanel from "./MyVocabularyPanel";
import ProgressBar from "./ProgressBar";
import StreakHeatmap from "./StreakHeatmap";
import StudyConfigPanel from "./StudyConfigPanel";
import { StudyMode } from "./types";

type Tab = "sets" | "mine" | "myLists" | "achievements";

interface CurriculumGroup {
  curriculumId: number | null;
  curriculumName: string;
  sets: VocabularySetProgress[];
}

function groupByCurriculum(sets: VocabularySetProgress[]): CurriculumGroup[] {
  const groups = new Map<string, CurriculumGroup>();
  for (const s of sets) {
    const key = s.curriculum_id != null ? `c-${s.curriculum_id}` : `s-${s.id}`;
    let group = groups.get(key);
    if (!group) {
      group = { curriculumId: s.curriculum_id ?? null, curriculumName: s.curriculum_name || s.set_name, sets: [] };
      groups.set(key, group);
    }
    group.sets.push(s);
  }
  return Array.from(groups.values());
}

function sumGroup(sets: VocabularySetProgress[]) {
  return sets.reduce(
    (acc, s) => ({
      item_count: acc.item_count + s.item_count,
      learned_count: acc.learned_count + s.learned_count,
      reviewing_count: acc.reviewing_count + s.reviewing_count,
      new_count: acc.new_count + s.new_count,
    }),
    { item_count: 0, learned_count: 0, reviewing_count: 0, new_count: 0 }
  );
}

export default function LibraryView({
  onSelectSet,
  onSelectCurriculum,
  onOpenMyCurriculum,
  onStartDueQuick,
  onStartBookmarked,
}: {
  onSelectSet: (set: VocabularySetProgress) => void;
  onSelectCurriculum: (curriculumName: string, sets: VocabularySetProgress[]) => void;
  onOpenMyCurriculum: (curriculum: MyCurriculum) => void;
  onStartDueQuick: () => void;
  onStartBookmarked: (mode: StudyMode, count: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("sets");
  const [level, setLevel] = useState<JlptLevel | "ALL">("ALL");
  const [sets, setSets] = useState<VocabularySetProgress[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [overview, setOverview] = useState<StudyOverview | null>(null);
  const [bookmarked, setBookmarked] = useState<VocabularyLearningItem[]>([]);
  const [loadingBookmarked, setLoadingBookmarked] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    fetchStudyOverview().then(setOverview).catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingSets(true);
    fetchLibrarySets(level === "ALL" ? undefined : level)
      .then(setSets)
      .finally(() => setLoadingSets(false));
  }, [level]);

  const loadBookmarked = () => {
    setLoadingBookmarked(true);
    fetchBookmarked()
      .then(setBookmarked)
      .finally(() => setLoadingBookmarked(false));
  };

  useEffect(() => {
    if (tab === "mine") loadBookmarked();
  }, [tab]);

  const handleUnbookmark = async (itemId: number) => {
    await toggleBookmark(itemId);
    setBookmarked((prev) => prev.filter((i) => i.id !== itemId));
  };

  const startEditGoal = () => {
    setGoalInput(String(overview?.daily_goal ?? 20));
    setEditingGoal(true);
  };

  const saveGoal = async () => {
    const n = parseInt(goalInput, 10);
    if (!n || n < 1) return;
    setSavingGoal(true);
    try {
      setOverview(await updateDailyGoal(n));
      setEditingGoal(false);
    } catch {
      // reported globally by the http client
    } finally {
      setSavingGoal(false);
    }
  };

  const goalPct = overview ? Math.min(100, (overview.studied_today_count / overview.daily_goal) * 100) : 0;
  const groups = useMemo(() => groupByCurriculum(sets), [sets]);
  const remainingToday = overview ? Math.max(0, overview.daily_goal - overview.studied_today_count) : 0;

  return (
    <div className="space-y-5">
      {overview && remainingToday > 0 && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-3.5 text-sm ${
            overview.streak_days > 0
              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              : "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300"
          }`}
        >
          <BoltIcon className="h-4 w-4 shrink-0" />
          <span>
            {overview.streak_days > 0
              ? `Streak ${overview.streak_days} ngày đang chờ! Học thêm ${remainingToday} từ nữa hôm nay để giữ chuỗi.`
              : `Học ${remainingToday} từ hôm nay để bắt đầu một streak mới!`}
          </span>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300">
                <BoltIcon />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800 dark:text-white/90">{overview?.streak_days ?? 0} ngày</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Streak</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                <ShootingStarIcon />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800 dark:text-white/90">Lv.{overview?.level ?? 1}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {overview ? overview.xp - overview.level_xp_floor : 0}/
                  {overview ? overview.level_xp_ceil - overview.level_xp_floor : 100} XP
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
                <TaskIcon />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800 dark:text-white/90">{overview?.due_today_count ?? 0} từ</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Cần ôn ngay</p>
              </div>
            </div>
            <div className="min-w-[220px]">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Mục tiêu hôm nay</span>
                {editingGoal ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveGoal()}
                      autoFocus
                      className="w-14 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-700 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    />
                    <button
                      type="button"
                      onClick={saveGoal}
                      disabled={savingGoal}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50 dark:text-brand-400"
                    >
                      Lưu
                    </button>
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {overview?.studied_today_count ?? 0}/{overview?.daily_goal ?? 20} từ
                    <button
                      type="button"
                      onClick={startEditGoal}
                      aria-label="Sửa mục tiêu hôm nay"
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                <div className="h-full bg-brand-500" style={{ width: `${goalPct}%` }} />
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={!overview || overview.due_today_count === 0}
            onClick={onStartDueQuick}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-200 disabled:text-white/80"
          >
            <BoltIcon className="h-4 w-4" />
            Ôn tập ngay
          </button>
        </div>
      </div>

      {overview && overview.heatmap.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <CalenderIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Lịch học 12 tuần gần đây</h3>
          </div>
          <StreakHeatmap days={overview.heatmap} />
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-5 flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {(
            [
              { id: "sets" as Tab, label: "Các bộ từ vựng" },
              { id: "mine" as Tab, label: "Yêu thích" },
              { id: "myLists" as Tab, label: "Bộ từ của tôi" },
              { id: "achievements" as Tab, label: "Thành tích" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "sets" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLevel("ALL")}
                className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                  level === "ALL"
                    ? "bg-brand-500 text-white"
                    : "border border-gray-300 text-gray-600 hover:border-teal-400 dark:border-gray-600 dark:text-gray-300"
                }`}
              >
                Tất cả
              </button>
              {JLPT_LEVELS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevel(lv)}
                  className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                    level === lv
                      ? "bg-brand-500 text-white"
                      : "border border-gray-300 text-gray-600 hover:border-teal-400 dark:border-gray-600 dark:text-gray-300"
                  }`}
                >
                  {lv}
                </button>
              ))}
            </div>

            {loadingSets && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
            {!loadingSets && groups.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có bộ từ vựng nào ở cấp độ này.</p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => {
                const isCurriculum = group.curriculumId !== null;
                const totals = sumGroup(group.sets);
                const primarySet = group.sets[0];

                return (
                  <button
                    key={isCurriculum ? `c-${group.curriculumId}` : `s-${primarySet.id}`}
                    type="button"
                    onClick={() =>
                      isCurriculum ? onSelectCurriculum(group.curriculumName, group.sets) : onSelectSet(primarySet)
                    }
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-500 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                        <FolderIcon className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                        {group.curriculumName}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {isCurriculum ? `${group.sets.length} bộ · ${totals.item_count} từ` : `${totals.item_count} từ`}
                    </p>
                    <div>
                      <ProgressBar learned={totals.learned_count} reviewing={totals.reviewing_count} total={totals.item_count} />
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {totals.learned_count} thuộc
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {totals.reviewing_count} cần ôn
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" /> {totals.new_count} mới
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === "mine" && (
          <div className="space-y-5">
            {loadingBookmarked && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
            {!loadingBookmarked && bookmarked.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Chưa có từ nào được đánh dấu. Bấm biểu tượng đánh dấu trên một từ khi học để thêm vào đây.
              </p>
            )}
            {bookmarked.length > 0 && (
              <>
                <div className="flex flex-col gap-2.5">
                  {bookmarked.map((item) => (
                    <div
                      key={item.id}
                      className="relative flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span lang="ja" className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                            {item.word}
                          </span>
                          {item.reading && (
                            <span lang="ja" className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                              {item.reading}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{item.meaning_vi}</p>
                      </div>
                      <BookmarkToggle
                        active
                        onToggle={() => handleUnbookmark(item.id)}
                        className="shrink-0"
                      />
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <StudyConfigPanel onStart={onStartBookmarked} />
                </div>
              </>
            )}
          </div>
        )}

        {tab === "myLists" && <MyVocabularyPanel onOpenCurriculum={onOpenMyCurriculum} />}

        {tab === "achievements" && <AchievementsPanel />}
      </div>
    </div>
  );
}
