import { ChatBubbleIcon } from "./icons";

interface Props {
  text: string;
}

export default function FeedbackCard({ text }: Props) {
  return (
    <div className="max-w-[70%] rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3 dark:border-teal-500/30 dark:bg-teal-500/10">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
        <ChatBubbleIcon className="h-3.5 w-3.5" />
        Nhận xét từ Manabi
      </div>
      <div className="text-[12.5px] leading-relaxed text-gray-700 dark:text-gray-300">{text}</div>
    </div>
  );
}
