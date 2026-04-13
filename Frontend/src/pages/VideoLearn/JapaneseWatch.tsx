import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import JapaneseVideoTranscript from "../../components/japanese/JapaneseVideoTranscript";

export default function JapaneseWatch() {
  return (
    <>
      <PageMeta
        title="Japanese Watch"
        description="Xem video tiếng Nhật với transcript tự động và dịch tiếng Việt"
      />
      <PageBreadcrumb pageTitle="Japanese Watch" />
      <div className="space-y-6">
        <ComponentCard title="日本語 Watch — Xem & Học Tiếng Nhật">
          <JapaneseVideoTranscript />
        </ComponentCard>
      </div>
    </>
  );
}