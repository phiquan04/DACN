import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  lookupWord,
  fetchExamples,
  fetchSynonyms,
  saveSearchHistory,
  getPronunciationAudioUrl,
  type DictionaryResult,
  type SearchHistoryItem,
  type User,
} from "../../../services/api";

interface UseDictionaryLookupOptions {
  currentUser: User | null;
  /** Called once a word has been resolved (fresh search or a history click) — used to (re)load its images/comments. */
  onWordResolved: (word: string) => void;
  /** Called right before a new lookup starts — used to clear the previous word's images/comments. */
  onWordReset: () => void;
  /** Called after a lookup's history row has been saved — used to refresh the sidebar. */
  onSaved: () => void;
}

/** Core dictionary lookup flow: search, restore-from-history, and the examples/synonyms that ride along with it. */
export function useDictionaryLookup({ currentUser, onWordResolved, onWordReset, onSaved }: UseDictionaryLookupOptions) {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<DictionaryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [activeTab, setActiveTab] = useState<"vocab" | "kanji">("vocab");

  const [examplesData, setExamplesData] = useState<{ japanese: string; vietnamese: string }[]>([]);
  const [synonymsData, setSynonymsData] = useState<string[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [loadingSynonyms, setLoadingSynonyms] = useState(false);
  const [currentWord, setCurrentWord] = useState("");

  const loadExamples = useCallback(async (word: string) => {
    if (!word) return [];
    setLoadingExamples(true);
    try {
      const ex = await fetchExamples(word);
      setExamplesData(ex);
      return ex;
    } catch (err) {
      console.error("Failed to load examples:", err);
      setExamplesData([]);
      return [];
    } finally {
      setLoadingExamples(false);
    }
  }, []);

  const loadSynonyms = useCallback(async (word: string) => {
    if (!word) return [];
    setLoadingSynonyms(true);
    try {
      const syn = await fetchSynonyms(word);
      setSynonymsData(syn);
      return syn;
    } catch (err) {
      console.error("Failed to load synonyms:", err);
      setSynonymsData([]);
      return [];
    } finally {
      setLoadingSynonyms(false);
    }
  }, []);

  const performSearch = useCallback(
    async (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) {
        setResults([]);
        setSearchPerformed(false);
        setError("");
        setExamplesData([]);
        setSynonymsData([]);
        onWordReset();
        return;
      }

      setLoading(true);
      setError("");
      setSearchPerformed(true);
      setSearchTerm(trimmed);
      setActiveTab("vocab");
      // Reset ngay khi bắt đầu tìm từ mới
      setExamplesData([]);
      setSynonymsData([]);
      onWordReset();

      try {
        const result = await lookupWord(trimmed);

        if (result.word && result.definitions.length > 0) {
          setResults([result]);
          setCurrentWord(result.word);
          setLoading(false);

          // Tải ví dụ + từ đồng nghĩa song song, rồi lưu MỘT LẦN toàn bộ kết
          // quả (định nghĩa, jlpt, frequency, ví dụ, từ đồng nghĩa) vào lịch
          // sử — để lần sau bấm vào từ trong lịch sử là hiển thị ngay lập
          // tức, không phải tra cứu lại từ đầu.
          const [examples, synonyms] = await Promise.all([
            loadExamples(result.word),
            loadSynonyms(result.word),
          ]);
          onWordResolved(result.word);

          if (currentUser) {
            await saveSearchHistory({
              userId: currentUser.id,
              word: result.word,
              reading: result.reading,
              meaning: result.definitions[0]?.meaning ?? "",
              definitions: result.definitions,
              examples,
              synonyms,
              jlpt: result.jlpt,
              frequency: result.frequency,
              kanji: result.kanji,
            });
            onSaved();
          }
        } else {
          setResults([]);
          setCurrentWord("");
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to lookup word");
        setResults([]);
        setCurrentWord("");
        setLoading(false);
      }
    },
    [currentUser, loadExamples, loadSynonyms, onWordReset, onWordResolved, onSaved]
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      performSearch(searchTerm);
    },
    [performSearch, searchTerm]
  );

  const loadFromHistory = useCallback(
    (item: SearchHistoryItem) => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setSearchTerm(item.word);

      // Các mục lịch sử được lưu từ sau khi có tính năng "lưu toàn bộ" đã có
      // sẵn đầy đủ definitions/jlpt/frequency/examples/synonyms/kanji -> hiển
      // thị ngay từ dữ liệu đã lưu, không cần gọi lại API.
      if (item.definitions && item.definitions.length > 0) {
        setError("");
        setSearchPerformed(true);
        setLoading(false);
        setActiveTab("vocab");
        setCurrentWord(item.word);
        setResults([
          {
            word: item.word,
            reading: item.reading,
            definitions: item.definitions,
            examples: item.examples ?? [],
            synonyms: item.synonyms ?? [],
            jlpt: item.jlpt || "N/A",
            frequency: item.frequency || "N/A",
            kanji: item.kanji ?? [],
          },
        ]);
        setExamplesData(item.examples ?? []);
        setSynonymsData(item.synonyms ?? []);
        setLoadingExamples(false);
        setLoadingSynonyms(false);
        onWordReset();
        onWordResolved(item.word);
        // Bản ghi lịch sử cũ (lưu trước khi có trường kanji) chưa có sẵn hán
        // tự -> tra lại một lần để bổ sung, các lần bấm sau sẽ hiện ngay lập tức.
        if (!item.kanji || item.kanji.length === 0) {
          lookupWord(item.word)
            .then((res) => {
              setResults((prev) =>
                prev.map((r) => (r.word === item.word ? { ...r, kanji: res.kanji } : r))
              );
              if (currentUser && res.kanji.length > 0) {
                saveSearchHistory({
                  userId: currentUser.id,
                  word: item.word,
                  reading: item.reading,
                  meaning: item.meaning,
                  definitions: item.definitions,
                  examples: item.examples,
                  synonyms: item.synonyms,
                  jlpt: item.jlpt,
                  frequency: item.frequency,
                  kanji: res.kanji,
                }).then(onSaved);
              }
            })
            .catch(() => {
              // best-effort — kanji tab just stays empty if this fails
            });
        }
        return;
      }

      // Mục lịch sử cũ (lưu trước khi có tính năng này) chưa có đủ dữ liệu
      // -> tra cứu lại như bình thường.
      performSearch(item.word);
    },
    [currentUser, onSaved, onWordReset, onWordResolved, performSearch]
  );

  const playPronunciation = useCallback((text: string) => {
    if (!text) return;
    new Audio(getPronunciationAudioUrl(text)).play().catch(() => {
      // silent — audio may fail to load/play, not worth surfacing an error
    });
  }, []);

  const goToPronunciationPractice = useCallback(
    (word: string, reading: string, meaning: string) => {
      if (currentUser) {
        saveSearchHistory({ userId: currentUser.id, word, reading, meaning }).catch(console.error);
      }
      navigate(
        `/check-pronunciation?word=${encodeURIComponent(word)}&reading=${encodeURIComponent(reading)}&meaning=${encodeURIComponent(meaning)}`
      );
    },
    [currentUser, navigate]
  );

  return {
    searchTerm,
    setSearchTerm,
    results,
    loading,
    error,
    searchPerformed,
    activeTab,
    setActiveTab,
    examplesData,
    synonymsData,
    loadingExamples,
    loadingSynonyms,
    currentWord,
    handleSearch,
    loadFromHistory,
    playPronunciation,
    goToPronunciationPractice,
  };
}
