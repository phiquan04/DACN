// Waveform giả lập (chỉ mang tính minh hoạ trực quan)
const WAVEFORM_PATTERN = [42, 68, 90, 58, 34, 72, 100, 62, 48, 84, 54, 38, 78, 96, 62, 44, 58, 88, 68, 34, 78, 100, 52, 44, 74, 62, 38, 58];
const EMPTY_PATTERN = new Array(WAVEFORM_PATTERN.length).fill(10);

export default function Waveform({
  active,
  deviation,
}: {
  active: boolean;
  deviation?: boolean;
}) {
  const pattern = active ? WAVEFORM_PATTERN : EMPTY_PATTERN;
  return (
    <div className="flex flex-1 items-end gap-[3px] h-12">
      {pattern.map((h, i) => {
        const frac = i / (pattern.length - 1);
        const inZone = frac > 0.3 && frac < 0.65;
        let colorClass = "bg-surface-container-high dark:bg-gray-600";
        if (active) {
          colorClass = deviation && inZone ? "bg-error dark:bg-red-500" : "bg-secondary dark:bg-secondary-fixed-dim";
        }
        return <span key={i} className={`w-1 rounded-full transition-colors ${colorClass}`} style={{ height: `${h}%` }} />;
      })}
    </div>
  );
}
