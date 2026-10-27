import { useEffect, useState } from "react";
import { useSetUrlParams, useUrlNumber } from "../../hooks/useUrlState";
import {
  BatchSource,
  MyCurriculum,
  MySet,
  VocabularyLearningItem,
  VocabularySetProgress,
  fetchBookmarkedBatch,
  fetchDueBatch,
  fetchLibrarySets,
  fetchMyCurriculums,
  fetchMyStudyBatch,
  fetchStudyBatch,
  fetchStudyOverview,
} from "../../services/vocabularyLearningApi";
import CurriculumDetailView from "./CurriculumDetailView";
import LibraryView from "./LibraryView";
import MyCurriculumDetailView from "./MyCurriculumDetailView";
import MySetDetailView from "./MySetDetailView";
import SessionView from "./SessionView";
import SetDetailView from "./SetDetailView";
import SummaryView from "./SummaryView";
import { BatchOrigin, SessionResult, StudyMode } from "./types";

// Which screen is open lives in the URL, so a reload, Back/Forward and a shared
// link land on the same screen:
//   (none)                          library (its own ?tab= / ?level=)
//   ?curriculum=<id>                a curriculum's set list
//   ?set=<id>[&curriculum=<id>]     a public set (curriculum kept so "back" returns to it)
//   ?myCurriculum=<id>[&mySet=<id>] the learner's own curriculum / set
//   ...&study=1                     a study session on top of the screen it was started from
// Child screens' own params (?page= / ?search= / ?status=) are dropped when leaving them.
const DETAIL_PARAMS = { page: null, search: null, status: null };
const SCREEN_PARAMS = { curriculum: null, set: null, myCurriculum: null, mySet: null, study: null, ...DETAIL_PARAMS };

const DUE_QUICK_COUNT = 40;

type SessionPhase = "session" | "summary";

