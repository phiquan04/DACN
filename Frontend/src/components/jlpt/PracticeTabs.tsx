export type PracticeTab = "exams" | "history";

const TABS: { key: PracticeTab; title: string }[] = [
  { key: "exams", title: "Đề thi" },
  { key: "history", title: "Lịch sử làm bài" },
];

export default function PracticeTabs({
  active,
  onChange,
  examCount,
  historyCount,
}: {
  active: PracticeTab;
  onChange: (tab: PracticeTab) => void;
  examCount: number;
  historyCount: number;
}) {
  const counts: Record<PracticeTab, number> = { exams: examCount, history: historyCount };

  return (
    <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
      {TABS.map(({ key, title }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {title} ({counts[key]})
          </button>
        );
      })}
    </div>
  );
}
