import { useState } from "react";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import JapaneseVideoTranscript, {
  type InitialSession,
} from "../../components/japanese/JapaneseVideoTranscript";
import VideoHistoryTab from "../../components/japanese/components/VideoHistoryTab";

type Tab = "watch" | "history";

function tabButtonClass(isActive: boolean) {
  return `rounded-2xl px-6 py-4 text-center font-medium transition-all ${
    isActive
      ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-theme-md"
      : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
  }`;
}

export default function JapaneseWatch() {
  const [activeTab, setActiveTab] = useState<Tab>("watch");
  const [session, setSession] = useState<InitialSession | undefined>(undefined);
  const [sessionKey, setSessionKey] = useState(0);

  const handleOpenHistory = (loaded: InitialSession) => {
    setSession(loaded);
    setSessionKey((k) => k + 1);
    setActiveTab("watch");
  };

  return (
    <>
      <PageMeta
        title="Japanese Watch"
        description="Xem video tiếng Nhật với transcript tự động và dịch tiếng Việt"
      />
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button onClick={() => setActiveTab("watch")} className={tabButtonClass(activeTab === "watch")}>
            <div className="font-semibold">Xem video</div>
            <div className={`text-sm ${activeTab === "watch" ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
              Tìm và học qua video tiếng Nhật
            </div>
          </button>
          <button onClick={() => setActiveTab("history")} className={tabButtonClass(activeTab === "history")}>
            <div className="font-semibold">Lịch sử</div>
            <div className={`text-sm ${activeTab === "history" ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
              Video đã xem, xem lại script đã tạo
            </div>
          </button>
        </div>

        {activeTab === "history" ? (
          <VideoHistoryTab active={activeTab === "history"} onOpen={handleOpenHistory} />
        ) : (
          <ComponentCard title="日本語 Watch — Xem & Học Tiếng Nhật">
            <JapaneseVideoTranscript key={sessionKey} initialSession={session} />
          </ComponentCard>
        )}
      </div>
    </>
  );
}