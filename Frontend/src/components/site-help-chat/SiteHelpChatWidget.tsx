import { useEffect, useRef } from "react";
import { useSiteHelpChat } from "../../context/SiteHelpChatContext";
import { CloseIcon, RefreshIcon, RobotIcon, SendIcon } from "./icons";

function TypingDots() {
  return (
    <span className="flex items-center gap-1 px-1 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600" />
    </span>
  );
}

function BotAvatar() {
  return (
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
      <RobotIcon className="h-4 w-4" />
    </div>
  );
}

export default function SiteHelpChatWidget() {
  const { isOpen, messages, draft, isStreaming, setDraft, toggle, close, sendMessage, resetConversation } =
    useSiteHelpChat();
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [isOpen, messages]);

  useEffect(() => {
    if (isOpen) textareaRef.current?.focus();
  }, [isOpen]);

  const handleSend = () => {
    if (!draft.trim() || isStreaming) return;
    sendMessage(draft);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // e.repeat guards against a held-down Enter key firing multiple keydown
    // events before React re-renders to clear the draft, which would submit
    // the same question twice.
    if (e.key === "Enter" && !e.shiftKey && !e.repeat) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[9999] flex h-[560px] max-h-[calc(100vh-8rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 dark:border-gray-700">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                <RobotIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">Trợ lý Manabi</p>
                <p className="truncate text-xs text-gray-400 dark:text-gray-500">Website & tiếng Nhật</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={resetConversation}
                aria-label="Bắt đầu hội thoại mới"
                title="Bắt đầu hội thoại mới"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors duration-150 ease-in-out hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                <RefreshIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Đóng"
                title="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors duration-150 ease-in-out hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            className="flex flex-1 flex-col gap-3 overflow-y-auto bg-gray-50 p-4 dark:bg-white/[0.02]"
          >
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-brand-500 px-3 py-2 text-[13px] leading-relaxed text-white"
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <BotAvatar />
                  <div className="max-w-[85%] rounded-lg rounded-bl-sm border border-teal-100 bg-teal-50 px-3 py-2 text-[13px] leading-relaxed text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
                    {m.content ? <p className="whitespace-pre-wrap">{m.content}</p> : <TypingDots />}
                  </div>
                </div>
              )
            )}
          </div>

          <div className="shrink-0 border-t border-gray-200 p-3 dark:border-gray-700">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi về website, từ vựng hoặc ngữ pháp..."
                rows={2}
                className="h-[44px] flex-1 resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-900 outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90 dark:focus:border-brand-400"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim() || isStreaming}
                title="Gửi"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition-colors duration-150 ease-in-out hover:bg-brand-600 disabled:bg-brand-200"
              >
                <SendIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-label={isOpen ? "Đóng trợ lý" : "Mở trợ lý"}
        className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-theme-lg transition-colors duration-150 ease-in-out hover:bg-brand-600"
      >
        {isOpen ? <CloseIcon className="h-6 w-6" /> : <RobotIcon className="h-6 w-6" />}
      </button>
    </>
  );
}
