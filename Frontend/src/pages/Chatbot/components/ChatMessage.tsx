import type { ChatMessage as ChatMsg } from "../../../services/chatApi";
import FeedbackCard from "./FeedbackCard";
import { CheckIcon } from "./icons";

interface Props {
  message: ChatMsg;
}

function GrammarNoteCard({ grammar }: { grammar: NonNullable<ChatMsg["grammar"]> }) {
  // has_errors is only true when the LLM could actually explain a real
  // problem — the GEC model occasionally rewrites a sentence cosmetically
  // (punctuation, spacing) without a genuine grammar error, and there'd be
  // nothing meaningful to show for that case.
  if (!grammar.has_errors || grammar.explanation.length === 0) return null;

  return (
    <div className="max-w-[80%] space-y-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-right dark:border-rose-500/30 dark:bg-rose-500/10">
      <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Câu đúng ngữ pháp</p>
      <p lang="ja" className="text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-300">
        {grammar.corrected_text}
      </p>
      <div className="space-y-1.5 border-t border-rose-200 pt-2 dark:border-rose-500/20">
        {grammar.explanation.map((err, i) => (
          <div key={i}>
            <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">{err.error_type}</p>
            <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">{err.why_wrong}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";
  const time = new Date(message.timestamp).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
          AI
        </div>
      )}
      <div className={`flex max-w-[70%] flex-col gap-1 ${isUser ? "items-end" : ""}`}>
        <div
          lang="ja"
          className={`rounded-xl px-4 py-3 text-sm leading-relaxed break-words ${
            isUser
              ? "rounded-br-sm bg-gradient-to-r from-brand-500 to-brand-600 text-white"
              : message.isOffTopic
              ? "rounded-bl-sm border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
              : "rounded-bl-sm border border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          }`}
        >
          <p className="m-0">{message.content}</p>
        </div>
        <span className="px-1 text-[10px] text-gray-400 dark:text-gray-500">{time}</span>
        {!isUser && message.feedback && <FeedbackCard text={message.feedback} />}
        {isUser && message.grammar && <GrammarNoteCard grammar={message.grammar} />}
        {isUser && message.grammar && !message.grammar.has_errors && (
          <span className="flex items-center gap-1 px-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            <CheckIcon className="h-3 w-3" />
            Không có lỗi ngữ pháp
          </span>
        )}
      </div>
    </div>
  );
}
