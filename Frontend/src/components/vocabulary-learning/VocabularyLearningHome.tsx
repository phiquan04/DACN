import { useState } from "react";
import {
  BatchSource,
  MyCurriculum,
  MySet,
  VocabularyLearningItem,
  VocabularySetProgress,
  fetchBookmarkedBatch,
  fetchDueBatch,
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

type View = "library" | "curriculum" | "detail" | "session" | "summary" | "myCurriculum" | "mySet";

const DUE_QUICK_COUNT = 40;

export default function VocabularyLearningHome() {
  const [view, setView] = useState<View>("library");
  const [curriculumGroup, setCurriculumGroup] = useState<{ name: string; sets: VocabularySetProgress[] } | null>(null);
  const [selectedSet, setSelectedSet] = useState<VocabularySetProgress | null>(null);
  const [myCurriculum, setMyCurriculum] = useState<MyCurriculum | null>(null);
  const [mySetId, setMySetId] = useState<number | null>(null);
  const [origin, setOrigin] = useState<BatchOrigin | null>(null);
  const [mode, setMode] = useState<StudyMode>("flashcard");
  const [batch, setBatch] = useState<VocabularyLearningItem[]>([]);
  const [lastSetConfig, setLastSetConfig] = useState<{ source: BatchSource; count: number } | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  // Whether the in-progress/just-finished session was started from a private
  // "bộ từ của tôi" set rather than a public one — origin.kind is "set" for
  // both, so this is what lets "back to detail"/"continue" know whether to
  // route to MySetDetailView (+ fetchMyStudyBatch) or SetDetailView (+ fetchStudyBatch).
  const [sessionFromMySet, setSessionFromMySet] = useState(false);

  const backToLibrary = () => {
    setView("library");
    setCurriculumGroup(null);
    setSelectedSet(null);
    setMyCurriculum(null);
    setMySetId(null);
    setOrigin(null);
    setBatch([]);
    setResult(null);
    setSessionFromMySet(false);
  };

  const handleOpenMyCurriculum = (curriculum: MyCurriculum) => {
    setMyCurriculum(curriculum);
    setView("myCurriculum");
  };

  const handleBackFromMyCurriculum = () => {
    setMyCurriculum(null);
    setView("library");
  };

  const handleMyCurriculumDeleted = () => {
    setMyCurriculum(null);
    setView("library");
  };

  const handleOpenMySet = (set: MySet) => {
    setMySetId(set.id);
    setView("mySet");
  };

  const handleBackFromMySet = () => {
    // Item counts on the set cards can be stale after adding/removing words
    // inside MySetDetailView — refresh the curriculum on the way back rather
    // than carrying the snapshot taken when it was first opened.
    if (myCurriculum) {
      fetchMyCurriculums()
        .then((all) => setMyCurriculum(all.find((c) => c.id === myCurriculum.id) ?? myCurriculum))
        .catch(() => {});
    }
    setView("myCurriculum");
  };

  const handleMySetDeleted = () => {
    setMySetId(null);
    // Same refresh as a plain "back": without it the deleted bài would still
    // be listed in the curriculum snapshot.
    handleBackFromMySet();
  };

  const handleSelectCurriculum = (name: string, sets: VocabularySetProgress[]) => {
    setCurriculumGroup({ name, sets });
    setView("curriculum");
  };

  const handleBackFromCurriculum = () => {
    setCurriculumGroup(null);
    setView("library");
  };

  const handleSelectSet = (set: VocabularySetProgress) => {
    setSelectedSet(set);
    setView("detail");
  };

  // A set can be opened either straight from the library (standalone, no
  // curriculum) or from inside a curriculum's set list — "back" needs to
  // return to whichever of those the user actually came from.
  const handleBackFromDetail = () => setView(curriculumGroup ? "curriculum" : "library");

  const handleStartFromDetail = async (studyMode: StudyMode, count: number, source: BatchSource) => {
    if (!selectedSet) return;
    setStarting(true);
    try {
      const items = await fetchStudyBatch(selectedSet.id, source, count);
      setBatch(items);
      setMode(studyMode);
      setOrigin({ kind: "set", setId: selectedSet.id, setName: selectedSet.set_name, source });
      setLastSetConfig({ source, count });
      setSessionFromMySet(false);
      setView("session");
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
      setBatch(items);
      setMode(studyMode);
      setOrigin({ kind: "set", setId: mySetId, setName, source });
      setLastSetConfig({ source, count });
      setSessionFromMySet(true);
      setView("session");
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
      setBatch(items);
      setMode("flashcard");
      setOrigin({ kind: "due" });
      setView("session");
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
      setBatch(items);
      setMode(studyMode);
      setOrigin({ kind: "bookmarked" });
      setView("session");
    } catch {
      // reported globally
    } finally {
      setStarting(false);
    }
  };

  const handleSessionComplete = (sessionResult: SessionResult) => {
    setResult(sessionResult);
    setView("summary");
    fetchStudyOverview()
      .then((overview) => setStreakDays(overview.streak_days))
      .catch(() => setStreakDays(null));
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
      setView("session");
    } catch {
      // no more words available at this source — surfaced via toast, fall back to the set detail screen
      setView(sessionFromMySet ? "mySet" : "detail");
    } finally {
      setStarting(false);
    }
  };

  const handleBackToDetail = () => setView(sessionFromMySet ? "mySet" : "detail");

  if (view === "session") {
    return <SessionView batch={batch} mode={mode} onExit={backToLibrary} onComplete={handleSessionComplete} />;
  }

  if (view === "summary" && result && origin) {
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

  if (view === "detail" && selectedSet) {
    return (
      <SetDetailView
        setId={selectedSet.id}
        onBack={handleBackFromDetail}
        onStart={handleStartFromDetail}
        starting={starting}
      />
    );
  }

  if (view === "curriculum" && curriculumGroup) {
    return (
      <CurriculumDetailView
        curriculumName={curriculumGroup.name}
        sets={curriculumGroup.sets}
        onSelectSet={handleSelectSet}
        onBack={handleBackFromCurriculum}
      />
    );
  }

  if (view === "mySet" && mySetId !== null) {
    return (
      <MySetDetailView
        setId={mySetId}
        onBack={handleBackFromMySet}
        onDeleted={handleMySetDeleted}
        onStart={handleStartFromMySet}
        starting={starting}
      />
    );
  }

  if (view === "myCurriculum" && myCurriculum) {
    return (
      <MyCurriculumDetailView
        curriculum={myCurriculum}
        onBack={handleBackFromMyCurriculum}
        onOpenSet={handleOpenMySet}
        onDeleted={handleMyCurriculumDeleted}
      />
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
