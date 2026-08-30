import { useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";
import VocabularyLearningHome from "../../components/vocabulary-learning/VocabularyLearningHome";

export default function VocabularyLearningPage() {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader("Kho từ vựng", "Học và ôn tập từ vựng theo bộ, với flashcard SRS và nhiều chế độ học khác nhau.");
  }, [setPageHeader]);

  return (
    <>
      <PageMeta title="Kho từ vựng | Manabi AI" description="Học và ôn tập từ vựng qua flashcard, SRS và nhiều chế độ học." />
      <VocabularyLearningHome />
    </>
  );
}
