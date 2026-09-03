export default function ProgressBar({ learned, reviewing, total }: { learned: number; reviewing: number; total: number }) {
  const learnedPct = total > 0 ? (learned / total) * 100 : 0;
  const reviewingPct = total > 0 ? (reviewing / total) * 100 : 0;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
      <div className="h-full bg-emerald-500" style={{ width: `${learnedPct}%` }} />
      <div className="h-full bg-rose-400" style={{ width: `${reviewingPct}%` }} />
    </div>
  );
}
