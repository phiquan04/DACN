import { ReactNode } from "react";

export default function FlipCard({
  flipped,
  front,
  back,
  onClick,
}: {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="h-96 w-full cursor-pointer [perspective:1200px]" onClick={onClick}>
      <div
        className={`relative h-full w-full rounded-xl border border-gray-200 bg-white shadow-sm transition-transform duration-500 [transform-style:preserve-3d] dark:border-gray-700 dark:bg-gray-900 ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center [backface-visibility:hidden]">
          {front}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {back}
        </div>
      </div>
    </div>
  );
}
