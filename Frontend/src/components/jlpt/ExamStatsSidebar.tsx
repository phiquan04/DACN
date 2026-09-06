import { AlertHexaIcon, CheckCircleIcon, CloseIcon, DocsIcon, ListIcon, TimeIcon } from "../../icons";

export default function ExamStatsSidebar({
  total,
  done,
  notDone,
  passed,
  failed,
  inProgress,
}: {
  total: number;
  done: number;
  notDone: number;
  passed: number;
  failed: number;
  inProgress: number;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <DocsIcon className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold">Tổng số đề thi</h3>
        </div>
        <p className="text-4xl font-bold">{total}</p>
        <p className="mt-1 text-sm text-white/80">đề thi phù hợp với bộ lọc hiện tại</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <ListIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Đã làm</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">{done} đề</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircleIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Đã đạt</span>
          </div>
          <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">{passed} đề</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <CloseIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Chưa đạt</span>
          </div>
          <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-300">{failed} đề</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <TimeIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Chưa làm</span>
          </div>
          <p className="mt-1 text-xl font-bold text-gray-700 dark:text-gray-200">{notDone} đề</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <AlertHexaIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Đang làm dở</span>
          </div>
          <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">{inProgress} đề</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Chú thích trạng thái</h3>
        <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
            Đã đạt
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400" />
            Chưa đạt
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
            Chưa làm
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
            Đang làm dở
          </div>
        </div>
      </div>
    </div>
  );
}
