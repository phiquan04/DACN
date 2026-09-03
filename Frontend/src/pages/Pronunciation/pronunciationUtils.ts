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

export interface Encouragement {
  title: string;
  message: string;
  tone: "success" | "warning" | "error";
}

/** Short verdict + tip shown next to the score ring, keyed off the same thresholds as
 * scoreBarColor/scoreRingColor so the tone always matches the ring color. */
export function getEncouragement(evaluation: EvaluationResult): Encouragement {
  if (evaluation.wrong_word) {
    return { title: "Đừng nản lòng!", message: "Nghe kỹ từ mẫu rồi thử phát âm lại nhé.", tone: "error" };
  }
  if (evaluation.overall >= 80) {
    return { title: "Xuất sắc!", message: "Phát âm của bạn rất chuẩn, tiếp tục phát huy nhé.", tone: "success" };
  }
  if (evaluation.overall >= 60) {
    return { title: "Khá tốt!", message: "Bạn đang tiến bộ, hãy chú ý thêm phần ngữ điệu.", tone: "warning" };
  }
  return { title: "Cố gắng thêm nhé!", message: "Luyện tập nhiều hơn sẽ giúp bạn cải thiện nhanh chóng.", tone: "error" };
}

export function encouragementBadgeClass(tone: Encouragement["tone"]): string {
  if (tone === "success") return "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400";
  if (tone === "warning") return "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400";
  return "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-red-400";
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
