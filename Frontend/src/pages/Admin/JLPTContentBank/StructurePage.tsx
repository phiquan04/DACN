import { useEffect } from "react";
import JLPTTabs from "../../../components/admin-jlpt/JLPTTabs";
import StructureEditor from "../../../components/admin-jlpt/StructureEditor";
import PageMeta from "../../../components/common/PageMeta";
import { usePageHeader } from "../../../context/PageHeaderContext";

export default function StructurePage() {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      "Cấu trúc Mondai theo cấp độ",
    );
  }, [setPageHeader]);

  return (
    <>
      <PageMeta title="Cấu trúc đề thi | Manabi AI" description="Thiết lập cấu trúc mondai theo cấp độ JLPT." />
      <div className="space-y-5">
        <JLPTTabs current="Cấu trúc đề" />
        <StructureEditor />
      </div>
    </>
  );
}
