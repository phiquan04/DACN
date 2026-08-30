import { useState } from "react";
import {
  BatchSource,
  VocabularyLearningItem,
  VocabularySetProgress,
  fetchBookmarkedBatch,
  fetchDueBatch,
  fetchStudyBatch,
  fetchStudyOverview,
} from "../../services/vocabularyLearningApi";
import CurriculumDetailView from "./CurriculumDetailView";
import LibraryView from "./LibraryView";
import SessionView from "./SessionView";
import SetDetailView from "./SetDetailView";
import SummaryView from "./SummaryView";
import { BatchOrigin, SessionResult, StudyMode } from "./types";

type View = "library" | "curriculum" | "detail" | "session" | "summary";

const DUE_QUICK_COUNT = 40;

export default function VocabularyLearningHome() {
  const [view, setView] = useState<View>("library");
  const [curriculumGroup, setCurriculumGroup] = useState<{ name: string; sets: VocabularySetProgress[] } | null>(null);
  const [selectedSet, setSelectedSet] = useState<VocabularySetProgress | null>(null);
  const [origin, setOrigin] = useState<BatchOrigin | null>(null);
  const [mode, setMode] = useState<StudyMode>("flashcard");
  const [batch, setBatch] = useState<VocabularyLearningItem[]>([]);
  const [lastSetConfig, setLastSetConfig] = useState<{ source: BatchSource; count: number } | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  const backToLibrary = () => {
    setView("library");
    setCurriculumGroup(null);
    setSelectedSet(null);
    setOrigin(null);
    setBatch([]);
    setResult(null);
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
      const items = await fetchStudyBatch(origin.setId, lastSetConfig.source, lastSetConfig.count);
      setBatch(items);
      setResult(null);
      setView("session");
    } catch {
      // no more words available at this source — surfaced via toast, fall back to the set detail screen
      setView("detail");
    } finally {
      setStarting(false);
    }
  };

  const handleBackToDetail = () => setView("detail");

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

  return (
    <LibraryView
      onSelectSet={handleSelectSet}
      onSelectCurriculum={handleSelectCurriculum}
      onStartDueQuick={handleStartDueQuick}
      onStartBookmarked={handleStartBookmarked}
    />
  );
}
