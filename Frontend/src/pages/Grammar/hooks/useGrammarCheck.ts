import { useState } from "react";
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

/** Grammar-check flow: submit a sentence for correction (with per-error explanation
 * grounded on the model's diff), then optionally ask for alternative phrasings. */
export function useGrammarCheck() {
  const [sentence, setSentence] = useState("");
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [altLoading, setAltLoading] = useState(false);
  const [altError, setAltError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!sentence.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setAlternatives([]);

    try {
      const data = await correctGrammar(sentence);
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
