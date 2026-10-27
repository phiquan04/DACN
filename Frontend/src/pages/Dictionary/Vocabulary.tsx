import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import type { DictionaryResult, SearchHistoryItem } from "../../services/api";
import { createMyItem, MyItemCreateInput } from "../../services/vocabularyLearningApi";
import AddToMineModal from "../../components/vocabulary-learning/AddToMineModal";
import { useVocabularyPage } from "./hooks/useVocabularyPage";
import SearchBar from "./components/SearchBar";
import WordSummaryCard from "./components/WordSummaryCard";
import ExamplesCard from "./components/ExamplesCard";
import SynonymsCard from "./components/SynonymsCard";
import ImagesCard from "./components/ImagesCard";
import CommentsCard from "./components/CommentsCard";
import KanjiTab from "./components/KanjiTab";
import HistorySidebar from "./components/HistorySidebar";
import KanjiDrawModal from "./components/KanjiDrawModal";

export default function Vocabulary() {
  const { currentUser, history, images, comments, lookup } = useVocabularyPage();
  const [isDrawOpen, setIsDrawOpen] = useState(false);
  const [addToMineTarget, setAddToMineTarget] = useState<DictionaryResult | null>(null);

  /** Dictionary lookups come from JMdict, not the VocabularyItem table, so
   * there's no existing item id to copy — build a new personal word from
   * whatever the lookup already resolved (current example, if loaded, and a
   * best-effort Hán Việt guessed from the per-kanji breakdown). */
  const buildMyItemPayload = (item: DictionaryResult): MyItemCreateInput => {
    const hanViet = item.kanji.length > 0
      ? item.kanji.map((k) => k.hanviet[0]).filter(Boolean).join(", ").toUpperCase()
      : undefined;
    const example = lookup.examplesData[0];
    return {
      word: item.word,
      meaning_vi: item.definitions[0]?.meaning ?? "",
      reading: item.reading || undefined,
      han_viet: hanViet || undefined,
      word_type: item.definitions[0]?.pos_label || undefined,
      example_sentence_ja: example?.japanese,
      example_sentence_vi: example?.vietnamese,
      auto_fill: true,
    };
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại cùng 1 file lần sau
    if (!file || !lookup.currentWord) return;
    images.upload(lookup.currentWord, file);
  };

  const handleDeleteHistoryItem = (e: React.MouseEvent, item: SearchHistoryItem) => {
    e.stopPropagation();
    history.removeItem(item);
  };

  const handleClearHistory = () => {
    if (!window.confirm("Xóa toàn bộ lịch sử tra cứu?")) return;
    history.clearAll();
  };

  return (
    <>
      <PageMeta
        title="Tra cứu từ vựng tiếng Nhật"
        description="Trang tra cứu từ điển Nhật - Việt"
      />

      {/* Two-column layout on lg+: one shared card surface so content sits above the page background, split by a vertical divider.
          Below lg the history stacks under the lookup (a 320px side column would leave the lookup almost no width on a phone). */}
      <div className="flex flex-col divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white shadow-sm dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-900 lg:flex-row lg:items-stretch lg:divide-x lg:divide-y-0">
        {/* ===== LEFT: Dictionary lookup ===== */}
        <div className="min-w-0 flex-1 space-y-6 p-4 sm:p-6">
          <SearchBar
            searchTerm={lookup.searchTerm}
            onSearchTermChange={lookup.setSearchTerm}
            loading={lookup.loading}
            onSubmit={lookup.handleSearch}
            onOpenDraw={() => setIsDrawOpen(true)}
          />

          {/* Tabs: Từ vựng / Hán tự */}
          {lookup.results.length > 0 && (
            <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => lookup.setActiveTab("vocab")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  lookup.activeTab === "vocab"
                    ? "bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Từ vựng
              </button>
              <button
                type="button"
                onClick={() => lookup.setActiveTab("kanji")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  lookup.activeTab === "kanji"
                    ? "bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Hán tự
              </button>
            </div>
          )}

          {/* Error */}
          {lookup.error && (
            <div className="rounded-xl border border-error/30 bg-error-container p-4 text-on-error-container dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              {lookup.error}
            </div>
          )}

          {/* Results */}
          {lookup.results.length > 0 && (
            <div className="grid grid-cols-1 gap-5">
              {lookup.results.map((item, idx) => (
                <div key={idx} className="w-full max-w-full space-y-5">
                  <WordSummaryCard
                    item={item}
                    onPlayPronunciation={lookup.playPronunciation}
                    onPracticePronunciation={lookup.goToPronunciationPractice}
                    onAddToMine={() => setAddToMineTarget(item)}
                    showKanjiPreview={lookup.activeTab === "vocab"}
                  />

                  {/* ===== Tab: Từ vựng — supporting cards ===== */}
                  {lookup.activeTab === "vocab" && (
                    <>
                      <ExamplesCard word={item.word} examples={lookup.examplesData} loading={lookup.loadingExamples} />
                      <SynonymsCard
                        synonyms={lookup.synonymsData}
                        loading={lookup.loadingSynonyms}
                        onLookupWord={lookup.searchWord}
                      />
                      <ImagesCard
                        word={item.word}
                        images={images.images}
                        loading={images.loadingImages}
                        uploading={images.uploadingImage}
                        currentUser={currentUser}
                        onUpload={handleUploadImage}
                        onDelete={images.remove}
                        onVote={images.vote}
                      />
                      <CommentsCard
                        comments={comments.comments}
                        loading={comments.loadingComments}
                        currentUser={currentUser}
                        newComment={comments.newComment}
                        onNewCommentChange={comments.setNewComment}
                        postingComment={comments.postingComment}
                        commentsPage={comments.commentsPage}
                        onPageChange={comments.setCommentsPage}
                        onPost={() => comments.post(item.word)}
                        onDelete={comments.remove}
                        onVote={comments.vote}
                      />
                    </>
                  )}

                  {/* ===== Tab: Hán tự ===== */}
                  {lookup.activeTab === "kanji" && (
                    <KanjiTab kanji={item.kanji} />
                  )}
                </div>
              ))}
            </div>
          )}

          {lookup.searchPerformed && lookup.results.length === 0 && !lookup.loading && (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl px-4 sm:min-h-[600px] border border-gray-200 bg-gradient-to-b from-brand-50 to-white text-center text-on-surface-variant dark:border-gray-700 dark:from-gray-900 dark:to-gray-900 dark:text-gray-400">
              {lookup.error ? "Lỗi khi tra cứu từ" : "Không tìm thấy từ vựng phù hợp."}
            </div>
          )}

          {!lookup.searchPerformed && (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-5 rounded-2xl px-4 sm:min-h-[600px] border border-gray-200 bg-gradient-to-b from-brand-50 to-white dark:border-gray-700 dark:from-gray-900 dark:to-gray-900">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-semibold text-brand-500 dark:bg-brand-500/20 dark:text-brand-300">
                文
              </div>
              <p className="text-base text-outline dark:text-gray-500">
                Nhập từ tiếng Nhật để bắt đầu tra cứu...
              </p>
            </div>
          )}
        </div>

        {/* ===== RIGHT: Search history sidebar ===== */}
        <HistorySidebar
          currentUser={currentUser}
          history={history.history}
          loadingHistory={history.loadingHistory}
          onItemClick={lookup.loadFromHistory}
          onDeleteItem={handleDeleteHistoryItem}
          onClearAll={handleClearHistory}
        />
      </div>

      <KanjiDrawModal
        isOpen={isDrawOpen}
        onClose={() => setIsDrawOpen(false)}
        onSelectCharacter={(char) => lookup.setSearchTerm((prev) => prev + char)}
      />

      {addToMineTarget && (
        <AddToMineModal
          onPick={(setId) => createMyItem(setId, buildMyItemPayload(addToMineTarget))}
          onClose={() => setAddToMineTarget(null)}
        />
      )}
    </>
  );
}
