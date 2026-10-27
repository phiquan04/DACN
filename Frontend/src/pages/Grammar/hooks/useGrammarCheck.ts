import { useEffect, useState } from "react";
import {
  correctGrammar,
  fetchAlternatives,
  type GrammarErrorExplanation,
} from "../../../services/grammarApi";

export interface CorrectionResult {
  correctedText: string;
  diffs: string[];
  explanation: GrammarErrorExplanation[];
  historyId: number | null;
}

/** Câu đang nhập + kết quả kiểm tra gần nhất, giữ trong sessionStorage để tải
 * lại trang không mất câu đang gõ dở hay kết quả vừa kiểm tra. Not the URL — a
 * sentence can be long and is work in progress, not a place worth linking to. */
const DRAFT_KEY = "grammar:draft";

interface GrammarDraft {
  sentence: string;
  result: CorrectionResult | null;
  alternatives: string[];
}

function readDraft(): GrammarDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as GrammarDraft) : null;
  } catch {
    return null;
  }
}

/** Grammar-check flow: submit a sentence for correction (with per-error explanation
 * grounded on the model's diff), then optionally ask for alternative phrasings. */
export function useGrammarCheck() {
  const [draft] = useState(readDraft);
  const [sentence, setSentence] = useState(draft?.sentence ?? "");
  const [result, setResult] = useState<CorrectionResult | null>(draft?.result ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>(draft?.alternatives ?? []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ sentence, result, alternatives } satisfies GrammarDraft));
    } catch {
      // storage blocked — the page just won't survive a reload
    }
  }, [sentence, result, alternatives]);
  const [altLoading, setAltLoading] = useState(false);
  const [altError, setAltError] = useState<string | null>(null);

  const handleCheck = async (overrideText?: string) => {
    const text = overrideText ?? sentence;
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setAlternatives([]);

    try {
      const data = await correctGrammar(text);
      setResult({
        correctedText: data.correctedText,
        diffs: data.diffs,
        explanation: data.explanation ?? [],
        historyId: data.history_id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  };

  const handleAlternative = async () => {
    if (!result?.correctedText) return;
    setAltLoading(true);
    setAltError(null);
    setAlternatives([]);

    try {
      const alts = await fetchAlternatives(result.correctedText, result.historyId);
      setAlternatives(alts);
    } catch (err) {
      setAltError(err instanceof Error ? err.message : "Không thể tạo cách diễn đạt khác.");
    } finally {
      setAltLoading(false);
    }
  };

  return {
    sentence,
    setSentence,
    result,
    loading,
    error,
    alternatives,
    altLoading,
    altError,
    handleCheck,
    handleAlternative,
  };
}