export default function VocabularyLearningHome() {
  const setUrlParams = useSetUrlParams();
  const [curriculumId] = useUrlNumber("curriculum", null);
  const [setId] = useUrlNumber("set", null);
  const [myCurriculumId] = useUrlNumber("myCurriculum", null);
  const [mySetId] = useUrlNumber("mySet", null);
  const [studyParam] = useUrlNumber("study", null);

  const [curriculumGroup, setCurriculumGroup] = useState<{ id: number; name: string; sets: VocabularySetProgress[] } | null>(null);
  const [myCurriculum, setMyCurriculum] = useState<MyCurriculum | null>(null);
  const [origin, setOrigin] = useState<BatchOrigin | null>(null);
  const [mode, setMode] = useState<StudyMode>("flashcard");
  const [batch, setBatch] = useState<VocabularyLearningItem[]>([]);
  const [phase, setPhase] = useState<SessionPhase>("session");
  const [lastSetConfig, setLastSetConfig] = useState<{ source: BatchSource; count: number } | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  // Whether the in-progress/just-finished session was started from a private
  // "bộ từ của tôi" set rather than a public one — origin.kind is "set" for
  // both, so this is what lets "back to detail"/"continue" know whether to
  // route to MySetDetailView (+ fetchMyStudyBatch) or SetDetailView (+ fetchStudyBatch).
  const [sessionFromMySet, setSessionFromMySet] = useState(false);

  // ?curriculum= opened directly (reload / link) -> rebuild its set list from the library.
  useEffect(() => {
    if (curriculumId === null || curriculumGroup?.id === curriculumId) return;
    fetchLibrarySets()
      .then((all) => {
        const sets = all.filter((s) => s.curriculum_id === curriculumId);
        if (sets.length === 0) {
          setUrlParams(SCREEN_PARAMS, "replace");
          return;
        }
        setCurriculumGroup({ id: curriculumId, name: sets[0].curriculum_name || sets[0].set_name, sets });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curriculumId]);

  // ?myCurriculum= opened directly -> look the curriculum up by id.
  useEffect(() => {
    if (myCurriculumId === null || myCurriculum?.id === myCurriculumId) return;
    fetchMyCurriculums()
      .then((all) => {
        const found = all.find((c) => c.id === myCurriculumId);
        if (found) setMyCurriculum(found);
        else setUrlParams(SCREEN_PARAMS, "replace");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCurriculumId]);

  // ?study=1 without a batch in memory (page reloaded mid-session — the batch is
  // random and isn't kept) -> drop it and show the screen the session started from.
  const sessionActive = studyParam !== null && (phase === "summary" ? !!result && !!origin : batch.length > 0);
  useEffect(() => {
    if (studyParam !== null && !sessionActive) setUrlParams({ study: null }, "replace");
  }, [studyParam, sessionActive, setUrlParams]);

  const startSession = (items: VocabularyLearningItem[], studyMode: StudyMode, sessionOrigin: BatchOrigin) => {
    setBatch(items);
    setMode(studyMode);
    setOrigin(sessionOrigin);
    setResult(null);
    setPhase("session");
    setUrlParams({ study: 1 }, "push");
  };

  const backToLibrary = () => {
    setBatch([]);
    setResult(null);
    setOrigin(null);
    setSessionFromMySet(false);
    setUrlParams(SCREEN_PARAMS, "push");
  };

  const handleOpenMyCurriculum = (curriculum: MyCurriculum) => {
    setMyCurriculum(curriculum);
    setUrlParams({ myCurriculum: curriculum.id }, "push");
  };

  const handleBackFromMyCurriculum = () => setUrlParams({ myCurriculum: null }, "push");

  // Đã xoá -> replace để nút Back không quay lại màn của thứ không còn tồn tại.
  const handleMyCurriculumDeleted = () => {
    setMyCurriculum(null);
    setUrlParams({ myCurriculum: null, mySet: null, ...DETAIL_PARAMS }, "replace");
  };

  const handleOpenMySet = (set: MySet) => setUrlParams({ mySet: set.id }, "push");

  // Item counts on the set cards can be stale after adding/removing words
  // inside MySetDetailView — refresh the curriculum on the way back rather
  // than carrying the snapshot taken when it was first opened.
  const refreshMyCurriculum = () => {
    if (myCurriculum) {
      fetchMyCurriculums()
        .then((all) => setMyCurriculum(all.find((c) => c.id === myCurriculum.id) ?? myCurriculum))
        .catch(() => {});
    }
  };

  const handleBackFromMySet = () => {
    refreshMyCurriculum();
    setUrlParams({ mySet: null, ...DETAIL_PARAMS }, "push");
  };

  const handleMySetDeleted = () => {
    // Same refresh as a plain "back": without it the deleted bài would still
    // be listed in the curriculum snapshot.
    refreshMyCurriculum();
    setUrlParams({ mySet: null, ...DETAIL_PARAMS }, "replace");
  };

  const handleSelectCurriculum = (name: string, sets: VocabularySetProgress[]) => {
    const id = sets[0]?.curriculum_id;
    if (id == null) return;
    setCurriculumGroup({ id, name, sets });
    setUrlParams({ curriculum: id }, "push");
  };

  const handleBackFromCurriculum = () => setUrlParams({ curriculum: null }, "push");

  const handleSelectSet = (set: VocabularySetProgress) => setUrlParams({ set: set.id }, "push");

  // A set can be opened either straight from the library (standalone, no
  // curriculum) or from inside a curriculum's set list — ?curriculum= stays in
  // the URL in the latter case, so dropping ?set= returns to wherever it came from.
  const handleBackFromDetail = () => setUrlParams({ set: null, ...DETAIL_PARAMS }, "push");

  const handleStartFromDetail = async (studyMode: StudyMode, count: number, source: BatchSource, setName: string) => {
    if (setId === null) return;
    setStarting(true);
    try {
      const items = await fetchStudyBatch(setId, source, count);
      setLastSetConfig({ source, count });
      setSessionFromMySet(false);
      startSession(items, studyMode, { kind: "set", setId, setName, source });
    } catch {
      // reported globally via the toast
    } finally {
      setStarting(false);
    }
  };

  const handleStartFromMySet = async (studyMode: StudyMode, count: number, source: BatchSource) => {
    if (mySetId === null) return;
    setStarting(true);
    try {
      const items = await fetchMyStudyBatch(mySetId, source, count);
      const setName = myCurriculum?.sets.find((s) => s.id === mySetId)?.set_name ?? "";
      setLastSetConfig({ source, count });
      setSessionFromMySet(true);
      startSession(items, studyMode, { kind: "set", setId: mySetId, setName, source });
    } catch {
      // reported globally via the toast
    } finally {
      setStarting(false);
    }
  };

  const handleStartDueQuick = async () => {
    setStarting(true);
    try {
      const items = await fetchDueBatch(DUE_QUICK_COUNT);
      startSession(items, "flashcard", { kind: "due" });
    } catch {
      // reported globally
    } finally {
      setStarting(false);
    }
  };

  const handleStartBookmarked = async (studyMode: StudyMode, count: number) => {
    setStarting(true);
    try {
      const items = await fetchBookmarkedBatch(count);
      startSession(items, studyMode, { kind: "bookmarked" });
    } catch {
      // reported globally
    } finally {
      setStarting(false);
    }
  };

  const handleSessionComplete = (sessionResult: SessionResult) => {
    setResult(sessionResult);
    setPhase("summary");
    fetchStudyOverview()
      .then((overview) => setStreakDays(overview.streak_days))
      .catch(() => setStreakDays(null));
  };

  const handleBackToDetail = () => {
    setBatch([]);
    setResult(null);
    setUrlParams({ study: null }, "push");
  };

  const handleContinueNextBatch = async () => {
    if (!origin || origin.kind !== "set" || !lastSetConfig) return;
    setStarting(true);
    try {
      const items = sessionFromMySet
        ? await fetchMyStudyBatch(origin.setId, lastSetConfig.source, lastSetConfig.count)
        : await fetchStudyBatch(origin.setId, lastSetConfig.source, lastSetConfig.count);
      setBatch(items);
      setResult(null);
      setPhase("session");
    } catch {
      // no more words available at this source — surfaced via toast, fall back to the set detail screen
      handleBackToDetail();
    } finally {
      setStarting(false);
    }
  };

  if (sessionActive && phase === "session") {
    return <SessionView batch={batch} mode={mode} onExit={backToLibrary} onComplete={handleSessionComplete} />;
  }

  if (sessionActive && phase === "summary" && result && origin) {
    return (
      <SummaryView
        result={result}
        origin={origin}
        streakDays={streakDays}
        onContinue={handleContinueNextBatch}
        onBackToDetail={handleBackToDetail}
        onBackToLibrary={backToLibrary}
      />
    );
  }

  if (mySetId !== null && myCurriculumId !== null) {
    return (
      <MySetDetailView
        key={mySetId}
        setId={mySetId}
        onBack={handleBackFromMySet}
        onDeleted={handleMySetDeleted}
        onStart={handleStartFromMySet}
        starting={starting}
      />
    );
  }

  if (myCurriculumId !== null) {
    return myCurriculum?.id === myCurriculumId ? (
      <MyCurriculumDetailView
        curriculum={myCurriculum}
        onBack={handleBackFromMyCurriculum}
        onOpenSet={handleOpenMySet}
        onDeleted={handleMyCurriculumDeleted}
      />
    ) : (
      <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
    );
  }

  if (setId !== null) {
    return (
      <SetDetailView
        key={setId}
        setId={setId}
        onBack={handleBackFromDetail}
        onStart={handleStartFromDetail}
        starting={starting}
      />
    );
  }

  if (curriculumId !== null) {
    return curriculumGroup?.id === curriculumId ? (
      <CurriculumDetailView
        curriculumName={curriculumGroup.name}
        sets={curriculumGroup.sets}
        onSelectSet={handleSelectSet}
        onBack={handleBackFromCurriculum}
      />
    ) : (
      <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
    );
  }

  return (
    <LibraryView
      onSelectSet={handleSelectSet}
      onSelectCurriculum={handleSelectCurriculum}
      onOpenMyCurriculum={handleOpenMyCurriculum}
      onStartDueQuick={handleStartDueQuick}
      onStartBookmarked={handleStartBookmarked}
    />
  );
}
