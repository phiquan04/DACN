import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import JLPTPractice from "../../components/jlpt/JLPTPractice";

export default function JLPTPracticePage() {
  return (
    <>
      <PageMeta
        title="Luyện Đề JLPT | TailAdmin - React.js Admin Dashboard Template"
        description="Luyện thi JLPT N1~N5 với đầy đủ 4 phần: Từ vựng, Ngữ pháp, Đọc hiểu, Nghe hiểu"
      />
      <PageBreadcrumb pageTitle="Luyện Đề JLPT" />
      <div className="space-y-6">
        <ComponentCard title="日本語能力試験 — Luyện Đề JLPT N1～N5">
          <JLPTPractice />
        </ComponentCard>
      </div>
    </>
  );
}