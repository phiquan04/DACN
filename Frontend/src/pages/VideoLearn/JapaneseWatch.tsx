import { useEffect, useState } from "react";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import JapaneseVideoTranscript, {
  type InitialSession,
} from "../../components/japanese/JapaneseVideoTranscript";
import VideoHistoryTab from "../../components/japanese/components/VideoHistoryTab";
import { usePageHeader } from "../../context/PageHeaderContext";

type Tab = "watch" | "history";

function tabButtonClass(isActive: boolean) {
  return `rounded-xl border px-6 py-4 text-center font-medium transition-colors duration-150 ease-in-out ${
    isActive
      ? "border-brand-200 bg-brand-100 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/20 dark:text-brand-200"
      : "border-gray-200 bg-white text-gray-700 hover:bg-brand-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5"
  }`;
}

function tabSubtitleClass(isActive: boolean) {
  return `text-sm ${isActive ? "text-brand-600 dark:text-brand-300" : "text-gray-500 dark:text-gray-400"}`;
}

export default function JapaneseWatch() {
  const [activeTab, setActiveTab] = useState<Tab>("watch");
  const [session, setSession] = useState<InitialSession | undefined>(undefined);
  const [sessionKey, setSessionKey] = useState(0);
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader("Học qua YouTube", "Xem video tiếng Nhật với transcript tự động và dịch tiếng Việt");
  }, [setPageHeader]);

  const handleOpenHistory = (loaded: InitialSession) => {
    setSession(loaded);
    setSessionKey((k) => k + 1);
    setActiveTab("watch");
  };

  return (
    <>
      <PageMeta
        title="Học qua YouTube | Manabi AI"
        description="Xem video tiếng Nhật với transcript tự động và dịch tiếng Việt"
      />
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button onClick={() => setActiveTab("watch")} className={tabButtonClass(activeTab === "watch")}>
            <div className="font-semibold">Xem video</div>
            <div className={tabSubtitleClass(activeTab === "watch")}>
              Tìm và học qua video tiếng Nhật
            </div>
          </button>
          <button onClick={() => setActiveTab("history")} className={tabButtonClass(activeTab === "history")}>
            <div className="font-semibold">Lịch sử</div>
            <div className={tabSubtitleClass(activeTab === "history")}>
              Video đã xem, xem lại script đã tạo
            </div>
          </button>
        </div>

        {activeTab === "history" ? (
          <VideoHistoryTab active={activeTab === "history"} onOpen={handleOpenHistory} />
        ) : (
          <ComponentCard title="Xem và học tiếng Nhật">
            <JapaneseVideoTranscript key={sessionKey} initialSession={session} />
          </ComponentCard>
        )}
      </div>
    </>
  );
}