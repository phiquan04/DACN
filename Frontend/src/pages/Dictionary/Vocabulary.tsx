import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom"; // ✅ thêm useNavigate
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import {
  lookupWord,
  DictionaryResult,
  fetchExamples,
  fetchSynonyms,
  saveSearchHistory,
  fetchSearchHistory,
  deleteHistoryItem,
  clearHistory,
  SearchHistoryItem,
  getStoredUser,
} from "../../services/api";

export default function Vocabulary() {
  const navigate = useNavigate(); // ✅ dùng để điều hướng

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<DictionaryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchPerformed, setSearchPerformed] = useState(false);

  const [examplesData, setExamplesData] = useState<{ japanese: string; vietnamese: string }[]>([]);
  const [synonymsData, setSynonymsData] = useState<string[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [loadingSynonyms, setLoadingSynonyms] = useState(false);
  const [currentWord, setCurrentWord] = useState("");

  // History state
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const currentUser = getStoredUser();

  // Load history on mount
  const loadHistory = useCallback(async () => {
    if (!currentUser) return;
    setLoadingHistory(true);
    try {
      const items = await fetchSearchHistory(currentUser.id);
      setHistory(items);
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSearch(searchTerm);
  };

  // ── Load examples ──
  const loadExamples = useCallback(async (word: string, result?: DictionaryResult) => {
    if (!word) return;
    setLoadingExamples(true);
    try {
      const ex = await fetchExamples(word);
      setExamplesData(ex);

      if (currentUser && ex.length > 0 && result) {
        await saveSearchHistory({
          userId: currentUser.id,
          word: result.word,
          reading: result.reading,
          meaning: result.definitions[0]?.meaning ?? "",
          examples: ex,
          synonyms: [],
        });
      }
    } catch (err) {
      console.error("Failed to load examples:", err);
      setExamplesData([]);
    } finally {
      setLoadingExamples(false);
    }
  }, [currentUser]);

  // ── Load synonyms ──
  const loadSynonyms = useCallback(async (word: string, result?: DictionaryResult) => {
    if (!word) return;
    setLoadingSynonyms(true);
    try {
      const syn = await fetchSynonyms(word);
      setSynonymsData(syn);

      if (currentUser && syn.length > 0 && result) {
        await saveSearchHistory({
          userId: currentUser.id,
          word: result.word,
          reading: result.reading,
          meaning: result.definitions[0]?.meaning ?? "",
          examples: [],
          synonyms: syn,
        });
      }
    } catch (err) {
      console.error("Failed to load synonyms:", err);
      setSynonymsData([]);
    } finally {
      setLoadingSynonyms(false);
    }
  }, [currentUser]);

  const performSearch = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setResults([]);
      setSearchPerformed(false);
      setError("");
      setExamplesData([]);
      setSynonymsData([]);
      return;
    }

    setLoading(true);
    setError("");
    setSearchPerformed(true);
    setSearchTerm(trimmed);
    // Reset ngay khi bắt đầu tìm từ mới
    setExamplesData([]);
    setSynonymsData([]);

    try {
      const result = await lookupWord(trimmed);

      if (result.word && result.definitions.length > 0) {
        setResults([result]);
        setCurrentWord(result.word);

        // Lưu lịch sử cơ bản
        if (currentUser) {
          const firstMeaning = result.definitions[0]?.meaning ?? "";
          await saveSearchHistory({
            userId: currentUser.id,
            word: result.word,
            reading: result.reading,
            meaning: firstMeaning,
          });
          loadHistory(); // không await, chạy ngầm
        }

        // Tự động tải ví dụ và từ đồng nghĩa
        loadExamples(result.word, result);
        loadSynonyms(result.word, result);
      } else {
        setResults([]);
        setCurrentWord("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lookup word");
      setResults([]);
      setCurrentWord("");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Hàm điều hướng sang trang luyện phát âm
  const handlePracticePronunciation = (word: string, reading: string, meaning: string) => {
    // Có thể lưu lại lịch sử nếu chưa có (tuỳ chọn)
    if (currentUser) {
      saveSearchHistory({
        userId: currentUser.id,
        word,
        reading,
        meaning,
      }).catch(console.error);
    }
    navigate(`/check-pronunciation?word=${encodeURIComponent(word)}&reading=${encodeURIComponent(reading)}&meaning=${encodeURIComponent(meaning)}`);
  };

  const handleHistoryClick = (item: SearchHistoryItem) => {
    setSearchTerm(item.word);
    performSearch(item.word);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, item: SearchHistoryItem) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
      await deleteHistoryItem(currentUser.id, item.id);
      setHistory((prev) => prev.filter((h) => h.id !== item.id));
    } catch {
      // silent
    }
  };

  const handleClearHistory = async () => {
    if (!currentUser) return;
    if (!window.confirm("Xóa toàn bộ lịch sử tra cứu?")) return;
    try {
      await clearHistory(currentUser.id);
      setHistory([]);
    } catch {
      // silent
    }
  };

  return (
    <>
      <PageMeta
        title="Tra cứu từ vựng tiếng Nhật"
        description="Trang tra cứu từ điển Nhật - Việt (JMdict-EDICT)"
      />

      {/* Two-column layout: main (large) + history sidebar (small) */}
      <div className="flex gap-5 items-start">
        {/* ===== LEFT: Dictionary lookup ===== */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-3 items-end">
            <div className="flex-1">
              <label
                htmlFor="search"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Tìm kiếm từ vựng (JMdict-EDICT)
              </label>
              <InputField
                id="search"
                type="text"
                placeholder="Nhập từ tiếng Nhật (kanji, hiragana)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button size="sm" disabled={loading}>
              {loading ? "Đang tìm..." : "Tra cứu"}
            </Button>
          </form>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="grid grid-cols-1 gap-5">
              {results.map((item, idx) => (
                <div
                  key={idx}
                  className="w-full max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  {/* Word and Reading - thêm nút luyện phát âm */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white break-words">
                        {item.word}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400 break-words">
                        {item.reading}
                      </span>
                    </div>
                    <button
                      onClick={() => handlePracticePronunciation(item.word, item.reading, item.definitions[0]?.meaning || "")}
                      className="px-3 py-1.5 text-xs bg-brand-500 text-white rounded-md hover:bg-brand-600 transition shadow-sm"
                    >
                      🎤 Luyện phát âm
                    </button>
                  </div>

                  {/* JLPT & Frequency */}
                  <div className="mb-3 flex flex-wrap gap-2">
                    {item.jlpt && item.jlpt !== "N/A" && (
                      <span className="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        JLPT {item.jlpt}
                      </span>
                    )}
                    {item.frequency && item.frequency !== "N/A" && (
                      <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        #{item.frequency}
                      </span>
                    )}
                  </div>

                  {/* Definitions */}
                  <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">📖 Nghĩa</h4>
                    {item.definitions.map((def, defIdx) => (
                      <div key={defIdx} className="text-sm">
                        <p className="text-gray-800 dark:text-gray-200 break-words">{def.meaning}</p>
                        {def.pos && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 break-words">({def.pos})</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Examples box */}
                  <div className="mb-4 p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                    <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        📌 Ví dụ (N4)
                      </h4>
                      {examplesData.length > 0 && !loadingExamples && (
                        <Button size="sm" onClick={() => loadExamples(currentWord, item)}>
                          Làm mới
                        </Button>
                      )}
                    </div>

                    {loadingExamples && (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mt-2" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                      </div>
                    )}

                    {!loadingExamples && examplesData.length > 0 && (
                      <div className="space-y-2">
                        {examplesData.slice(0, 3).map((ex, exIdx) => (
                          <div key={exIdx} className="text-sm">
                            <p className="text-gray-800 dark:text-gray-200 font-medium break-words">{ex.japanese}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 break-words">{ex.vietnamese}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {!loadingExamples && examplesData.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Không tìm được ví dụ.</p>
                    )}
                  </div>

                  {/* Synonyms box */}
                  <div className="p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                    <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        🔗 Từ đồng nghĩa / liên quan
                      </h4>
                      {synonymsData.length > 0 && !loadingSynonyms && (
                        <Button size="sm" onClick={() => loadSynonyms(currentWord, item)}>
                          Làm mới
                        </Button>
                      )}
                    </div>

                    {loadingSynonyms && (
                      <div className="flex gap-2 animate-pulse">
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-14" />
                      </div>
                    )}

                    {!loadingSynonyms && synonymsData.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {synonymsData.slice(0, 8).map((syn, synIdx) => (
                          <span
                            key={synIdx}
                            className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 break-words"
                          >
                            {syn}
                          </span>
                        ))}
                      </div>
                    )}

                    {!loadingSynonyms && synonymsData.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Không tìm được từ đồng nghĩa.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchPerformed && results.length === 0 && !loading && (
            <div className="py-10 text-center text-gray-500 dark:text-gray-400">
              {error ? "Lỗi khi tra cứu từ" : "Không tìm thấy từ vựng phù hợp."}
            </div>
          )}

          {!searchPerformed && (
            <div className="py-10 text-center text-gray-400">
              Nhập từ tiếng Nhật để bắt đầu tra cứu...
            </div>
          )}
        </div>

        {/* ===== RIGHT: Search history sidebar ===== */}
        <aside className="w-64 shrink-0 sticky top-4">
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                🕘 Lịch sử tra cứu
              </h2>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                  title="Xóa toàn bộ lịch sử"
                >
                  Xóa tất cả
                </button>
              )}
            </div>

            {/* Body */}
            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
              {!currentUser && (
                <p className="px-4 py-6 text-xs text-center text-gray-400 dark:text-gray-500">
                  Đăng nhập để lưu lịch sử tra cứu.
                </p>
              )}

              {currentUser && loadingHistory && (
                <p className="px-4 py-6 text-xs text-center text-gray-400 italic">
                  Đang tải...
                </p>
              )}

              {currentUser && !loadingHistory && history.length === 0 && (
                <p className="px-4 py-6 text-xs text-center text-gray-400 dark:text-gray-500">
                  Chưa có từ nào được tra cứu.
                </p>
              )}

              {currentUser && !loadingHistory && history.length > 0 && (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {history.map((item) => (
                    <li
                      key={item.id}
                      className="group flex items-start justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => handleHistoryClick(item)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.word}
                        </p>
                        {item.reading && item.reading !== item.word && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {item.reading}
                          </p>
                        )}
                        {item.meaning && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {item.meaning}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDeleteHistoryItem(e, item)}
                        className="opacity-0 group-hover:opacity-100 shrink-0 text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 transition-all mt-0.5"
                        title="Xóa mục này"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}