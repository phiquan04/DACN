import { useEffect, useRef, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { getStoredUser } from "../../services/authApi";
import ScenarioSidebar from "./components/ScenarioSidebar";
import ConversationHistoryList from "./components/ConversationHistoryList";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import SituationModal from "./components/SituationModal";
import { AlertIcon } from "./components/icons";
import { RefreshIcon } from "../../icons/custom";
import { CloseLineIcon, ListIcon } from "../../icons";
import { useChatConversation } from "./hooks/useChatConversation";
import { useConversationHistory } from "./hooks/useConversationHistory";
import { useSetUrlParams, useUrlEnum } from "../../hooks/useUrlState";

type SidebarTab = "scenarios" | "history";

function sidebarTabClass(isActive: boolean) {
  return `flex-1 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
    isActive
      ? "bg-brand-500 text-white"
      : "border border-gray-300 text-gray-600 hover:border-teal-400 dark:border-gray-600 dark:text-gray-300"
  }`;
}

export default function ChatBot() {
  const chat = useChatConversation();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sidebarTab, setSidebarTab] = useUrlEnum<SidebarTab>("panel", ["scenarios", "history"], "scenarios");
  const setUrlParams = useSetUrlParams();
  // Below lg the scenario/history list is a slide-over drawer (a fixed 320px
  // column would leave the chat itself almost no width on a phone).
  const [panelOpen, setPanelOpen] = useState(false);
  const currentUser = getStoredUser();
  const history = useConversationHistory(sidebarTab === "history" && !!currentUser);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const statusLabel = chat.activeScenario ? chat.activeScenario.title : "Tự do";

  const handleSendMessage = async (text: string) => {
    const conversationId = chat.conversationId;
    await chat.handleSend(text);
    if (conversationId) history.touch(conversationId);
  };

  const handleResumeHistory = async (id: number) => {
    const detail = await history.resume(id);
    if (detail) {
      chat.loadConversation(detail);
      setPanelOpen(false);
      // push: mở một cuộc cũ là chuyển màn -> Back quay lại cuộc đang nói trước đó.
      setUrlParams({ c: detail.id }, "push");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageMeta title="Chatbot AI" description="Luyện hội thoại tiếng Nhật với AI" />

      {chat.backendStatus === "error" && (
        <div className="mb-4 flex shrink-0 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-700 dark:bg-red-500/10 dark:text-red-400">
          <AlertIcon className="h-4 w-4 shrink-0" />
          {chat.statusMsg}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {/* Backdrop for the drawer (below lg only) */}
        {panelOpen && (
          <button
            type="button"
            aria-label="Đóng danh sách"
            onClick={() => setPanelOpen(false)}
            className="absolute inset-0 z-10 bg-gray-900/30 lg:hidden"
          />
        )}

        {/* Sidebar: static column on lg+, slide-over drawer below */}
        <aside
          className={`absolute inset-y-0 left-0 z-20 flex w-[85%] max-w-80 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 lg:static lg:w-80 lg:max-w-none lg:translate-x-0 ${
            panelOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="shrink-0 px-4 pt-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-bold text-gray-800 dark:text-white/90">Luyện hội thoại</h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Đóng danh sách"
                className="-mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 lg:hidden"
              >
                <CloseLineIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Chọn bối cảnh hoặc xem lại hội thoại cũ</p>
            <div className="mt-3 flex gap-2">
              <button className={sidebarTabClass(sidebarTab === "scenarios")} onClick={() => setSidebarTab("scenarios")}>
                Tình huống
              </button>
              <button className={sidebarTabClass(sidebarTab === "history")} onClick={() => setSidebarTab("history")}>
                Lịch sử
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {sidebarTab === "scenarios" ? (
              <ScenarioSidebar
                scenarios={chat.scenarios}
                activeScenarioId={chat.activeScenario?.id ?? null}
                onSelect={(scenario) => {
                  chat.handleSelectScenario(scenario);
                  setSidebarTab("scenarios");
                  setPanelOpen(false);
                }}
                loading={chat.scenariosLoading}
              />
            ) : currentUser ? (
              <ConversationHistoryList
                items={history.items}
                page={history.page}
                totalPages={history.totalPages}
                loading={history.loading}
                error={history.error}
                load={history.load}
                resumingId={history.resumingId}
                activeConversationId={chat.conversationId}
                onResume={handleResumeHistory}
              />
            ) : (
              <div className="p-6 text-center text-xs text-gray-400 dark:text-gray-500">
                Vui lòng đăng nhập để xem lịch sử hội thoại.
              </div>
            )}
          </div>
        </aside>

        {/* Chat panel */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:gap-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              aria-label="Tình huống và lịch sử"
              title="Tình huống và lịch sử"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5 lg:hidden"
            >
              <ListIcon className="h-5 w-5" />
            </button>
            <div className="hidden h-10 w-10 sm:flex shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
              AI
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-800 dark:text-white/90">Manabi Sensei</p>
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span
                  className={`h-2 w-2 rounded-full ${
                    chat.backendStatus === "ok" ? "animate-pulse bg-emerald-400" : "bg-red-400"
                  }`}
                />
                <span className="truncate">
                  {chat.isThinking ? "Đang suy nghĩ..." : chat.isSpeaking ? "Đang nói..." : `Đang nghe... (${statusLabel})`}
                </span>
              </p>
            </div>
            {chat.activeScenario && (
              <button
                onClick={chat.handleOpenSituationEditor}
                title="Thiết lập bối cảnh"
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  chat.situationContext
                    ? "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-400 dark:hover:bg-teal-500/20"
                    : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                <span lang="ja">場面</span>
              </button>
            )}
            <button
              onClick={chat.handleClearChat}
              title="Bắt đầu lại"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bắt đầu lại</span>
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {chat.messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}

            {chat.isThinking && (
              <div className="flex gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
                  AI
                </div>
                <div className="flex w-fit items-center gap-1.5 rounded-xl rounded-bl-sm border border-gray-200 bg-gray-100 px-4 py-3.5 dark:border-gray-700 dark:bg-gray-800">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {chat.suggestions.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-2 px-4 pb-3 sm:px-6">
              {chat.suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  lang="ja"
                  onClick={() => handleSendMessage(s)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs text-gray-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10 dark:hover:text-teal-400"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <ChatInput
            onSend={handleSendMessage}
            onVoiceStart={chat.startListening}
            onVoiceStop={chat.stopListening}
            isListening={chat.isListening}
            isLoading={chat.isLoading}
            transcript={chat.transcript}
            voiceSupported={chat.voiceSupported}
          />
        </main>
      </div>

      <SituationModal
        isOpen={chat.situationModalOpen}
        mode={chat.situationModalMode}
        scenario={chat.situationModalMode === "select" ? chat.pendingScenario : chat.activeScenario}
        initialValue={chat.situationModalMode === "edit" ? chat.situationContext ?? "" : ""}
        saving={chat.savingSituation}
        onClose={chat.handleCloseSituationModal}
        onConfirm={chat.handleConfirmSituation}
        onSkip={chat.handleSkipSituation}
      />
    </div>
  );
}
