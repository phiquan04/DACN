interface SynonymsCardProps {
  synonyms: string[];
  loading: boolean;
}

export default function SynonymsCard({ synonyms, loading }: SynonymsCardProps) {
  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
      <h4 className="mb-4 text-base font-semibold text-on-surface dark:text-gray-100">Từ đồng nghĩa</h4>

      {loading && (
        <div className="flex gap-2 animate-pulse">
          <div className="h-7 bg-surface-container-high dark:bg-gray-700 rounded-full w-16" />
          <div className="h-7 bg-surface-container-high dark:bg-gray-700 rounded-full w-20" />
          <div className="h-7 bg-surface-container-high dark:bg-gray-700 rounded-full w-14" />
        </div>
      )}

      {!loading && synonyms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {synonyms.slice(0, 8).map((syn, synIdx) => (
            <span
              key={synIdx}
              className="inline-block rounded-full bg-secondary-container px-3.5 py-1.5 text-sm font-medium text-on-secondary-container break-words"
            >
              {syn}
            </span>
          ))}
        </div>
      )}

      {!loading && synonyms.length === 0 && (
        <p className="text-xs text-outline italic">Không tìm được từ đồng nghĩa.</p>
      )}
    </div>
  );
}
