import type { ComponentType } from "react";
import {
  AudioIcon,
  BoxIconLine,
  ChatbotIcon,
  ChatIcon,
  CheckLineIcon,
  DocsIcon,
  GroupIcon,
  PencilIcon,
  TaskIcon,
} from "../../icons";

export type StudyMode =
  | "flashcard"
  | "hanviet"
  | "listen"
  | "pronounce"
  | "type-meaning"
  | "fill-blank"
  | "quiz"
  | "match"
  | "story";

export interface StudyModeDef {
  id: StudyMode;
  name: string;
  description: string;
  /** Operates on the whole batch at once instead of stepping card-by-card. */
  wholeBatch?: boolean;
}

export const STUDY_MODES: StudyModeDef[] = [
  {
    id: "flashcard",
    name: "Flashcard SRS",
    description: "Lật thẻ, tự chấm Lại/Khó/Được/Dễ — hệ thống tự giãn lịch ôn theo SM-2.",
  },
  {
    id: "hanviet",
    name: "Gợi ý Hán Việt",
    description: "Hiện âm Hán Việt trước, đoán nghĩa bằng liên tưởng — dành riêng cho người Việt.",
  },
  {
    id: "listen",
    name: "Nghe & đoán",
    description: "Nghe phát âm rồi mới lộ chữ viết và nghĩa.",
  },
  {
    id: "pronounce",
    name: "Luyện nói từng từ (AI)",
    description: "Đọc to từ, AI chấm điểm phát âm ngay trên thẻ.",
  },
  {
    id: "type-meaning",
    name: "Gõ nghĩa",
    description: "Gõ nghĩa tiếng Việt thay vì bấm thuộc/chưa thuộc — active recall.",
  },
  {
    id: "fill-blank",
    name: "Điền từ vào câu",
    description: "Ẩn từ trong câu ví dụ có sẵn, bạn điền lại đúng từ.",
  },
  {
    id: "quiz",
    name: "Trắc nghiệm 4 đáp án",
    description: "Chọn nghĩa đúng trong 4 lựa chọn — dễ nhất, hợp để khởi động hoặc học nhanh trên điện thoại.",
  },
  {
    id: "match",
    name: "Ghép cặp",
    description: "Ghép từ với nghĩa, tính giờ — luyện phản xạ nhanh.",
    wholeBatch: true,
  },
  {
    id: "story",
    name: "Mini-story AI",
    description: "AI ghép các từ đang học thành đoạn văn ngắn để đọc hiểu.",
    wholeBatch: true,
  },
];

/** Icon per study mode — shared between the mode picker and the in-session header badge. */
export const STUDY_MODE_ICONS: Record<StudyMode, ComponentType<{ className?: string }>> = {
  flashcard: BoxIconLine,
  hanviet: DocsIcon,
  listen: AudioIcon,
  pronounce: ChatbotIcon,
  "type-meaning": PencilIcon,
  "fill-blank": CheckLineIcon,
  quiz: TaskIcon,
  match: GroupIcon,
  story: ChatIcon,
};

/** Where the current batch of words came from — determines what happens on "back". */
export type BatchOrigin =
  | { kind: "set"; setId: number; setName: string; source: "sequential" | "review" }
  | { kind: "due" }
  | { kind: "bookmarked" };

export interface SessionResult {
  total: number;
  learnedCount: number;
  reviewingCount: number;
  againCount: number;
  elapsedSeconds: number;
}
