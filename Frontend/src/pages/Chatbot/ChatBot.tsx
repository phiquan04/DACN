import { useEffect, useRef, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { getStoredUser } from "../../services/authApi";
import ScenarioSidebar from "./components/ScenarioSidebar";
import ConversationHistoryList from "./components/ConversationHistoryList";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import { AlertIcon, RefreshIcon } from "./components/icons";
import { useChatConversation } from "./hooks/useChatConversation";

type SidebarTab = "scenarios" | "history";

function sidebarTabClass(isActive: boolean) {
  return `flex-1 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
    isActive
      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
      : "border border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
  }`;
}

export default function ChatBot() {
  const chat = useChatConversation();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("scenarios");
  const currentUser = getStoredUser();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const statusLabel = chat.activeScenario ? chat.activeScenario.title : "Tự do";

  return (
    <div className="flex h-full flex-col">
      <PageMeta title="Chatbot AI" description="Luyện hội thoại tiếng Nhật với AI" />

      {chat.backendStatus === "error" && (
        <div className="mb-4 flex shrink-0 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-700 dark:bg-red-500/10 dark:text-red-400">
          <AlertIcon className="h-4 w-4 shrink-0" />
          {chat.statusMsg}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {/* Sidebar */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="shrink-0 px-4 pt-4">
            <h2 className="text-base font-bold text-gray-800 dark:text-white/90">Luyện hội thoại</h2>
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
                }}
                loading={chat.scenariosLoading}
              />
            ) : currentUser ? (
              <ConversationHistoryList
                active={sidebarTab === "history"}
                onResume={(detail) => {
                  chat.loadConversation(detail);
                  setSidebarTab("scenarios");
                }}
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
          <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
              AI
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-800 dark:text-white/90">Manabi Sensei</p>
              <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span
                  className={`h-2 w-2 rounded-full ${
                    chat.backendStatus === "ok" ? "animate-pulse bg-emerald-400" : "bg-red-400"
                  }`}
                />
                {chat.isThinking ? "Đang suy nghĩ..." : chat.isSpeaking ? "Đang nói..." : `Đang nghe... (${statusLabel})`}
              </p>
            </div>
            <button
              onClick={chat.handleClearChat}
              title="Bắt đầu lại"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              Bắt đầu lại
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
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
            <div className="flex shrink-0 flex-wrap gap-2 px-6 pb-3">
              {chat.suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  lang="ja"
                  onClick={() => chat.handleSend(s)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs text-gray-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10 dark:hover:text-teal-400"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <ChatInput
            onSend={chat.handleSend}
            onVoiceStart={chat.startListening}
            onVoiceStop={chat.stopListening}
            isListening={chat.isListening}
            isLoading={chat.isLoading}
            transcript={chat.transcript}
            voiceSupported={chat.voiceSupported}
          />
        </main>
      </div>
    </div>
  );
}
