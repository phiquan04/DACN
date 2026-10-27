/**
 * In-progress exam answers, kept in sessionStorage per exam so a reload (or
 * leaving the exam with Back and returning) doesn't wipe the learner's work.
 * Cleared on submit or an explicit "Thoát". sessionStorage, not the URL — the
 * answers are work in progress, not a location worth linking to.
 */
export interface ExamDraft {
  answers: Record<number, number>;
  marked: number[];
  activeSectionIdx: number;
  remainingSeconds: number;
  /** When the learner first opened the exam — keeps the submitted elapsed time honest across reloads. */
  startedAt: number;
  savedAt: number;
}

const keyFor = (examId: number) => `jlpt:examDraft:${examId}`;

export function readExamDraft(examId: number): ExamDraft | null {
  try {
    const raw = sessionStorage.getItem(keyFor(examId));
    return raw ? (JSON.parse(raw) as ExamDraft) : null;
  } catch {
    return null;
  }
}

export function saveExamDraft(examId: number, draft: ExamDraft) {
  try {
    sessionStorage.setItem(keyFor(examId), JSON.stringify(draft));
  } catch {
    // storage blocked or full — the exam still works, it just won't survive a reload
  }
}

export function clearExamDraft(examId: number) {
  try {
    sessionStorage.removeItem(keyFor(examId));
  } catch {
    // ignore
  }
}
