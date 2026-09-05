import { useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import { fetchUserConversationTranscript } from "../../services/adminUserApi";
import type { ConversationDetail, MessageDetail } from "../../services/chatApi";
import { formatApiDateTime } from "../../utils/datetime";
import { CheckIcon } from "../../icons/custom";

interface Props {
  userId: number;
  conversationId: number;
  onClose: () => void;
}

function GrammarNoteBox({ grammar }: { grammar: NonNullable<MessageDetail["grammar"]> }) {
  if (!grammar.has_errors || grammar.explanation.length === 0) return null;
  return (
    <div className="mt-1.5 max-w-[85%] space-y-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 dark:border-rose-500/30 dark:bg-rose-500/10">
      <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Câu đúng ngữ pháp</p>
      <p lang="ja" className="text-[12.5px] leading-relaxed text-teal-700 dark:text-teal-400">
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

function TranscriptMessage({ message }: { message: MessageDetail }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div
        lang="ja"
        className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed break-words ${
          isUser
            ? "rounded-br-sm bg-brand-500 text-white"
            : message.is_off_topic
              ? "rounded-bl-sm border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
              : "rounded-bl-sm border border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        {message.content}
      </div>
      <span className="px-1 text-[11px] text-gray-400 dark:text-gray-500">{formatApiDateTime(message.created_at)}</span>
      {!isUser && message.feedback && (
        <div className="max-w-[85%] rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300">
          {message.feedback}
        </div>
      )}
      {isUser && message.grammar && <GrammarNoteBox grammar={message.grammar} />}
      {isUser && message.grammar && !message.grammar.has_errors && (
        <span className="flex items-center gap-1 px-1 text-[11px] text-emerald-600 dark:text-emerald-400">
          <CheckIcon className="h-3 w-3" /> Không có lỗi ngữ pháp
        </span>
      )}
    </div>
  );
}

export default function ConversationTranscriptModal({ userId, conversationId, onClose }: Props) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUserConversationTranscript(userId, conversationId)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, conversationId]);

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-h-[85vh] max-w-2xl overflow-y-auto p-6">
      {loading || !detail ? (
        <div className="flex h-40 items-center justify-center text-sm text-gray-500 dark:text-gray-400">Đang tải transcript...</div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90" lang="ja">
            {detail.title || "Hội thoại tự do"}
          </h2>
          {detail.scenario_title && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tình huống: {detail.scenario_title}</p>
          )}

          <div className="mt-4 flex flex-col gap-4">
            {detail.messages.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Cuộc hội thoại chưa có tin nhắn nào.</p>
            ) : (
              detail.messages.map((m) => <TranscriptMessage key={m.id} message={m} />)
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
