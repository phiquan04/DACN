import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";
import { AdminOverview, fetchAdminOverview } from "../../services/adminDashboardApi";
import { BoltIcon, ChatIcon, DocsIcon, FileIcon, GroupIcon } from "../../icons";
import StatCard from "../../components/admin-vocabulary/StatCard";
import NewUsersTrendCard from "../../components/admin-dashboard/NewUsersTrendCard";
import ActionItemsCard from "../../components/admin-dashboard/ActionItemsCard";
import LevelDistributionCard from "../../components/admin-dashboard/LevelDistributionCard";
import ResourceProgressCard from "../../components/admin-dashboard/ResourceProgressCard";

export default function AdminHome() {
  const { setPageHeader } = usePageHeader();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageHeader("Tổng quan hệ thống", "Đây là những gì đang diễn ra với Manabi AI hôm nay.");
  }, [setPageHeader]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchAdminOverview();
        if (!cancelled) setOverview(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageMeta title="Tổng quan | Manabi AI" description="Tổng quan hệ thống quản trị Manabi AI." />

      {loading || !overview ? (
        <p className="text-sm text-admin-body">Đang tải...</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Tổng người dùng" value={overview.total_users} icon={<GroupIcon />} tone="neutral" hint={`+${overview.new_users_7d} trong 7 ngày qua`} />
            <StatCard label="Hoạt động 7 ngày" value={overview.active_users_7d} icon={<BoltIcon />} tone="success" hint="người dùng hoạt động" />
            <StatCard label="Từ vựng chờ duyệt" value={overview.pending_vocabulary_sets} icon={<DocsIcon />} tone="pending" hint="cần admin duyệt" />
            <StatCard label="Đề JLPT chờ duyệt" value={overview.pending_jlpt_exams} icon={<FileIcon />} tone="pending" hint="cần admin duyệt" />
            <StatCard label="Lượt chat hôm nay" value={overview.chats_today} icon={<ChatIcon />} tone="info" hint="tin nhắn người dùng gửi" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <NewUsersTrendCard points={overview.activity_last_7_days} />
            </div>
            <ActionItemsCard items={overview.action_items} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <LevelDistributionCard items={overview.level_distribution} />
            <ResourceProgressCard resources={overview.resources} />
          </div>
        </div>
      )}
    </>
  );
}
