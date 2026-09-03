import { useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";
import JLPTPractice from "../../components/jlpt/JLPTPractice";

export default function JLPTPracticePage() {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader(
      "Luyện Đề JLPT",
      "日本語能力試験 — luyện thi JLPT N1～N5 với đầy đủ 4 phần: Từ vựng, Ngữ pháp, Đọc hiểu, Nghe hiểu"
    );
  }, [setPageHeader]);

  return (
    <>
      <PageMeta
        title="Luyện Đề JLPT | Manabi AI"
        description="Luyện thi JLPT N1~N5 với đầy đủ 4 phần: Từ vựng, Ngữ pháp, Đọc hiểu, Nghe hiểu"
      />
      <JLPTPractice />
    </>
  );
}
