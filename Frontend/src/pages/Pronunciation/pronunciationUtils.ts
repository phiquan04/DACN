export interface EvaluationResult {
  overall: number;
  accent: number;
  intonation: number;
  speed: number;
  tip: string;
  recognized_text?: string;
  wrong_word?: boolean;
}

export interface HistoryWord {
  word: string;
  reading: string;
  meaning: string;
}

export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

/** Hàm lấy MIME type thực sự mà trình duyệt hỗ trợ */
export function getSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

// Màu sắc theo ngưỡng điểm (chỉ là ánh xạ hiển thị, không ảnh hưởng logic chấm điểm)
export function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-success-500";
  if (score >= 60) return "bg-warning-500";
  return "bg-error";
}

export function scoreRingColor(score: number): string {
  if (score >= 80) return "text-success-500";
  if (score >= 60) return "text-warning-500";
  return "text-error";
}
