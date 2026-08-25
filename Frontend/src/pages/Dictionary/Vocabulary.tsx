import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom"; // ✅ thêm useNavigate
import PageMeta from "../../components/common/PageMeta";
import InputField from "../../components/form/input/InputField";
import {
  lookupWord,
  DictionaryResult,
  DictionaryDefinition,
  fetchExamples,
  fetchSynonyms,
  saveSearchHistory,
  fetchSearchHistory,
  deleteHistoryItem,
  clearHistory,
  getPronunciationAudioUrl,
  fetchImages,
  uploadImage,
  deleteImage,
  DictionaryImageItem,
  fetchComments,
  postComment,
  deleteComment,
  voteComment,
  DictionaryCommentItem,
  SearchHistoryItem,
  getStoredUser,
} from "../../services/api";

/** Wraps every occurrence of `word` inside `text` in a highlighted span. */
function highlightWord(text: string, word: string): React.ReactNode {
  if (!word || !text.includes(word)) return text;
  const parts = text.split(word);
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (i > 0) {
      nodes.push(
        <span key={`hl-${i}`} className="font-semibold text-secondary dark:text-secondary-fixed-dim">
          {word}
        </span>
      );
    }
    if (part) nodes.push(<span key={`t-${i}`}>{part}</span>);
  });
  return nodes;
}

/** Distinct part-of-speech labels across every sense of a word, for the header badges. */
function uniquePosLabels(definitions: DictionaryDefinition[]): string[] {
  const labels = definitions.map((d) => d.pos_label || d.pos).filter(Boolean);
  return Array.from(new Set(labels));
}

const COMMENTS_PER_PAGE = 10;

/** KanjiVG's file naming: lowercase hex of the Unicode code point, zero-padded to 5 digits. */
function kanjiVgUrl(literal: string): string {
  const codePoint = literal.codePointAt(0);
  if (!codePoint) return "";
  return `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${codePoint.toString(16).padStart(5, "0")}.svg`;
}

/** Stroke-order diagram for one kanji (numbered strokes, from KanjiVG), falling back to the plain glyph if unavailable. */
function KanjiStrokeDiagram({ literal }: { literal: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="flex h-28 w-28 shrink-0 items-center justify-center text-6xl font-bold leading-none text-gray-900 dark:text-white">
        {literal}
      </span>
    );
  }

  return (
    <img
      src={kanjiVgUrl(literal)}
      alt={literal}
      title={`Thứ tự nét chữ "${literal}" — dữ liệu từ KanjiVG`}
      onError={() => setFailed(true)}
      className="h-28 w-28 shrink-0 rounded-lg bg-white p-1 dark:bg-gray-50"
    />
  );
}

