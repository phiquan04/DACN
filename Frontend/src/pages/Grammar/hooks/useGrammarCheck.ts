import { useState } from "react";

export interface CorrectionResult {
  correctedText: string;
  diffs: string[];
}

/** Grammar-check flow: submit a sentence for correction, then optionally ask for alternative phrasings of the corrected text. */
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
      const response = await fetch("http://127.0.0.1:8080/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentence }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data: CorrectionResult = await response.json();
      setResult(data);
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
      const response = await fetch("http://127.0.0.1:8080/api/alternative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result.correctedText }),
      });

      if (!response.ok) {
        const errData = await response.json();
        console.error("Alternative API error:", JSON.stringify(errData));
        throw new Error(errData?.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setAlternatives(data.alternatives);
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
