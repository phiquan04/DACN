import { ShootingStarIcon } from "../../icons";

export default function BookmarkToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={active ? "Bỏ đánh dấu từ này" : "Đánh dấu từ này"}
      className={`absolute right-3 top-3 z-10 ${
        active ? "text-amber-500" : "text-gray-300 hover:text-gray-400 dark:text-gray-600"
      }`}
    >
      <ShootingStarIcon className="h-5 w-5" />
    </button>
  );
}
