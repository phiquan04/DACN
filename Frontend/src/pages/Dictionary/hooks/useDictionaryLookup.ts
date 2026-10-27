import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSetUrlParams, useUrlEnum } from "../../../hooks/useUrlState";
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
import { readRecentLookup, saveRecentLookup } from "./recentLookups";

interface UseDictionaryLookupOptions {
  currentUser: User | null;
  /** Already-loaded search history — checked before hitting the API so re-searching a word
   * looked up before displays instantly from here instead of re-fetching. */
  historyItems: SearchHistoryItem[];
  /** Called once a word has been resolved (fresh search or a history click) — used to (re)load its images/comments. */
  onWordResolved: (word: string) => void;
  /** Called right before a new lookup starts — used to clear the previous word's images/comments. */
  onWordReset: () => void;
  /** Called after a lookup's history row has been saved — used to refresh the sidebar. */
  onSaved: () => void;
}

/** Core dictionary lookup flow: search, restore-from-history, and the examples/synonyms that ride along with it. */
export function useDictionaryLookup({
  currentUser,
  historyItems,
  onWordResolved,
  onWordReset,
  onSaved,
}: UseDictionaryLookupOptions) {
  const navigate = useNavigate();

  // Từ đang xem được giữ trên URL (?q=...) để tải lại trang, chia sẻ link và
  // nút Back/Forward của trình duyệt đều hiển thị đúng từ đó.
  const [searchParams] = useSearchParams();
  const setUrlParams = useSetUrlParams();
  const urlWord = searchParams.get("q") ?? "";
  /** The term most recently passed to a lookup — lets the URL-sync effect tell
   * a URL change it caused itself apart from one made by Back/Forward or a reload. */
  const lastRequestedRef = useRef("");

  const syncUrl = useCallback(
    (word: string) => {
      lastRequestedRef.current = word;
      if (word === urlWord) return;
      // Từ mới -> luôn mở tab Từ vựng; giữ tab khi chỉ là tải lại cùng một từ.
      setUrlParams({ q: word, tab: null }, "push");
    },
    [setUrlParams, urlWord]
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<DictionaryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [activeTab, setActiveTab] = useUrlEnum("tab", ["vocab", "kanji"] as const, "vocab");

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

  /** Renders an already-resolved result instantly (no API calls). `term` is what
   * goes in the URL — it can differ from `result.word` (typing ねこ resolves to 猫),
   * and keeping the typed term stops Back from bouncing between the two. */
  const displayResolved = useCallback(
    (term: string, result: DictionaryResult) => {
      syncUrl(term);
      saveRecentLookup(term, result);
      setError("");
      setSearchPerformed(true);
      setSearchTerm(term);
      setLoading(false);
      setCurrentWord(result.word);
      setResults([result]);
      setExamplesData(result.examples);
      setSynonymsData(result.synonyms);
      setLoadingExamples(false);
      setLoadingSynonyms(false);
      onWordReset();
      onWordResolved(result.word);
    },
    [onWordReset, onWordResolved, syncUrl]
  );

  /** Renders a fully-cached history item instantly and, best-effort, backfills
   * kanji for older entries saved before that field existed. Shared by both a
   * sidebar history click and re-searching a word already in history. */
  const displayCachedItem = useCallback(
    (item: SearchHistoryItem) => {
      const cachedResult: DictionaryResult = {
        word: item.word,
        reading: item.reading,
        definitions: item.definitions,
        examples: item.examples ?? [],
        synonyms: item.synonyms ?? [],
        jlpt: item.jlpt || "N/A",
        frequency: item.frequency || "N/A",
        kanji: item.kanji ?? [],
      };
      displayResolved(item.word, cachedResult);

      // Bản ghi lịch sử cũ (lưu trước khi có trường kanji) chưa có sẵn hán
      // tự -> tra lại một lần để bổ sung, các lần bấm sau sẽ hiện ngay lập tức.
      if (!item.kanji || item.kanji.length === 0) {
        lookupWord(item.word)
          .then((res) => {
            setResults((prev) => prev.map((r) => (r.word === item.word ? { ...r, kanji: res.kanji } : r)));
            saveRecentLookup(item.word, { ...cachedResult, kanji: res.kanji });
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
    },
    [currentUser, displayResolved, onSaved]
  );

  const performSearch = useCallback(
    async (term: string) => {
      const trimmed = term.trim();
      syncUrl(trimmed);
      if (!trimmed) {
        setResults([]);
        setSearchPerformed(false);
        setError("");
        setExamplesData([]);
        setSynonymsData([]);
        onWordReset();
        return;
      }

      // Từ này đã có đầy đủ dữ liệu trong lịch sử tra cứu -> hiển thị ngay,
      // không gọi lại API (lookup + examples + synonyms).
      const cached = historyItems.find(
        (h) => h.word === trimmed && h.definitions && h.definitions.length > 0
      );
      if (cached) {
        displayCachedItem(cached);
        return;
      }

      // Tra trong tab này gần đây (kể cả trước khi tải lại trang / bấm Back)
      // -> hiển thị ngay từ sessionStorage. Có tác dụng cả khi chưa đăng nhập
      // hoặc lịch sử tra cứu chưa tải xong.
      const recent = readRecentLookup(trimmed);
      if (recent) {
        displayResolved(trimmed, recent);
        return;
      }

      setLoading(true);
      setError("");
      setSearchPerformed(true);
      setSearchTerm(trimmed);
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
          saveRecentLookup(trimmed, { ...result, examples, synonyms });

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
    [currentUser, displayCachedItem, displayResolved, historyItems, loadExamples, loadSynonyms, onWordReset, onWordResolved, onSaved, syncUrl]
  );

  // URL đổi mà không phải do chính trang này tra cứu (tải lại trang, mở link
  // có sẵn ?q=, bấm Back/Forward) -> tra cứu theo từ trên URL.
  useEffect(() => {
    if (urlWord !== lastRequestedRef.current) performSearch(urlWord);
  }, [urlWord, performSearch]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      performSearch(searchTerm);
    },
    [performSearch, searchTerm]
  );

  /** Looks up an arbitrary word directly (not from the search bar's current input) —
   * used by e.g. clicking a synonym after confirming in its modal. */
  const searchWord = useCallback(
    (word: string) => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      performSearch(word);
    },
    [performSearch]
  );

  const loadFromHistory = useCallback(
    (item: SearchHistoryItem) => {
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Các mục lịch sử được lưu từ sau khi có tính năng "lưu toàn bộ" đã có
      // sẵn đầy đủ definitions/jlpt/frequency/examples/synonyms/kanji -> hiển
      // thị ngay từ dữ liệu đã lưu, không cần gọi lại API.
      if (item.definitions && item.definitions.length > 0) {
        displayCachedItem(item);
        return;
      }

      // Mục lịch sử cũ (lưu trước khi có tính năng này) chưa có đủ dữ liệu
      // -> tra cứu lại như bình thường.
      performSearch(item.word);
    },
    [displayCachedItem, performSearch]
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
    searchWord,
    loadFromHistory,
    playPronunciation,
    goToPronunciationPractice,
  };
}