export default function Vocabulary() {
  const navigate = useNavigate(); // ✅ dùng để điều hướng

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

  // History state
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Community images & comments state
  const [images, setImages] = useState<DictionaryImageItem[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [comments, setComments] = useState<DictionaryCommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);

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

  const playPronunciation = (text: string) => {
    if (!text) return;
    new Audio(getPronunciationAudioUrl(text)).play().catch(() => {
      // silent — audio may fail to load/play, not worth surfacing an error
    });
  };

  // ── Load examples ──
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

  // ── Load synonyms ──
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

  // ── Ảnh minh họa cộng đồng ──
  const loadImages = useCallback(async (word: string) => {
    if (!word) return;
    setLoadingImages(true);
    try {
      setImages(await fetchImages(word));
    } catch {
      setImages([]);
    } finally {
      setLoadingImages(false);
    }
  }, []);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại cùng 1 file lần sau
    if (!file || !currentUser || !currentWord) return;
    setUploadingImage(true);
    try {
      const img = await uploadImage({ word: currentWord, file });
      setImages((prev) => [img, ...prev]);
    } catch (err) {
      console.error("Failed to upload image:", err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (image: DictionaryImageItem) => {
    if (!currentUser) return;
    try {
      await deleteImage(image.id);
      setImages((prev) => prev.filter((i) => i.id !== image.id));
    } catch {
      // silent
    }
  };

  // ── Bình luận / đóng góp ý kiến ──
  const loadComments = useCallback(async (word: string) => {
    if (!word) return;
    setLoadingComments(true);
    setCommentsPage(1);
    try {
      setComments(await fetchComments(word, currentUser?.id));
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [currentUser]);

  const handlePostComment = async () => {
    const content = newComment.trim();
    if (!content || !currentUser || !currentWord) return;
    setPostingComment(true);
    try {
      const comment = await postComment({ word: currentWord, content });
      setComments((prev) => [comment, ...prev]);
      setCommentsPage(1);
      setNewComment("");
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (comment: DictionaryCommentItem) => {
    if (!currentUser) return;
    try {
      await deleteComment(comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
    } catch {
      // silent
    }
  };

  const handleVoteComment = async (comment: DictionaryCommentItem, voteType: "up" | "down") => {
    if (!currentUser) return;
    try {
      const updated = await voteComment(comment.id, voteType);
      setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      console.error("Failed to vote:", err);
    }
  };

  const performSearch = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setResults([]);
      setSearchPerformed(false);
      setError("");
      setExamplesData([]);
      setSynonymsData([]);
      setImages([]);
      setComments([]);
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
    setImages([]);
    setComments([]);
    setNewComment("");

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
        loadImages(result.word);
        loadComments(result.word);

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
          });
          loadHistory(); // không await, chạy ngầm
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
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSearchTerm(item.word);

    // Các mục lịch sử được lưu từ sau khi có tính năng "lưu toàn bộ" đã có
    // sẵn đầy đủ definitions/jlpt/frequency/examples/synonyms -> hiển thị
    // ngay từ dữ liệu đã lưu, không cần gọi lại API.
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
          kanji: [],
        },
      ]);
      setExamplesData(item.examples ?? []);
      setSynonymsData(item.synonyms ?? []);
      setLoadingExamples(false);
      setLoadingSynonyms(false);
      setImages([]);
      setComments([]);
      setNewComment("");
      loadImages(item.word);
      loadComments(item.word);
      // Saved history rows don't store the kanji breakdown, so fetch it
      // separately (lookup is cached server-side) instead of showing an
      // incorrect "no kanji" state for words that do have kanji.
      lookupWord(item.word)
        .then((res) => {
          setResults((prev) =>
            prev.map((r) => (r.word === item.word ? { ...r, kanji: res.kanji } : r))
          );
        })
        .catch(() => {
          // best-effort — kanji tab just stays empty if this fails
        });
      return;
    }

    // Mục lịch sử cũ (lưu trước khi có tính năng này) chưa có đủ dữ liệu
    // -> tra cứu lại như bình thường.
    performSearch(item.word);
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
          <form onSubmit={handleSearch} className="flex gap-3 items-center">
            <div className="relative flex-1">
              <InputField
                id="search"
                type="text"
                placeholder="Nhập từ tiếng Nhật (kanji, hiragana)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
                className="!rounded-full !pl-5 !pr-12 !py-3 !border-outline-variant/60 dark:!border-gray-700"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline dark:text-gray-500"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="shrink-0 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50 dark:bg-primary-container dark:hover:bg-brand-700"
            >
              {loading ? "Đang tìm..." : "Tra cứu"}
            </button>
          </form>

          {/* Tabs: Từ vựng / Hán tự */}
          {results.length > 0 && (
            <div className="flex w-fit gap-1 rounded-full bg-surface-container p-1 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setActiveTab("vocab")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "vocab"
                    ? "bg-surface-container-lowest text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-brand-400"
                    : "text-on-surface-variant hover:text-on-surface dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Từ vựng
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("kanji")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "kanji"
                    ? "bg-surface-container-lowest text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-brand-400"
                    : "text-on-surface-variant hover:text-on-surface dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Hán tự
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-error/30 bg-error-container p-4 text-on-error-container dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="grid grid-cols-1 gap-5">
              {results.map((item, idx) => (
                <div key={idx} className="w-full max-w-full space-y-5">
                  {/* ===== Word card: title, reading/POS, meaning, kanji breakdown ===== */}
                  <div className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 lang="ja" className="text-3xl font-bold text-gray-900 dark:text-white break-words">
                          {item.word}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {item.reading && (
                            <span className="text-sm text-outline dark:text-gray-400 break-words">
                              {item.reading}
                            </span>
                          )}
                          {uniquePosLabels(item.definitions).map((pos) => (
                            <span
                              key={pos}
                              className="inline-block rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant dark:bg-gray-800 dark:text-gray-300"
                            >
                              {pos}
                            </span>
                          ))}
                          {item.jlpt && item.jlpt !== "N/A" && (
                            <span className="inline-block rounded-full bg-primary-fixed px-2.5 py-1 text-xs font-medium text-on-primary-fixed">
                              JLPT {item.jlpt}
                            </span>
                          )}
                          {item.frequency && item.frequency !== "N/A" && (
                            <span className="inline-block rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant dark:bg-gray-800 dark:text-gray-300">
                              #{item.frequency}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => playPronunciation(item.reading || item.word)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/60 px-4 py-2 text-sm font-medium text-on-surface-variant hover:border-brand-500 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.79L4.117 13.5H2a1 1 0 01-1-1v-5a1 1 0 011-1h2.117l4.266-3.29a1 1 0 011-.134zM14.657 5.343a1 1 0 011.414 0A7.975 7.975 0 0118 10a7.975 7.975 0 01-1.929 5.657 1 1 0 11-1.414-1.414A5.975 5.975 0 0016 10a5.975 5.975 0 00-1.343-4.243 1 1 0 010-1.414z" />
                          </svg>
                          Phát âm
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handlePracticePronunciation(item.word, item.reading, item.definitions[0]?.meaning ?? "")
                          }
                          className="shrink-0 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Luyện phát âm
                        </button>
                      </div>
                    </div>

                    {/* Meaning: primary sense large, remaining senses listed below */}
                    {item.definitions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-lg text-gray-900 dark:text-gray-100 break-words">
                          {item.definitions[0].meaning}
                        </p>
                        {item.definitions.slice(1).map((def, defIdx) => (
                          <p key={defIdx} className="text-sm text-gray-600 dark:text-gray-400 break-words">
                            {def.meaning}
                            {(def.pos_label || def.pos) && (
                              <span className="text-outline dark:text-gray-500"> ({def.pos_label || def.pos})</span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Kanji breakdown (compact preview — full detail lives in the "Hán tự" tab) */}
                    {item.kanji.length > 0 && (
                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {item.kanji.map((k) => (
                          <div key={k.literal} className="rounded-xl bg-surface-container p-4 dark:bg-gray-800">
                            <div className="flex items-start gap-3">
                              <span className="shrink-0 text-5xl font-bold leading-none text-gray-900 dark:text-white">
                                {k.literal}
                              </span>
                              <div className="min-w-0 flex-1 space-y-1 text-sm">
                                {k.on_yomi.length > 0 && (
                                  <p className="text-gray-700 dark:text-gray-300 break-words">
                                    <span className="font-medium text-gray-500 dark:text-gray-400">On: </span>
                                    {k.on_yomi.join("、")}
                                  </p>
                                )}
                                {k.kun_yomi.length > 0 && (
                                  <p className="text-gray-700 dark:text-gray-300 break-words">
                                    <span className="font-medium text-gray-500 dark:text-gray-400">Kun: </span>
                                    {k.kun_yomi.join("、")}
                                  </p>
                                )}
                                {k.hanviet.length > 0 && (
                                  <p className="text-gray-500 dark:text-gray-400 break-words">
                                    <span className="font-medium capitalize text-gray-700 dark:text-gray-300">
                                      {k.hanviet[0]}
                                    </span>
                                    {k.meaning ? `: ${k.meaning}` : ""}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ===== Tab: Từ vựng — supporting cards ===== */}
                  {activeTab === "vocab" && (
                    <>
                      {/* Examples card */}
                      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
                        <h4 className="mb-4 text-base font-semibold text-on-surface dark:text-gray-100">Ví dụ</h4>

                        {loadingExamples && (
                          <div className="space-y-2 animate-pulse">
                            <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-3/4" />
                            <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-1/2" />
                            <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-3/4 mt-2" />
                            <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-1/2" />
                          </div>
                        )}

                        {!loadingExamples && examplesData.length > 0 && (
                          <div>
                            {examplesData.slice(0, 3).map((ex, exIdx) => (
                              <div
                                key={exIdx}
                                className={
                                  exIdx > 0 ? "mt-4 border-t border-outline-variant/60 pt-4 dark:border-gray-700" : ""
                                }
                              >
                                <p lang="ja" className="text-base text-on-surface font-medium dark:text-gray-200 break-words">
                                  {highlightWord(ex.japanese, item.word)}
                                </p>
                                <p className="mt-1 text-sm text-on-surface-variant dark:text-gray-400 break-words">{ex.vietnamese}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {!loadingExamples && examplesData.length === 0 && (
                          <p className="text-xs text-outline italic">Không tìm được ví dụ.</p>
                        )}
                      </div>

                      {/* Synonyms card */}
                      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
                        <h4 className="mb-4 text-base font-semibold text-on-surface dark:text-gray-100">
                          Từ đồng nghĩa
                        </h4>

                        {loadingSynonyms && (
                          <div className="flex gap-2 animate-pulse">
                            <div className="h-7 bg-surface-container-high dark:bg-gray-700 rounded-full w-16" />
                            <div className="h-7 bg-surface-container-high dark:bg-gray-700 rounded-full w-20" />
                            <div className="h-7 bg-surface-container-high dark:bg-gray-700 rounded-full w-14" />
                          </div>
                        )}

                        {!loadingSynonyms && synonymsData.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {synonymsData.slice(0, 8).map((syn, synIdx) => (
                              <span
                                key={synIdx}
                                className="inline-block rounded-full bg-secondary-container px-3.5 py-1.5 text-sm font-medium text-on-secondary-container break-words"
                              >
                                {syn}
                              </span>
                            ))}
                          </div>
                        )}

                        {!loadingSynonyms && synonymsData.length === 0 && (
                          <p className="text-xs text-outline italic">Không tìm được từ đồng nghĩa.</p>
                        )}
                      </div>

                      {/* Images card */}
                      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-base font-semibold text-on-surface dark:text-gray-100">
                            Ảnh minh họa
                          </h4>
                          {currentUser && (
                            <label className="cursor-pointer text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                              {uploadingImage ? "Đang tải lên..." : "+ Thêm ảnh"}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingImage}
                                onChange={handleUploadImage}
                              />
                            </label>
                          )}
                        </div>

                        {loadingImages && (
                          <div className="flex flex-wrap gap-3 animate-pulse">
                            <div className="h-40 w-40 bg-surface-container-high dark:bg-gray-700 rounded-xl" />
                            <div className="h-40 w-40 bg-surface-container-high dark:bg-gray-700 rounded-xl" />
                          </div>
                        )}

                        {!loadingImages && images.length > 0 && (
                          <div className="flex flex-wrap gap-3">
                            {images.map((img) => (
                              <div key={img.id} className="group relative">
                                <img
                                  src={img.image_url}
                                  alt={img.caption || item.word}
                                  title={`${img.caption || ""}${img.caption ? " — " : ""}bởi ${img.uploader_username}`}
                                  className="h-40 w-40 rounded-xl object-cover border border-outline-variant/60 dark:border-gray-700"
                                />
                                {currentUser?.id === img.uploaded_by && (
                                  <button
                                    onClick={() => handleDeleteImage(img)}
                                    title="Xóa ảnh"
                                    className="absolute -top-1.5 -right-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-error text-on-error text-sm group-hover:flex"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {!loadingImages && images.length === 0 && (
                          <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/60 text-outline dark:border-gray-700 dark:text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                            <p className="text-xs italic">Chưa có ảnh minh họa nào.</p>
                          </div>
                        )}
                      </div>

                      {/* Comments card */}
                      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
                        <h4 className="mb-4 text-base font-semibold text-on-surface dark:text-gray-100">
                          Đóng góp ý kiến
                        </h4>

                        {currentUser ? (
                          <div className="mb-4 flex items-center gap-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-semibold text-on-primary-fixed">
                              {currentUser.username?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <input
                              type="text"
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                              placeholder="Chia sẻ cách hiểu, ví dụ của bạn..."
                              disabled={postingComment}
                              className="flex-1 rounded-full border border-outline-variant/60 bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                            />
                            <button
                              type="button"
                              disabled={postingComment || !newComment.trim()}
                              onClick={handlePostComment}
                              className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-50 dark:bg-primary-container"
                            >
                              Gửi
                            </button>
                          </div>
                        ) : (
                          <p className="mb-3 text-xs text-outline italic">Đăng nhập để đóng góp ý kiến.</p>
                        )}

                        {loadingComments && (
                          <div className="space-y-2 animate-pulse">
                            <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-2/3" />
                            <div className="h-3 bg-surface-container-high dark:bg-gray-700 rounded w-1/2" />
                          </div>
                        )}

                        {!loadingComments && comments.length > 0 && (() => {
                          const totalPages = Math.max(1, Math.ceil(comments.length / COMMENTS_PER_PAGE));
                          const page = Math.min(commentsPage, totalPages);
                          const pageComments = comments.slice(
                            (page - 1) * COMMENTS_PER_PAGE,
                            page * COMMENTS_PER_PAGE
                          );
                          return (
                            <>
                              <ul className="space-y-3">
                                {pageComments.map((c) => (
                                  <li key={c.id} className="flex items-start gap-2.5 text-sm">
                                    {c.avatar_url ? (
                                      <img
                                        src={c.avatar_url}
                                        alt={c.username}
                                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-semibold text-on-surface-variant dark:bg-gray-700 dark:text-gray-300">
                                        {c.username?.[0]?.toUpperCase() ?? "?"}
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <span className="font-medium text-on-surface dark:text-gray-200">{c.username}</span>{" "}
                                          <span className="text-on-surface-variant dark:text-gray-300 break-words">{c.content}</span>
                                        </div>
                                        {currentUser?.id === c.user_id && (
                                          <button
                                            onClick={() => handleDeleteComment(c)}
                                            className="shrink-0 text-xs text-outline-variant hover:text-error dark:text-gray-600"
                                            title="Xóa bình luận"
                                          >
                                            Xóa
                                          </button>
                                        )}
                                      </div>
                                      <div className="mt-1 flex items-center gap-3 text-xs text-outline">
                                        <button
                                          onClick={() => handleVoteComment(c, "up")}
                                          disabled={!currentUser}
                                          className={`hover:text-brand-600 ${c.my_vote === "up" ? "text-brand-600 font-medium" : ""}`}
                                        >
                                          👍 {c.upvotes}
                                        </button>
                                        <button
                                          onClick={() => handleVoteComment(c, "down")}
                                          disabled={!currentUser}
                                          className={`hover:text-error ${c.my_vote === "down" ? "text-error font-medium" : ""}`}
                                        >
                                          👎 {c.downvotes}
                                        </button>
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>

                              {totalPages > 1 && (
                                <div className="mt-4 flex items-center justify-center gap-3 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => setCommentsPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="rounded-full border border-outline-variant/60 px-3 py-1 font-medium text-on-surface-variant hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 disabled:hover:border-outline-variant/60 disabled:hover:text-on-surface-variant dark:border-gray-700 dark:text-gray-300"
                                  >
                                    ‹ Trước
                                  </button>
                                  <span className="text-outline dark:text-gray-500">
                                    Trang {page}/{totalPages}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setCommentsPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="rounded-full border border-outline-variant/60 px-3 py-1 font-medium text-on-surface-variant hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 disabled:hover:border-outline-variant/60 disabled:hover:text-on-surface-variant dark:border-gray-700 dark:text-gray-300"
                                  >
                                    Sau ›
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {!loadingComments && comments.length === 0 && (
                          <p className="text-xs text-outline italic">Chưa có ý kiến đóng góp nào.</p>
                        )}
                      </div>
                    </>
                  )}

                  {/* ===== Tab: Hán tự ===== */}
                  {activeTab === "kanji" && (
                    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
                      {item.kanji.length > 0 ? (
                        item.kanji.map((k, kIdx) => (
                          <div
                            key={k.literal}
                            className={`py-5 ${
                              kIdx > 0 ? "border-t border-outline-variant/60 dark:border-gray-700" : "pt-0"
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <KanjiStrokeDiagram literal={k.literal} />
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  {k.hanviet.length > 0 && (
                                    <span className="rounded-full bg-primary-fixed px-3 py-1 text-sm font-semibold text-on-primary-fixed break-words">
                                      {k.hanviet.join(", ")}
                                    </span>
                                  )}
                                  {k.jlpt && (
                                    <span className="inline-block rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                                      JLPT {k.jlpt}
                                    </span>
                                  )}
                                  {k.grade && (
                                    <span className="inline-block rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                                      Lớp {k.grade}
                                    </span>
                                  )}
                                  {k.stroke_count != null && (
                                    <span className="inline-block rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                                      {k.stroke_count} nét
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => playPronunciation(k.literal)}
                                    title="Nghe âm đọc"
                                    className="shrink-0 rounded-full p-1.5 text-outline hover:bg-surface-container-high hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.79L4.117 13.5H2a1 1 0 01-1-1v-5a1 1 0 011-1h2.117l4.266-3.29a1 1 0 011-.134zM14.657 5.343a1 1 0 011.414 0A7.975 7.975 0 0118 10a7.975 7.975 0 01-1.929 5.657 1 1 0 11-1.414-1.414A5.975 5.975 0 0016 10a5.975 5.975 0 00-1.343-4.243 1 1 0 010-1.414z" />
                                    </svg>
                                  </button>
                                </div>

                                {k.on_yomi.length > 0 && (
                                  <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                                    <span className="font-medium text-gray-500 dark:text-gray-400">On: </span>
                                    {k.on_yomi.join("、")}
                                  </p>
                                )}
                                {k.kun_yomi.length > 0 && (
                                  <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                                    <span className="font-medium text-gray-500 dark:text-gray-400">Kun: </span>
                                    {k.kun_yomi.join("、")}
                                  </p>
                                )}
                                {k.meaning && (
                                  <p className="text-sm text-gray-800 dark:text-gray-200 break-words">{k.meaning}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="py-6 text-center text-xs italic text-outline dark:text-gray-500">
                          Từ này không có Hán tự.
                        </p>
                      )}
                      {item.kanji.length > 0 && (
                        <p className="mt-2 border-t border-outline-variant/60 pt-3 text-right text-[11px] text-outline dark:border-gray-700 dark:text-gray-500">
                          Nét chữ:{" "}
                          <a
                            href="https://kanjivg.tagaini.net/"
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            KanjiVG
                          </a>{" "}
                          (CC BY-SA 3.0)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {searchPerformed && results.length === 0 && !loading && (
            <div className="flex min-h-[600px] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-outline-variant/60 text-center text-on-surface-variant dark:border-gray-700 dark:text-gray-400">
              {error ? "Lỗi khi tra cứu từ" : "Không tìm thấy từ vựng phù hợp."}
            </div>
          )}

          {!searchPerformed && (
            <div className="flex min-h-[600px] flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-outline-variant/60 dark:border-gray-700">
              <div className="relative h-14 w-14 text-outline-variant dark:text-gray-600">
                <span className="absolute left-0 top-0 text-4xl font-medium leading-none">文</span>
                <span className="absolute bottom-0 right-0 text-2xl font-semibold leading-none">A</span>
              </div>
              <p className="text-base text-outline dark:text-gray-500">
                Nhập từ tiếng Nhật để bắt đầu tra cứu...
              </p>
            </div>
          )}
        </div>

        {/* ===== RIGHT: Search history sidebar ===== */}
        <aside className="w-80 shrink-0">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 text-on-surface-variant dark:text-gray-400"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                  clipRule="evenodd"
                />
              </svg>
              <h2 className="text-sm font-semibold text-on-surface dark:text-gray-200">
                Lịch sử tra cứu
              </h2>
            </div>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-xs font-medium text-error hover:opacity-80 dark:hover:text-red-300 transition-colors"
                title="Xóa toàn bộ lịch sử"
              >
                Xóa tất cả
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[calc(100vh-12rem)] space-y-3 overflow-y-auto pr-1">
            {!currentUser && (
              <p className="rounded-2xl border border-outline-variant/60 px-4 py-6 text-center text-xs text-outline dark:border-gray-700 dark:text-gray-500">
                Đăng nhập để lưu lịch sử tra cứu.
              </p>
            )}

            {currentUser && loadingHistory && (
              <p className="rounded-2xl border border-outline-variant/60 px-4 py-6 text-center text-xs italic text-outline dark:border-gray-700">
                Đang tải...
              </p>
            )}

            {currentUser && !loadingHistory && history.length === 0 && (
              <p className="rounded-2xl border border-outline-variant/60 px-4 py-6 text-center text-xs text-outline dark:border-gray-700 dark:text-gray-500">
                Chưa có từ nào được tra cứu.
              </p>
            )}

            {currentUser &&
              !loadingHistory &&
              history.length > 0 &&
              history.map((item) => (
                <div
                  key={item.id}
                  className="group relative cursor-pointer rounded-2xl border border-outline-variant/60 bg-surface-container-lowest px-5 py-4 shadow-theme-xs transition hover:border-outline-variant hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-900"
                  onClick={() => handleHistoryClick(item)}
                >
                  <button
                    onClick={(e) => handleDeleteHistoryItem(e, item)}
                    className="absolute right-3 top-3 shrink-0 text-outline-variant opacity-0 transition-all hover:text-error group-hover:opacity-100 dark:text-gray-600 dark:hover:text-red-400"
                    title="Xóa mục này"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>

                  <p lang="ja" className="pr-5 text-lg font-bold text-on-surface dark:text-white truncate">
                    {item.word}
                  </p>
                  {item.reading && item.reading !== item.word && (
                    <p className="mt-0.5 text-sm text-outline dark:text-gray-500 truncate">
                      {item.reading}
                    </p>
                  )}
                  {item.meaning && (
                    <p className="mt-1.5 text-xs text-on-surface-variant dark:text-gray-400 truncate">
                      {item.meaning}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </aside>
      </div>
    </>
  );
}