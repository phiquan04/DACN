import { useEffect } from "react";
import JLPTOverviewDashboard from "../../../components/admin-jlpt/JLPTOverviewDashboard";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";

export default function OverviewPage() {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader("Ngân hàng đề JLPT");
  }, [setPageHeader]);

  return (
    <>
      <PageMeta title="Ngân hàng đề JLPT | Manabi AI" description="Tổng quan cấu trúc, câu hỏi và đề thi JLPT." />
      <div className="space-y-5">
        <JLPTOverviewDashboard />
      </div>
    </>
  );
}
