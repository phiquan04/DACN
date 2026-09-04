import { useRef, useState } from "react";
import { MicIcon, StopIcon } from "./icons";
import { SendIcon } from "../../../icons/custom";
import Spinner from "../../../components/ui/spinner/Spinner";

interface Props {
  onSend: (text: string) => void;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  isListening: boolean;
  isLoading: boolean;
  transcript: string;
  voiceSupported: boolean;
}

export default function ChatInput({
  onSend,
  onVoiceStart,
  onVoiceStop,
  isListening,
  isLoading,
  transcript,
  voiceSupported,
}: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const msg = text.trim();
    if (!msg || isLoading) return;
    onSend(msg);
    setText("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayValue = isListening ? transcript : text;

  return (
    <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
      <div className="flex items-center gap-2.5">
        <textarea
          ref={inputRef}
          lang="ja"
          value={displayValue}
          onChange={(e) => !isListening && setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Đang nghe..." : "Nhập câu trả lời bằng tiếng Nhật hoặc tiếng Việt..."}
          rows={1}
          disabled={isLoading || isListening}
          className="h-[42px] flex-1 resize-none rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm leading-relaxed text-gray-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90 dark:focus:border-brand-400"
        />
        <div className="flex shrink-0 items-center gap-2">
          {voiceSupported && (
            <button
              type="button"
              onClick={isListening ? onVoiceStop : onVoiceStart}
              title={isListening ? "Dừng" : "Nhập bằng giọng nói"}
              disabled={isLoading}
              className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border transition-colors ${
                isListening
                  ? "animate-pulse border-rose-300 bg-rose-100 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-400"
                  : "border-gray-200 bg-gray-100 text-gray-500 hover:border-gray-300 hover:bg-gray-200 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {isListening ? <StopIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || (!text.trim() && !transcript)}
            title="Gửi"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 text-white transition-colors hover:from-brand-600 hover:to-brand-700 disabled:opacity-40"
          >
            {isLoading ? (
              <Spinner size="xs" className="border-white/40 border-t-white" />
            ) : (
              <SendIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-gray-400 dark:text-gray-500">
        Nhấn Micro để nói, hoặc nhấn Enter để gửi tin nhắn.
      </p>
    </div>
  );
}
