import { ReactNode } from "react";

interface Props {
  label: string;
  value: number;
  icon: ReactNode;
}

export default function StatCard({ label, value, icon }: Props) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-0.5 text-3xl font-bold text-gray-800 dark:text-white/90">{value}</p>
      </div>
    </div>
  );
}
